import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPage = {
  setViewport: vi.fn(),
  setContent: vi.fn(),
  evaluate: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
  close: vi.fn(),
};

const mockBrowser = {
  connected: true,
  newPage: vi.fn().mockResolvedValue(mockPage),
  on: vi.fn(),
  close: vi.fn(),
};

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue("// lottie.min.js mock"),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
}));

describe("thumbnail-renderer - getBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches browser and returns instance", async () => {
    const { getBrowser } = await import("@/lib/thumbnail-renderer");
    const browser = await getBrowser();
    expect(browser).toBe(mockBrowser);
  });

  it("returns existing connected browser without relaunching", async () => {
    const { getBrowser } = await import("@/lib/thumbnail-renderer");

    const b1 = await getBrowser();
    const b2 = await getBrowser();
    expect(b1).toBe(b2);
  });
});

describe("thumbnail-renderer - renderLottieThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.evaluate.mockResolvedValue(undefined);
    mockPage.screenshot.mockResolvedValue(Buffer.from("fake-png"));
    mockPage.close.mockResolvedValue(undefined);
  });

  it("renders thumbnail successfully", async () => {
    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    const result = await renderLottieThumbnail(
      { fr: 30, layers: [] },
      "/tmp/thumb.png"
    );

    expect(result).toBe(true);
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 600,
      height: 600,
      deviceScaleFactor: 1,
    });
    expect(mockPage.setContent).toHaveBeenCalled();
    expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: "/tmp/thumb.png",
      type: "png",
      omitBackground: true,
    });
    expect(mockPage.close).toHaveBeenCalled();
  });

  it("creates output directory if missing", async () => {
    const fs = (await import("node:fs")).default;
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    await renderLottieThumbnail({ fr: 30 }, "/tmp/sub/thumb.png");

    expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/sub", { recursive: true });
  });

  it("returns false on error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPage.evaluate.mockRejectedValueOnce(new Error("evaluate failed"));

    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    const result = await renderLottieThumbnail({ fr: 30 }, "/tmp/thumb.png");

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[thumbnail-renderer] Failed to render:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("closes page even when error occurs", async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error("fail"));

    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    await renderLottieThumbnail({ fr: 30 }, "/tmp/thumb.png");

    expect(mockPage.close).toHaveBeenCalled();
  });

  it("handles page.close() throwing", async () => {
    mockPage.close.mockRejectedValueOnce(new Error("already closed"));

    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    const result = await renderLottieThumbnail({ fr: 30 }, "/tmp/thumb.png");

    expect(result).toBe(true);
  });

  it("skips page.close() when page is null (getBrowser fails)", async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const puppeteer = (await import("puppeteer-core")).default;
    (puppeteer.launch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("no chrome")
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { renderLottieThumbnail } = await import("@/lib/thumbnail-renderer");
    const result = await renderLottieThumbnail({ fr: 30 }, "/tmp/thumb.png");

    expect(result).toBe(false);
    expect(mockPage.close).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("thumbnail-renderer - getBrowser disconnected event", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resets browserInstance when disconnected fires", async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    const { getBrowser } = await import("@/lib/thumbnail-renderer");

    await getBrowser();

    // Capture the 'disconnected' callback
    const onCall = mockBrowser.on.mock.calls.find(
      (c: unknown[]) => c[0] === "disconnected"
    );
    expect(onCall).toBeDefined();
    const disconnectedCb = onCall![1] as () => void;

    // Fire disconnected - next getBrowser() should relaunch
    disconnectedCb();
    mockBrowser.connected = false;

    (puppeteer.launch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockBrowser
    );
    await getBrowser();
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);

    // Restore for other tests
    mockBrowser.connected = true;
  });
});

describe("thumbnail-renderer - getBrowser launch failure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects and allows retry when launch fails", async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    (puppeteer.launch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("launch failed")
    );

    const { getBrowser } = await import("@/lib/thumbnail-renderer");

    await expect(getBrowser()).rejects.toThrow("launch failed");

    // Subsequent call should retry (browserLaunchPromise was reset to null)
    (puppeteer.launch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockBrowser
    );
    const browser = await getBrowser();
    expect(browser).toBe(mockBrowser);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
  });
});

describe("thumbnail-renderer - concurrent getBrowser calls", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("shares the same launch promise for concurrent calls", async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    mockBrowser.connected = false;

    const { getBrowser } = await import("@/lib/thumbnail-renderer");

    const p1 = getBrowser();
    const p2 = getBrowser();

    const [b1, b2] = await Promise.all([p1, p2]);
    expect(b1).toBe(b2);
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);

    mockBrowser.connected = true;
  });
});

describe("thumbnail-renderer - closeBrowser", () => {
  it("closes browser instance", async () => {
    const { getBrowser, closeBrowser } = await import("@/lib/thumbnail-renderer");
    await getBrowser();
    await closeBrowser();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("does nothing when no browser exists", async () => {
    const { closeBrowser } = await import("@/lib/thumbnail-renderer");
    // Call close twice - second time browserInstance is null
    await closeBrowser();
    mockBrowser.close.mockClear();
    await closeBrowser();
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });
});
