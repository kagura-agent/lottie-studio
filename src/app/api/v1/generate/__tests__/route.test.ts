import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

vi.mock("node:crypto", () => ({
  default: { randomUUID: () => MOCK_UUID },
  randomUUID: () => MOCK_UUID,
}));

const mockWriteFileSync = vi.fn();
vi.mock("node:fs", () => ({
  default: { writeFileSync: mockWriteFileSync },
  writeFileSync: mockWriteFileSync,
}));

const mockDbRun = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ run: mockDbRun }),
  },
  ANIMATIONS_DIR: path.join(process.cwd(), "data", "animations"),
}));

const mockChatCompletion = vi.fn();
vi.mock("@/lib/llm", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: () => "mock-system-prompt",
}));

// Mock withApiKey: by default, pass through (auth succeeds).
// Tests for auth rejection override this per-test.
let mockWithApiKey: ReturnType<typeof vi.fn>;

vi.mock("@/lib/api-middleware", () => {
  // Default: passthrough — just call the handler with { request, apiKey }
  mockWithApiKey = vi.fn((handler) => {
    return async (request: Request) => {
      return handler({ request, apiKey: { id: "test-key", name: "test" } });
    };
  });
  return { withApiKey: mockWithApiKey };
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeInvalidJsonRequest() {
  return new Request("http://localhost/api/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "NOT VALID JSON {{{",
  });
}

async function importRoute() {
  return await import("../route");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("/api/v1/generate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Happy path ────────────────────────────────────────────────────────

  it("returns generated animation on valid request", async () => {
    const fakeLottie = { v: "5.7.0", fr: 30, w: 512, h: 512, layers: [] };
    mockChatCompletion.mockResolvedValue({
      lottieJson: fakeLottie,
      reply: "Here is your animation",
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "bouncing ball" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(MOCK_UUID);
    expect(json.lottieJson).toEqual(fakeLottie);
    expect(json.description).toBe("Here is your animation");
  });

  // ─── DB insert on success ──────────────────────────────────────────────

  it("inserts animation into DB on success", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test animation" }));

    expect(mockDbRun).toHaveBeenCalledWith(
      MOCK_UUID,
      "test animation",
      60, // 30fps * 2s
      2
    );
  });

  // ─── File write on success ─────────────────────────────────────────────

  it("writes JSON file on success", async () => {
    const fakeLottie = { layers: [] };
    mockChatCompletion.mockResolvedValue({
      lottieJson: fakeLottie,
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "save test" }));

    const expectedPath = path.join(process.cwd(), "data", "animations", `${MOCK_UUID}.json`);
    expect(mockWriteFileSync).toHaveBeenCalledWith(expectedPath, JSON.stringify(fakeLottie));
  });

  // ─── Invalid JSON body ────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await importRoute();
    const response = await POST(makeInvalidJsonRequest());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  // ─── Missing prompt ────────────────────────────────────────────────────

  it("returns 400 when prompt is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ width: 256 }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("prompt is required");
  });

  // ─── Empty prompt ──────────────────────────────────────────────────────

  it("returns 400 when prompt is empty string", async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "" }));

    expect(response.status).toBe(400);
  });

  // ─── Whitespace-only prompt ────────────────────────────────────────────

  it("returns 400 when prompt is only whitespace", async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "   " }));

    expect(response.status).toBe(400);
  });

  // ─── Non-string prompt ─────────────────────────────────────────────────

  it("returns 400 when prompt is a number", async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: 42 }));

    expect(response.status).toBe(400);
  });

  // ─── Width/height clamping ─────────────────────────────────────────────

  it("clamps width below 64 to 64", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: 10, height: 512 }));

    // The system prompt should contain w=64 (clamped from 10)
    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("64×512");
  });

  it("clamps width above 2048 to 2048", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: 9999, height: 512 }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("2048×512");
  });

  it("clamps height below 64 to 64", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: 512, height: 1 }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("512×64");
  });

  it("clamps height above 2048 to 2048", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: 512, height: 5000 }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("512×2048");
  });

  it("uses default 512×512 when width/height not provided", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test" }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("512×512");
  });

  it("uses default when width/height are non-numeric", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: "big", height: "tall" }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("512×512");
  });

  // ─── LLM returns no lottieJson ─────────────────────────────────────────

  it("returns 500 when LLM returns no lottieJson", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: null,
      reply: "Sorry",
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "fail me" }));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to generate valid Lottie animation");
  });

  // ─── LLM throws error ─────────────────────────────────────────────────

  it("returns 500 when LLM throws an error", async () => {
    mockChatCompletion.mockRejectedValue(new Error("LLM connection failed"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "crash me" }));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Animation generation failed");
  });

  it("returns 500 when LLM throws a non-Error", async () => {
    mockChatCompletion.mockRejectedValue("string error");

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ prompt: "crash me" }));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Animation generation failed");
  });

  // ─── Long prompt truncation ────────────────────────────────────────────

  it("truncates animation name to 100 characters", async () => {
    const longPrompt = "a".repeat(200);
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: longPrompt }));

    const nameArg = mockDbRun.mock.calls[0][1];
    expect(nameArg).toHaveLength(100);
  });

  // ─── withApiKey integration ────────────────────────────────────────────

  it("POST is wrapped with withApiKey", async () => {
    // withApiKey is called at module parse time; re-import a fresh module to observe it
    vi.resetModules();
    const freshMod = await import("../route");
    expect(mockWithApiKey).toHaveBeenCalled();
    expect(typeof freshMod.POST).toBe("function");
  });

  // ─── Custom width/height values ────────────────────────────────────────

  it("passes custom valid width and height to LLM prompt", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test", width: 800, height: 600 }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain("800×600");
    expect(systemContent).toContain('"w": 800');
    expect(systemContent).toContain('"h": 600');
  });

  // ─── Verify prompt/messages structure ──────────────────────────────────

  it("sends correct message structure to LLM", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "hello world" }));

    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
    const messages = mockChatCompletion.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("hello world");
  });

  // ─── Verify fps/duration in system prompt ──────────────────────────────

  it("includes correct fps and duration in system prompt", async () => {
    mockChatCompletion.mockResolvedValue({
      lottieJson: { layers: [] },
      reply: "",
    });

    const { POST } = await importRoute();
    await POST(makeRequest({ prompt: "test" }));

    const callArgs = mockChatCompletion.mock.calls[0][0];
    const systemContent = callArgs[0].content;
    expect(systemContent).toContain('"fr": 30');
    expect(systemContent).toContain("2 seconds");
    expect(systemContent).toContain("60 frames");
    expect(systemContent).toContain('"ip": 0');
    expect(systemContent).toContain('"op": 60');
  });
});
