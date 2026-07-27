import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  prepare: vi.fn(),
};

const mockFs = {
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
};

const mockSharp = vi.fn().mockReturnValue({
  png: vi.fn().mockReturnValue({
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
  }),
});

const mockRenderLottieThumbnail = vi.fn();

vi.mock("@/lib/db", () => ({
  db: mockDb,
  ANIMATIONS_DIR: "/mock/animations",
}));

vi.mock("node:fs", () => ({ default: mockFs }));

vi.mock("sharp", () => ({ default: mockSharp }));

vi.mock("@/lib/thumbnail-renderer", () => ({
  renderLottieThumbnail: mockRenderLottieThumbnail,
}));

// Valid PNG: 8-byte signature
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function validPngBase64(extra = 100): string {
  const buf = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(extra, 0)]);
  return buf.toString("base64");
}

describe("GET /api/animations/[id]/thumbnail", () => {
  let GET: typeof import("@/app/api/animations/[id]/thumbnail/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });
    const mod = await import(
      "@/app/api/animations/[id]/thumbnail/route"
    );
    GET = mod.GET;
  });

  function callGET(id: string) {
    return GET(new Request("http://localhost/api/animations/" + id + "/thumbnail"), {
      params: Promise.resolve({ id }),
    });
  }

  it("returns 400 for invalid id", async () => {
    const res = await callGET("../bad");
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent animation", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });
    const res = await callGET("abc123");
    expect(res.status).toBe(404);
  });

  it("serves client-captured thumbnail (priority 1)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    const pngBuf = Buffer.from("captured-png");
    mockFs.existsSync.mockImplementation((p: string) =>
      typeof p === "string" && p.endsWith(".captured.png")
    );
    mockFs.readFileSync.mockReturnValue(pngBuf);

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  it("serves server-rendered thumbnail (priority 2)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    const pngBuf = Buffer.from("rendered-png");
    mockFs.existsSync.mockImplementation((p: string) =>
      typeof p === "string" && p.endsWith(".rendered.png")
    );
    mockFs.readFileSync.mockReturnValue(pngBuf);

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=86400");
  });

  it("renders on-demand when animation JSON exists (priority 3)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    const animJson = JSON.stringify({ v: "5.0", layers: [] });
    const renderedBuf = Buffer.from("on-demand-png");
    let renderedFileCreated = false;

    mockFs.existsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith(".json")) return true;
      if (typeof p === "string" && p.endsWith(".rendered.png")) return renderedFileCreated;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p: string | unknown) => {
      if (typeof p === "string" && p.endsWith(".json")) return animJson;
      return renderedBuf;
    });
    mockRenderLottieThumbnail.mockImplementation(async () => {
      renderedFileCreated = true;
      return true;
    });

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(mockRenderLottieThumbnail).toHaveBeenCalled();
  });

  it("falls through when on-demand render fails (priority 3 failure)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    mockFs.existsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith(".json")) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p: string | unknown) => {
      if (typeof p === "string" && p.endsWith(".json"))
        return JSON.stringify({ v: "5.0" });
      return Buffer.from("");
    });
    mockRenderLottieThumbnail.mockResolvedValue(false);

    const res = await callGET("abc123");
    // Falls through to fallback generation
    expect(res.status).toBe(200);
    expect(mockSharp).toHaveBeenCalled();
  });

  it("falls through on JSON parse error (priority 3)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    mockFs.existsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith(".json")) return true;
      return false;
    });
    mockFs.readFileSync.mockImplementation((p: string | unknown) => {
      if (typeof p === "string" && p.endsWith(".json")) return "not-valid-json{{{";
      return Buffer.from("");
    });

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(mockSharp).toHaveBeenCalled();
  });

  it("serves cached fallback thumbnail (priority 4)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "Test" }) });
    const cachedBuf = Buffer.from("cached-fallback");
    mockFs.existsSync.mockImplementation((p: string) => {
      // Not captured, not rendered, not json, but fallback .png exists
      if (typeof p === "string" && p.endsWith(".captured.png")) return false;
      if (typeof p === "string" && p.endsWith(".rendered.png")) return false;
      if (typeof p === "string" && p.endsWith(".json")) return false;
      if (typeof p === "string" && p.endsWith(".png")) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(cachedBuf);

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
  });

  it("generates and caches SVG-based fallback when nothing exists (priority 4 miss)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "My Anim" }) });
    mockFs.existsSync.mockReturnValue(false);

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(mockSharp).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });

  it("uses 'Untitled' when animation name is empty", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ name: "" }) });
    mockFs.existsSync.mockReturnValue(false);

    const res = await callGET("abc123");
    expect(res.status).toBe(200);
    expect(mockSharp).toHaveBeenCalled();
    const svgArg = mockSharp.mock.calls[0][0] as Buffer;
    expect(svgArg.toString()).toContain("Untitled");
  });
});

describe("PUT /api/animations/[id]/thumbnail", () => {
  let PUT: typeof import("@/app/api/animations/[id]/thumbnail/route").PUT;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });
    const mod = await import(
      "@/app/api/animations/[id]/thumbnail/route"
    );
    PUT = mod.PUT;
  });

  function callPUT(id: string, body: unknown) {
    return PUT(
      new Request("http://localhost/api/animations/" + id + "/thumbnail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    );
  }

  it("returns 400 for invalid id", async () => {
    const res = await callPUT("../bad", { thumbnail: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent animation", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });
    const res = await callPUT("abc123", { thumbnail: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const res = await callPUT("abc123", "not-json{{{");
    expect(res.status).toBe(400);
  });

  it("returns 400 when thumbnail field is missing", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const res = await callPUT("abc123", { other: "data" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("thumbnail");
  });

  it("returns 400 when thumbnail field is not a string", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const res = await callPUT("abc123", { thumbnail: 12345 });
    expect(res.status).toBe(400);
  });

  it("strips data URI prefix and saves valid PNG", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const b64 = validPngBase64();
    const res = await callPUT("abc123", {
      thumbnail: `data:image/png;base64,${b64}`,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });

  it("accepts raw base64 without data URI prefix", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const b64 = validPngBase64();
    const res = await callPUT("abc123", { thumbnail: b64 });
    expect(res.status).toBe(200);
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });

  it("returns 413 for thumbnail too large (>5MB)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    // Create a buffer > 5MB with valid PNG signature
    const largeBuf = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(5 * 1024 * 1024 + 1, 0)]);
    const res = await callPUT("abc123", {
      thumbnail: largeBuf.toString("base64"),
    });
    expect(res.status).toBe(413);
  });

  it("returns 400 for non-PNG file (wrong signature)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const notPng = Buffer.alloc(100, 0x41); // all 'A's
    const res = await callPUT("abc123", {
      thumbnail: notPng.toString("base64"),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("PNG");
  });

  it("returns 400 for buffer too short (<8 bytes)", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const shortBuf = Buffer.from([137, 80, 78]); // only 3 bytes
    const res = await callPUT("abc123", {
      thumbnail: shortBuf.toString("base64"),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("PNG");
  });

  it("writes captured file and returns {ok: true} for valid PNG", async () => {
    mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ id: "abc123" }) });
    const b64 = validPngBase64(50);
    const res = await callPUT("abc123", { thumbnail: b64 });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });

    const writtenPath = mockFs.writeFileSync.mock.calls[0][0] as string;
    expect(writtenPath).toContain("abc123.captured.png");
  });
});
