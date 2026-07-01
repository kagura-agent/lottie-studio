import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Test /variations command parsing ───

describe("parseCommand — /variations", () => {
  let parseCommand: typeof import("@/lib/commands").parseCommand;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/commands");
    parseCommand = mod.parseCommand;
  });

  it("parses /variations with a prompt", () => {
    const result = parseCommand("/variations a bouncing ball");
    expect(result).toEqual({ type: "variations", prompt: "a bouncing ball" });
  });

  it("parses /variations with multi-word prompt", () => {
    const result = parseCommand("/variations colorful waves flowing across the screen");
    expect(result).toEqual({
      type: "variations",
      prompt: "colorful waves flowing across the screen",
    });
  });

  it("returns error when prompt is empty", () => {
    const result = parseCommand("/variations");
    expect(result).toEqual({
      type: "error",
      message: "Usage: /variations <prompt> (e.g. /variations a bouncing ball)",
    });
  });

  it("returns error when prompt is only spaces", () => {
    const result = parseCommand("/variations   ");
    expect(result).toEqual({
      type: "error",
      message: "Usage: /variations <prompt> (e.g. /variations a bouncing ball)",
    });
  });
});

// ─── Test /api/generate/variations endpoint ───

const mockChatCompletion = vi.fn();

vi.mock("@/lib/llm", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

describe("/api/generate/variations — input validation", () => {
  let POST: typeof import("@/app/api/generate/variations/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    mockChatCompletion.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__lottieGenRateBuckets?.clear();
    vi.stubEnv("NODE_ENV", "development");

    mockChatCompletion.mockResolvedValue({
      reply: "A test animation",
      lottieJson: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] },
      parseError: null,
      suggestions: null,
    });

    const mod = await import("@/app/api/generate/variations/route");
    POST = mod.POST;
  });

  it("rejects missing prompt", async () => {
    const req = new Request("http://localhost/api/generate/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("prompt");
  });

  it("rejects invalid dimensions", async () => {
    const req = new Request("http://localhost/api/generate/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a ball", width: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("width");
  });

  it("returns variations on success", async () => {
    const req = new Request("http://localhost/api/generate/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a bouncing ball" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.variations).toHaveLength(3);
    expect(data.variations[0].style).toBe("playful");
    expect(data.variations[1].style).toBe("smooth");
    expect(data.variations[2].style).toBe("dynamic");
    expect(data.variations[0].animation).toHaveProperty("v");
    expect(data.variations[0].description).toBe("A test animation");
  });
});

// ─── Test partial success (2 of 3 succeed) ───

describe("/api/generate/variations — partial success", () => {
  let POST: typeof import("@/app/api/generate/variations/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    mockChatCompletion.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__lottieGenRateBuckets?.clear();
    vi.stubEnv("NODE_ENV", "development");

    let callCount = 0;
    mockChatCompletion.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // Second call fails (smooth) — returns no lottie
        return Promise.resolve({
          reply: "Failed attempt",
          lottieJson: null,
          parseError: "no_json" as const,
          suggestions: null,
        });
      }
      return Promise.resolve({
        reply: "Success animation",
        lottieJson: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] },
        parseError: null,
        suggestions: null,
      });
    });

    const mod = await import("@/app/api/generate/variations/route");
    POST = mod.POST;
  });

  it("returns partial results when some variations fail", async () => {
    const req = new Request("http://localhost/api/generate/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a bouncing ball" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Only 2 succeed (playful and dynamic), smooth fails
    expect(data.variations).toHaveLength(2);
    expect(data.variations[0].style).toBe("playful");
    expect(data.variations[1].style).toBe("dynamic");
  });
});

// ─── Test rate limiting (counts as 3) ───

describe("/api/generate/variations — rate limiting", () => {
  let POST: typeof import("@/app/api/generate/variations/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    mockChatCompletion.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__lottieGenRateBuckets?.clear();
    vi.stubEnv("GENERATE_RATE_BURST", "5");
    vi.stubEnv("GENERATE_RATE_WINDOW_SEC", "60");
    vi.stubEnv("NODE_ENV", "production");

    mockChatCompletion.mockResolvedValue({
      reply: "A test animation",
      lottieJson: { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] },
      parseError: null,
      suggestions: null,
    });

    const mod = await import("@/app/api/generate/variations/route");
    POST = mod.POST;
  });

  it("rate limits after burst is exceeded (counting as 3 per request)", async () => {
    const makeReq = () =>
      new Request("http://localhost/api/generate/variations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "99.99.99.99",
        },
        body: JSON.stringify({ prompt: "a ball" }),
      });

    // First request costs 3 out of 5
    const res1 = await POST(makeReq());
    expect(res1.status).toBe(200);

    // Second request would cost 3 more (total 6 > 5), should be rejected
    const res2 = await POST(makeReq());
    expect(res2.status).toBe(429);
    const data = await res2.json();
    expect(data.success).toBe(false);
    expect(data.retryAfterSec).toBeGreaterThan(0);
  });
});
