import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");

let mockDbGetReturn: unknown = undefined;

vi.mock("@/lib/thumbnail-renderer", () => ({
  renderLottieThumbnail: vi.fn().mockResolvedValue(false),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      get: (..._args: unknown[]) => mockDbGetReturn,
    }),
  },
  ANIMATIONS_DIR: path.join(process.cwd(), "data", "animations"),
}));

async function importRoute() {
  const mod = await import("../route");
  return mod;
}

describe("thumbnail API route", () => {
  beforeEach(() => {
    mockDbGetReturn = undefined;
  });

  it("GET returns 404 for non-existent animation", async () => {
    mockDbGetReturn = undefined;

    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/animations/fake-id/thumbnail"), {
      params: Promise.resolve({ id: "fake-id" }),
    });

    expect(response.status).toBe(404);
  });

  it("GET returns 400 for invalid id with path traversal", async () => {
    const { GET } = await importRoute();
    const response = await GET(
      new Request("http://localhost/api/animations/../etc/passwd/thumbnail"),
      { params: Promise.resolve({ id: "../etc/passwd" }) }
    );

    expect(response.status).toBe(400);
  });

  it("GET returns PNG content-type for existing animation", async () => {
    mockDbGetReturn = { name: "Test Animation" };

    const { GET } = await importRoute();
    const response = await GET(
      new Request("http://localhost/api/animations/test-id/thumbnail"),
      { params: Promise.resolve({ id: "test-id" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("GET serves captured thumbnail when it exists", async () => {
    const testId = "captured-test-id";
    mockDbGetReturn = { name: "Test" };

    const capturedPath = path.join(THUMBNAILS_DIR, `${testId}.captured.png`);
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    fs.writeFileSync(capturedPath, pngHeader);

    try {
      const { GET } = await importRoute();
      const response = await GET(
        new Request(`http://localhost/api/animations/${testId}/thumbnail`),
        { params: Promise.resolve({ id: testId }) }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("max-age=3600");
    } finally {
      if (fs.existsSync(capturedPath)) fs.unlinkSync(capturedPath);
    }
  });

  it("PUT returns 400 for missing thumbnail field", async () => {
    mockDbGetReturn = { id: "test-id" };

    const { PUT } = await importRoute();
    const response = await PUT(
      new Request("http://localhost/api/animations/test-id/thumbnail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "test-id" }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing thumbnail field");
  });

  it("PUT saves captured thumbnail for valid PNG", async () => {
    const testId = "put-test-id";
    mockDbGetReturn = { id: testId };

    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const pngChunk = Buffer.alloc(25);
    pngSignature.copy(pngChunk);
    const base64 = `data:image/png;base64,${pngChunk.toString("base64")}`;

    const { PUT } = await importRoute();
    const response = await PUT(
      new Request(`http://localhost/api/animations/${testId}/thumbnail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: base64 }),
      }),
      { params: Promise.resolve({ id: testId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const capturedPath = path.join(THUMBNAILS_DIR, `${testId}.captured.png`);
    try {
      expect(fs.existsSync(capturedPath)).toBe(true);
    } finally {
      if (fs.existsSync(capturedPath)) fs.unlinkSync(capturedPath);
    }
  });
});
