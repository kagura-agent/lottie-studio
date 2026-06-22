import { describe, it, expect, beforeEach, vi } from "vitest";

describe("extractIp", () => {
  let extractIp: typeof import("@/lib/rateLimit").extractIp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/rateLimit");
    extractIp = mod.extractIp;
  });

  it("extracts first IP from x-forwarded-for", () => {
    const req = new Request("http://test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(extractIp(req)).toBe("1.2.3.4");
  });

  it("extracts from x-real-ip when no x-forwarded-for", () => {
    const req = new Request("http://test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(extractIp(req)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = new Request("http://test");
    expect(extractIp(req)).toBe("unknown");
  });
});

describe("checkRate", () => {
  let checkRate: typeof import("@/lib/rateLimit").checkRate;

  beforeEach(async () => {
    vi.stubEnv("CHAT_RATE_BURST", "3");
    vi.stubEnv("CHAT_RATE_WINDOW_SEC", "60");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__lottieRateBuckets?.clear();
    const mod = await import("@/lib/rateLimit");
    checkRate = mod.checkRate;
  });

  it("allows requests within burst limit", () => {
    expect(checkRate("10.0.0.1")).toEqual({ ok: true });
    expect(checkRate("10.0.0.1")).toEqual({ ok: true });
    expect(checkRate("10.0.0.1")).toEqual({ ok: true });
  });

  it("blocks after burst exceeded", () => {
    checkRate("10.0.0.2");
    checkRate("10.0.0.2");
    checkRate("10.0.0.2");
    const result = checkRate("10.0.0.2");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("localhost IPs always bypass", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRate("127.0.0.1")).toEqual({ ok: true });
    }
  });
});
