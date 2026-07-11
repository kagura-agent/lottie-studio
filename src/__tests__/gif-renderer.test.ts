import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      connected: true,
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn(),
        setContent: vi.fn(),
        evaluate: vi.fn().mockResolvedValue(0),
        screenshot: vi.fn().mockResolvedValue(Buffer.from("")),
        close: vi.fn(),
      }),
      on: vi.fn(),
    }),
  },
}));

vi.mock("canvas", () => ({
  createCanvas: vi.fn().mockReturnValue({
    getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
  }),
  loadImage: vi.fn().mockResolvedValue({}),
}));

describe("gif-renderer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns false for invalid JSON (null input)", async () => {
    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview(null, "/tmp/test.gif");
    expect(result).toBe(false);
  });

  it("returns false when totalFrames is 0", async () => {
    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview({ fr: 30 }, "/tmp/test.gif");
    expect(result).toBe(false);
  });
});

describe("preview API route", () => {
  it("returns 404 for non-existent animation", async () => {
    vi.doMock("@/lib/db", () => ({
      db: {
        prepare: () => ({ get: () => undefined }),
      },
      ANIMATIONS_DIR: "/tmp/anims",
    }));

    const { GET } = await import(
      "@/app/api/animations/[id]/preview/route"
    );

    const response = await GET(new Request("http://localhost/api/animations/nonexistent/preview"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    const { GET } = await import(
      "@/app/api/animations/[id]/preview/route"
    );

    const response = await GET(new Request("http://localhost/api/animations/../etc/preview"), {
      params: Promise.resolve({ id: "../etc" }),
    });

    expect(response.status).toBe(400);
  });
});
