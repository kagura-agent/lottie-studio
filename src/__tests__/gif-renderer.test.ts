import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  setViewport: vi.fn(),
  setContent: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  connected: true,
  newPage: vi.fn().mockResolvedValue(mockPage),
  on: vi.fn(),
};

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

vi.mock("sharp", () => {
  const sharpInstance = {
    resize: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(480 * 480 * 4)),
    gif: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: vi.fn().mockReturnValue(sharpInstance),
  };
});

vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue("// lottie.min.js mock"),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
}));

describe("gif-renderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.evaluate.mockReset();
    mockPage.screenshot.mockResolvedValue(Buffer.from("fake-png"));
  });

  it("returns false for null input", async () => {
    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview(null, "/tmp/test.gif");
    expect(result).toBe(false);
  });

  it("returns false when totalFrames is 0", async () => {
    mockPage.evaluate.mockResolvedValue(0);
    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview({ fr: 30 }, "/tmp/test.gif");
    expect(result).toBe(false);
  });

  it("returns false when totalFrames is negative", async () => {
    mockPage.evaluate.mockResolvedValue(-5);
    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview({ fr: 30 }, "/tmp/test.gif");
    expect(result).toBe(false);
  });

  it("renders GIF successfully with valid animation", async () => {
    // First evaluate call returns totalFrames, subsequent ones are goToAndStop
    mockPage.evaluate
      .mockResolvedValueOnce(undefined) // evaluate lottieScript
      .mockResolvedValueOnce(60) // totalFrames
      .mockResolvedValue(undefined); // goToAndStop calls

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview(
      { fr: 30, layers: [] },
      "/tmp/output.gif"
    );
    expect(result).toBe(true);
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 480,
      height: 480,
      deviceScaleFactor: 1,
    });
    expect(mockPage.screenshot).toHaveBeenCalledTimes(20);
    expect(mockPage.close).toHaveBeenCalled();
  });

  it("creates output directory if it doesn't exist", async () => {
    const fs = (await import("node:fs")).default;
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    mockPage.evaluate
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(30)
      .mockResolvedValue(undefined);

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    await renderAnimatedPreview({ fr: 30 }, "/tmp/subdir/output.gif");

    expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/subdir", { recursive: true });
  });

  it("uses default frame rate of 30 when fr is not provided", async () => {
    mockPage.evaluate
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(60)
      .mockResolvedValue(undefined);

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview(
      { layers: [] },
      "/tmp/output.gif"
    );
    expect(result).toBe(true);
  });

  it("returns false and logs error on exception", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPage.evaluate.mockRejectedValueOnce(new Error("browser crashed"));

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview({ fr: 24 }, "/tmp/out.gif");

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[gif-renderer] Failed to render:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("closes page even when error occurs", async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error("fail"));

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    await renderAnimatedPreview({ fr: 30 }, "/tmp/out.gif");

    expect(mockPage.close).toHaveBeenCalled();
  });

  it("handles page.close() throwing without crashing", async () => {
    mockPage.evaluate
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(30)
      .mockResolvedValue(undefined);
    mockPage.close.mockRejectedValueOnce(new Error("already closed"));

    const { renderAnimatedPreview } = await import("@/lib/gif-renderer");
    const result = await renderAnimatedPreview({ fr: 30 }, "/tmp/out.gif");
    expect(result).toBe(true);
  });
});
