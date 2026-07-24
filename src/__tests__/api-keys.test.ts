import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("api-keys", () => {
  let generateApiKey: typeof import("@/lib/api-keys").generateApiKey;
  let validateApiKey: typeof import("@/lib/api-keys").validateApiKey;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/api-keys");
    generateApiKey = mod.generateApiKey;
    validateApiKey = mod.validateApiKey;
  });

  describe("generateApiKey", () => {
    it("returns key with ls_ prefix and 32 hex chars", () => {
      const result = generateApiKey("test-key");
      expect(result.key).toMatch(/^ls_[0-9a-f]{32}$/);
      expect(result.name).toBe("test-key");
      expect(result.id).toBeTruthy();
    });

    it("generates unique keys each time", () => {
      const a = generateApiKey("key-a");
      const b = generateApiKey("key-b");
      expect(a.key).not.toBe(b.key);
      expect(a.id).not.toBe(b.id);
    });

    it("stores hash, not raw key", async () => {
      const { default: crypto } = await import("node:crypto");
      const result = generateApiKey("hash-test");
      const { db } = await import("@/lib/db");
      const row = db.prepare("SELECT key_hash FROM api_keys WHERE id = ?").get(result.id) as { key_hash: string };
      const expectedHash = crypto.createHash("sha256").update(result.key).digest("hex");
      expect(row.key_hash).toBe(expectedHash);
      expect(row.key_hash).not.toBe(result.key);
    });
  });

  describe("validateApiKey", () => {
    it("returns ApiKey for valid key", () => {
      const { key } = generateApiKey("valid-test");
      const result = validateApiKey(key);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("valid-test");
      expect(result!.enabled).toBe(1);
    });

    it("returns null for invalid key", () => {
      const result = validateApiKey("ls_0000000000000000000000000000dead");
      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(validateApiKey("")).toBeNull();
    });

    it("returns disabled key (caller decides policy)", async () => {
      const { key, id } = generateApiKey("disable-test");
      const { db } = await import("@/lib/db");
      db.prepare("UPDATE api_keys SET enabled = 0 WHERE id = ?").run(id);
      const result = validateApiKey(key);
      expect(result).not.toBeNull();
      expect(result!.enabled).toBe(0);
    });
  });
});

describe("api-middleware rate limiting", () => {
  it("blocks after per-key rate limit exceeded", async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__lottieApiRateBuckets;

    const { generateApiKey } = await import("@/lib/api-keys");
    const { withApiKey } = await import("@/lib/api-middleware");
    const { db } = await import("@/lib/db");

    const { key, id } = generateApiKey("rate-test");
    db.prepare("UPDATE api_keys SET rate_limit = 2 WHERE id = ?").run(id);

    const handler = withApiKey(async () => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ ok: true });
    });

    const makeReq = () =>
      new Request("http://test/api/v1/test", {
        headers: { authorization: `Bearer ${key}` },
      });

    const r1 = await handler(makeReq());
    expect(r1.status).toBe(200);

    const r2 = await handler(makeReq());
    expect(r2.status).toBe(200);

    const r3 = await handler(makeReq());
    expect(r3.status).toBe(429);
    expect(r3.headers.get("Retry-After")).toBeTruthy();
  });
});

// ─── v1 Route Handler Tests ───

describe("POST /api/v1/generate", () => {
  let validKey: string;

  beforeEach(async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__lottieApiRateBuckets;

    const { generateApiKey } = await import("@/lib/api-keys");
    validKey = generateApiKey("gen-test").key;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without auth header", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer ls_00000000000000000000000000000bad",
      },
      body: JSON.stringify({ prompt: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid JSON/i);
  });

  it("returns 400 for missing prompt", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/prompt/i);
  });

  it("returns 400 for empty string prompt", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string prompt", async () => {
    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: 123 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when LLM returns no lottieJson", async () => {
    vi.doMock("@/lib/llm", () => ({
      chatCompletion: vi.fn().mockResolvedValue({
        lottieJson: null,
        reply: "Sorry",
      }),
    }));

    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "A spinning gear" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/Failed to generate/i);
  });

  it("returns 500 when LLM throws", async () => {
    vi.doMock("@/lib/llm", () => ({
      chatCompletion: vi.fn().mockRejectedValue(new Error("LLM timeout")),
    }));

    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "A spinning gear" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/generation failed/i);
  });

  it("returns 500 when LLM throws non-Error", async () => {
    vi.doMock("@/lib/llm", () => ({
      chatCompletion: vi.fn().mockRejectedValue("string error"),
    }));

    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "A spinning gear" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/generation failed/i);
  });

  it("respects custom width and height", async () => {
    const fakeLottie = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 800, h: 600, layers: [] };
    vi.doMock("@/lib/llm", () => ({
      chatCompletion: vi.fn().mockResolvedValue({
        lottieJson: fakeLottie,
        reply: "Custom size animation",
      }),
    }));

    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "A spinning gear", width: 800, height: 600 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("lottieJson");
  });

  it("returns 200 with valid key and correct shape", async () => {
    const fakeLottie = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] };
    vi.doMock("@/lib/llm", () => ({
      chatCompletion: vi.fn().mockResolvedValue({
        lottieJson: fakeLottie,
        reply: "A test animation",
      }),
    }));

    const { POST } = await import("@/app/api/v1/generate/route");
    const req = new Request("http://test/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${validKey}`,
      },
      body: JSON.stringify({ prompt: "A spinning gear" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("lottieJson");
    expect(data).toHaveProperty("description");
  });
});

