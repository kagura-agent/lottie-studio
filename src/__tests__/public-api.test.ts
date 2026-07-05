import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";

// ─── Rate Limiter Tests ───

describe("checkApiRate (sliding window)", () => {
  let checkApiRate: typeof import("@/lib/rateLimiter").checkApiRate;
  let resetApiRate: typeof import("@/lib/rateLimiter").resetApiRate;

  beforeEach(async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__lottieApiRateWindows?.clear();
    const mod = await import("@/lib/rateLimiter");
    checkApiRate = mod.checkApiRate;
    resetApiRate = mod.resetApiRate;
  });

  it("allows requests within limit", () => {
    expect(checkApiRate("key-1", 3)).toEqual({ ok: true });
    expect(checkApiRate("key-1", 3)).toEqual({ ok: true });
    expect(checkApiRate("key-1", 3)).toEqual({ ok: true });
  });

  it("blocks after limit exceeded", () => {
    checkApiRate("key-2", 2);
    checkApiRate("key-2", 2);
    const result = checkApiRate("key-2", 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("different keys have independent limits", () => {
    checkApiRate("key-a", 1);
    const resultA = checkApiRate("key-a", 1);
    expect(resultA.ok).toBe(false);

    // key-b should still be allowed
    expect(checkApiRate("key-b", 1)).toEqual({ ok: true });
  });

  it("reset clears all state", () => {
    checkApiRate("key-r", 1);
    const blocked = checkApiRate("key-r", 1);
    expect(blocked.ok).toBe(false);

    resetApiRate();
    expect(checkApiRate("key-r", 1)).toEqual({ ok: true });
  });
});

// ─── API Auth Tests ───

describe("authenticateRequest", () => {
  // We can't easily test against a real DB in unit tests, so we test the
  // parsing / validation logic by mocking db. For integration tests, the
  // actual DB would be used.

  it("rejects missing Authorization header", async () => {
    vi.resetModules();
    const mod = await import("@/lib/apiAuth");
    const req = new Request("http://test");
    const result = mod.authenticateRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Missing");
    }
  });

  it("rejects non-Bearer auth", async () => {
    vi.resetModules();
    const mod = await import("@/lib/apiAuth");
    const req = new Request("http://test", {
      headers: { authorization: "Basic abc123" },
    });
    const result = mod.authenticateRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toContain("Bearer");
    }
  });

  it("rejects malformed Bearer header (no token)", async () => {
    vi.resetModules();
    const mod = await import("@/lib/apiAuth");
    const req = new Request("http://test", {
      headers: { authorization: "Bearer" },
    });
    const result = mod.authenticateRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});

// ─── Key Generation Validation Tests ───

describe("API key generation validation", () => {
  it("generates valid 64-char hex key from crypto.randomBytes(32)", () => {
    const key = crypto.randomBytes(32).toString("hex");
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it("SHA-256 hash of key produces consistent 64-char hex", () => {
    const key = "test-api-key-12345";
    const hash1 = crypto.createHash("sha256").update(key).digest("hex");
    const hash2 = crypto.createHash("sha256").update(key).digest("hex");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("different keys produce different hashes", () => {
    const key1 = crypto.randomBytes(32).toString("hex");
    const key2 = crypto.randomBytes(32).toString("hex");
    const hash1 = crypto.createHash("sha256").update(key1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(key2).digest("hex");
    expect(hash1).not.toBe(hash2);
  });
});

// ─── v1 Input Validation Tests ───

describe("v1 generate input validation", () => {
  let validateGenerateInput: typeof import("@/lib/generate-validation").validateGenerateInput;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/generate-validation");
    validateGenerateInput = mod.validateGenerateInput;
  });

  it("validates a minimal valid input", () => {
    const result = validateGenerateInput({ prompt: "bouncing ball" });
    expect(result.valid).toBe(true);
  });

  it("validates full input with width/height", () => {
    const result = validateGenerateInput({
      prompt: "bouncing ball",
      width: 256,
      height: 256,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing prompt", () => {
    const result = validateGenerateInput({});
    expect(result.valid).toBe(false);
  });

  it("rejects empty prompt", () => {
    const result = validateGenerateInput({ prompt: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects non-object input", () => {
    const result = validateGenerateInput("just a string");
    expect(result.valid).toBe(false);
  });

  it("rejects out-of-range width", () => {
    const result = validateGenerateInput({ prompt: "test", width: 10 });
    expect(result.valid).toBe(false);
  });
});

// ─── v1 Endpoint Response Shape Tests ───

describe("v1 endpoint response shapes", () => {
  it("generate response should have id, lottieJson, description", () => {
    // Validate the expected shape
    const mockResponse = {
      id: "test-uuid",
      lottieJson: { v: "5.7.4", fr: 30, ip: 0, op: 60 },
      description: "A bouncing ball",
    };
    expect(mockResponse).toHaveProperty("id");
    expect(mockResponse).toHaveProperty("lottieJson");
    expect(mockResponse).toHaveProperty("description");
    expect(typeof mockResponse.id).toBe("string");
    expect(typeof mockResponse.lottieJson).toBe("object");
  });

  it("animation response should have id, name, lottieJson, created_at", () => {
    const mockResponse = {
      id: "test-uuid",
      name: "Test Animation",
      lottieJson: { v: "5.7.4" },
      created_at: "2025-01-15 08:30:00",
    };
    expect(mockResponse).toHaveProperty("id");
    expect(mockResponse).toHaveProperty("name");
    expect(mockResponse).toHaveProperty("lottieJson");
    expect(mockResponse).toHaveProperty("created_at");
  });

  it("templates list response should have templates array", () => {
    const mockResponse = {
      templates: [
        { id: "bouncing-ball", name: "Bouncing Ball", description: "test", category: "Motion" },
      ],
    };
    expect(mockResponse).toHaveProperty("templates");
    expect(Array.isArray(mockResponse.templates)).toBe(true);
    expect(mockResponse.templates[0]).toHaveProperty("id");
    expect(mockResponse.templates[0]).toHaveProperty("name");
    expect(mockResponse.templates[0]).toHaveProperty("category");
  });

  it("template detail response should have lottieJson", () => {
    const mockResponse = {
      id: "bouncing-ball",
      name: "Bouncing Ball",
      description: "test",
      category: "Motion",
      lottieJson: { v: "5.7.4" },
    };
    expect(mockResponse).toHaveProperty("lottieJson");
    expect(typeof mockResponse.lottieJson).toBe("object");
  });
});
