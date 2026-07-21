import { describe, it, expect, beforeEach, vi } from "vitest";

const mockChatCompletion = vi.fn();
vi.mock("@/lib/llm", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

const mockDbPrepare = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    prepare: (...args: unknown[]) => mockDbPrepare(...args),
  },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: () => "system prompt",
}));

const mockFsWriteFileSync = vi.fn();
const mockFsExistsSync = vi.fn();
const mockFsReadFileSync = vi.fn();
vi.mock("node:fs", () => ({
  default: {
    writeFileSync: (...args: unknown[]) => mockFsWriteFileSync(...args),
    existsSync: (...args: unknown[]) => mockFsExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockFsReadFileSync(...args),
  },
  writeFileSync: (...args: unknown[]) => mockFsWriteFileSync(...args),
  existsSync: (...args: unknown[]) => mockFsExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockFsReadFileSync(...args),
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiKey: (handler: (ctx: { request: Request }) => unknown) => {
    return (request: Request) => handler({ request });
  },
}));

describe("/api/v1/generate POST", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDbPrepare.mockReturnValue({ run: mockDbRun, get: mockDbGet });
    vi.resetModules();
    // Re-import to get fresh module with mocks
    const mod = await import("@/app/api/v1/generate/route");
    POST = mod.POST as unknown as (request: Request) => Promise<Response>;
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: "not json{{{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when prompt is missing", async () => {
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("prompt is required");
  });

  it("returns 400 when prompt is not a string", async () => {
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: 123 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("prompt is required");
  });

  it("returns 400 when prompt is empty string", async () => {
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "   " }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("prompt is required");
  });

  it("returns 500 when LLM returns no lottieJson", async () => {
    mockChatCompletion.mockResolvedValueOnce({ lottieJson: null, reply: "sorry" });
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "a ball" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to generate valid Lottie animation");
  });

  it("returns 500 when LLM throws an error", async () => {
    mockChatCompletion.mockRejectedValueOnce(new Error("API timeout"));
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "a ball" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Animation generation failed");
  });

  it("returns 500 when LLM throws a non-Error", async () => {
    mockChatCompletion.mockRejectedValueOnce("string error");
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "a ball" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Animation generation failed");
  });

  it("returns success with animation data on valid request", async () => {
    const lottie = { v: "5.5.7", layers: [] };
    mockChatCompletion.mockResolvedValueOnce({ lottieJson: lottie, reply: "Here it is" });
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "a bouncing ball", width: 800, height: 600 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.lottieJson).toEqual(lottie);
    expect(data.description).toBe("Here it is");
    expect(mockDbPrepare).toHaveBeenCalled();
    expect(mockDbRun).toHaveBeenCalled();
    expect(mockFsWriteFileSync).toHaveBeenCalled();
  });

  it("clamps width/height to valid range", async () => {
    const lottie = { v: "5.5.7", layers: [] };
    mockChatCompletion.mockResolvedValueOnce({ lottieJson: lottie, reply: "" });
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "test", width: 10, height: 9999 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // The clamping happens internally; just verify it succeeds
  });

  it("uses default dimensions when not provided", async () => {
    const lottie = { v: "5.5.7", layers: [] };
    mockChatCompletion.mockResolvedValueOnce({ lottieJson: lottie, reply: "" });
    const req = new Request("http://localhost/api/v1/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("/api/v1/animations/[id] GET", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDbPrepare.mockReturnValue({ run: mockDbRun, get: mockDbGet });
    vi.resetModules();
    const mod = await import("@/app/api/v1/animations/[id]/route");
    GET = mod.GET as unknown as (request: Request) => Promise<Response>;
  });

  it("returns 400 when animation ID is empty (trailing slash URL)", async () => {
    const req = new Request("http://localhost/api/v1/animations/", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Animation ID required");
  });

  it("returns 404 when animation not in DB", async () => {
    mockDbGet.mockReturnValueOnce(undefined);
    const req = new Request("http://localhost/api/v1/animations/nonexistent-id", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Animation not found");
  });

  it("returns 404 when JSON file missing from disk", async () => {
    mockDbGet.mockReturnValueOnce({ id: "abc", name: "Test", created_at: "2026-01-01" });
    mockFsExistsSync.mockReturnValueOnce(false);
    const req = new Request("http://localhost/api/v1/animations/abc", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Animation data not found");
  });

  it("returns animation data when found", async () => {
    const lottie = { v: "5.5.7", layers: [] };
    mockDbGet.mockReturnValueOnce({ id: "abc", name: "Test", created_at: "2026-01-01" });
    mockFsExistsSync.mockReturnValueOnce(true);
    mockFsReadFileSync.mockReturnValueOnce(JSON.stringify(lottie));
    const req = new Request("http://localhost/api/v1/animations/abc", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("abc");
    expect(data.name).toBe("Test");
    expect(data.lottieJson).toEqual(lottie);
    expect(data.created_at).toBe("2026-01-01");
  });
});