describe("GET /api/v1/animations/[id]", () => {
  let validKey: string;

  beforeEach(async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__lottieApiRateBuckets;

    const { generateApiKey } = await import("@/lib/api-keys");
    validKey = generateApiKey("anim-test").key;
  });

  it("returns 401 without auth header", async () => {
    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request("http://test/api/v1/animations/some-id");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request("http://test/api/v1/animations/some-id", {
      headers: { authorization: "Bearer ls_00000000000000000000000000000bad" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when animation ID not in DB", async () => {
    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request("http://test/api/v1/animations/nonexistent-id", {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });

  it("returns 400 when animation ID is missing (trailing slash)", async () => {
    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request("http://test/api/v1/animations/", {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/ID required/i);
  });

  it("returns 404 when animation exists in DB but JSON file missing from disk", async () => {
    const crypto = await import("node:crypto");
    const { db } = await import("@/lib/db");

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)").run(id, "Ghost", 60, 2);

    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request(`http://test/api/v1/animations/${id}`, {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/data not found/i);
  });

  it("returns 200 with valid key for existing animation", async () => {
    const crypto = await import("node:crypto");
    const fs = await import("node:fs");
    const { db, ANIMATIONS_DIR } = await import("@/lib/db");

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)").run(id, "Test", 60, 2);

    const path = await import("node:path");
    const jsonPath = path.join(ANIMATIONS_DIR, `${id}.json`);
    const lottie = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] };
    fs.writeFileSync(jsonPath, JSON.stringify(lottie));

    const { GET } = await import("@/app/api/v1/animations/[id]/route");
    const req = new Request(`http://test/api/v1/animations/${id}`, {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id", id);
    expect(data).toHaveProperty("name", "Test");
    expect(data).toHaveProperty("lottieJson");
    expect(data).toHaveProperty("created_at");

    fs.unlinkSync(jsonPath);
  });
});

describe("GET /api/v1/templates", () => {
  let validKey: string;

  beforeEach(async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__lottieApiRateBuckets;

    const { generateApiKey } = await import("@/lib/api-keys");
    validKey = generateApiKey("tpl-test").key;
  });

  it("returns 401 without auth header", async () => {
    const { GET } = await import("@/app/api/v1/templates/route");
    const req = new Request("http://test/api/v1/templates");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const { GET } = await import("@/app/api/v1/templates/route");
    const req = new Request("http://test/api/v1/templates", {
      headers: { authorization: "Bearer ls_00000000000000000000000000000bad" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid key and templates array", async () => {
    const { GET } = await import("@/app/api/v1/templates/route");
    const req = new Request("http://test/api/v1/templates", {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("templates");
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates.length).toBeGreaterThan(0);
    expect(data.templates[0]).toHaveProperty("id");
    expect(data.templates[0]).toHaveProperty("name");
    expect(data.templates[0]).toHaveProperty("category");
  });
});

describe("GET /api/v1/templates/[id]", () => {
  let validKey: string;

  beforeEach(async () => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__lottieApiRateBuckets;

    const { generateApiKey } = await import("@/lib/api-keys");
    validKey = generateApiKey("tplid-test").key;
  });

  it("returns 401 without auth header", async () => {
    const { GET } = await import("@/app/api/v1/templates/[id]/route");
    const req = new Request("http://test/api/v1/templates/bouncing-ball");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid key", async () => {
    const { GET } = await import("@/app/api/v1/templates/[id]/route");
    const req = new Request("http://test/api/v1/templates/bouncing-ball", {
      headers: { authorization: "Bearer ls_00000000000000000000000000000bad" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid key for existing template", async () => {
    const { GET } = await import("@/app/api/v1/templates/[id]/route");
    const req = new Request("http://test/api/v1/templates/bouncing-ball", {
      headers: { authorization: `Bearer ${validKey}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id", "bouncing-ball");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("category");
    expect(data).toHaveProperty("lottieJson");
  });
});
