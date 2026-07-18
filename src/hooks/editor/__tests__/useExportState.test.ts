/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportState } from "../useExportState";

// ── Toast mock ──────────────────────────────────────────────
const mockToast = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── rescaleForExport ────────────────────────────────────────
vi.mock("@/lib/rescaleForExport", () => ({
  rescaleForExport: (data: object) => ({ animationData: data }),
}));

// ── exportPresets ───────────────────────────────────────────
vi.mock("@/lib/exportPresets", () => ({
  getPresetFilename: (name: string, preset: { id: string }) =>
    `${name}-${preset.id}.gif`,
}));

// ── Dynamic import mocks ────────────────────────────────────
const mockExportToGif = vi.fn();
const mockExportToApng = vi.fn();
const mockExportToVideo = vi.fn();
const mockGetVideoExtension = vi.fn();
const mockExportToMp4 = vi.fn();
const mockIsMP4ExportSupported = vi.fn();
const mockFormatFileSize = vi.fn();
const mockExportDotLottie = vi.fn();
const mockExportToTgs = vi.fn();

vi.mock("@/lib/gifExporter", () => ({
  exportToGif: (...args: unknown[]) => mockExportToGif(...args),
}));
vi.mock("@/lib/apngExporter", () => ({
  exportToApng: (...args: unknown[]) => mockExportToApng(...args),
}));
vi.mock("@/lib/videoExporter", () => ({
  exportToVideo: (...args: unknown[]) => mockExportToVideo(...args),
  getVideoExtension: () => mockGetVideoExtension(),
}));
vi.mock("@/lib/mp4Exporter", () => ({
  exportToMp4: (...args: unknown[]) => mockExportToMp4(...args),
  isMP4ExportSupported: () => mockIsMP4ExportSupported(),
  formatFileSize: (n: number) => mockFormatFileSize(n),
}));
vi.mock("@/lib/dotlottieExporter", () => ({
  exportDotLottie: (...args: unknown[]) => mockExportDotLottie(...args),
}));
vi.mock("@/lib/tgsExporter", () => ({
  exportToTgs: (...args: unknown[]) => mockExportToTgs(...args),
}));

// ── DOM helpers ─────────────────────────────────────────────
const realCreateElement = document.createElement.bind(document);

function setupDOM() {
  const clickSpy = vi.fn();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      if (tag === "a") {
        return {
          tagName: "A",
          href: "",
          download: "",
          click: clickSpy,
        } as unknown as HTMLAnchorElement;
      }
      return realCreateElement(tag, options);
    },
  );
  return { clickSpy };
}

const animData = { w: 100, h: 100, fr: 30, op: 60, layers: [] };
const mouseEvent = { preventDefault: vi.fn() } as unknown as React.MouseEvent;

/** Find the fake anchor created by our mock (the call where tag === "a") */
function findAnchorResult() {
  const spy = document.createElement as unknown as Mock;
  for (let i = spy.mock.calls.length - 1; i >= 0; i--) {
    if (spy.mock.calls[i][0] === "a") {
      return spy.mock.results[i].value;
    }
  }
  throw new Error("No anchor element created");
}

// ─────────────────────────────────────────────────────────────
describe("useExportState", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-spy console.error to suppress noise
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockToast.mockClear();
    mockExportToGif.mockReset();
    mockExportToApng.mockReset();
    mockExportToVideo.mockReset();
    mockGetVideoExtension.mockReset();
    mockExportToMp4.mockReset();
    mockIsMP4ExportSupported.mockReset();
    mockFormatFileSize.mockReset();
    mockExportDotLottie.mockReset();
    mockExportToTgs.mockReset();
  });

  // ── Initial state ──────────────────────────────────────────
  it("initializes with default values", () => {
    const { result } = renderHook(() => useExportState(null, "test"));
    expect(result.current.gifExporting).toBe(false);
    expect(result.current.gifProgress).toBe(0);
    expect(result.current.apngExporting).toBe(false);
    expect(result.current.apngProgress).toBe(0);
    expect(result.current.videoExporting).toBe(false);
    expect(result.current.videoProgress).toBe(0);
    expect(result.current.mp4Exporting).toBe(false);
    expect(result.current.mp4Progress).toBe(0);
    expect(result.current.presetExporting).toBe(false);
    expect(result.current.presetProgress).toBe(0);
    expect(result.current.presetExportingId).toBeNull();
  });

  // ── sanitizedName (via handleExport download filename) ─────
  describe("sanitizedName", () => {
    it("replaces special characters with underscores", () => {
      const { clickSpy } = setupDOM();
      const { result } = renderHook(() =>
        useExportState(animData, "hello@world#123"),
      );
      act(() => result.current.handleExport());
      expect(clickSpy).toHaveBeenCalled();
      // Find the anchor mock (the call with "a")
      const anchor = findAnchorResult();
      expect(anchor.download).toBe("hello_world_123.json");
    });

    it("falls back to 'animation' for empty name", () => {
      setupDOM();
      const { result } = renderHook(() => useExportState(animData, ""));
      act(() => result.current.handleExport());
      const anchor = findAnchorResult();
      expect(anchor.download).toBe("animation.json");
    });
  });

  // ── handleExport (JSON) ────────────────────────────────────
  describe("handleExport", () => {
    it("does nothing when animationData is null", () => {
      const createSpy = vi.spyOn(URL, "createObjectURL");
      const { result } = renderHook(() => useExportState(null, "test"));
      act(() => result.current.handleExport());
      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });

    it("triggers JSON download for valid data", () => {
      const { clickSpy } = setupDOM();
      const { result } = renderHook(() =>
        useExportState(animData, "my-anim"),
      );
      act(() => result.current.handleExport());
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  // ── handleExportDotLottie ──────────────────────────────────
  describe("handleExportDotLottie", () => {
    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportDotLottie();
      });
      expect(mockExportDotLottie).not.toHaveBeenCalled();
    });

    it("exports .lottie file successfully", async () => {
      const { clickSpy } = setupDOM();
      mockExportDotLottie.mockResolvedValue(new Blob(["lottie"]));
      const { result } = renderHook(() =>
        useExportState(animData, "cool-anim"),
      );
      await act(async () => {
        await result.current.handleExportDotLottie();
      });
      expect(mockExportDotLottie).toHaveBeenCalledWith(
        animData,
        "cool-anim",
      );
      expect(clickSpy).toHaveBeenCalled();
      const anchor = findAnchorResult();
      expect(anchor.download).toBe("cool-anim.lottie");
    });

    it("uses 'animation' when name is empty", async () => {
      setupDOM();
      mockExportDotLottie.mockResolvedValue(new Blob(["lottie"]));
      const { result } = renderHook(() => useExportState(animData, ""));
      await act(async () => {
        await result.current.handleExportDotLottie();
      });
      expect(mockExportDotLottie).toHaveBeenCalledWith(
        animData,
        "animation",
      );
      const anchor = findAnchorResult();
      expect(anchor.download).toBe("animation.lottie");
    });
  });

  // ── handleExportGif ────────────────────────────────────────
  describe("handleExportGif", () => {
    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportGif(mouseEvent);
      });
      expect(mouseEvent.preventDefault).toHaveBeenCalled();
      expect(mockExportToGif).not.toHaveBeenCalled();
    });

    it("exports GIF successfully", async () => {
      const { clickSpy } = setupDOM();
      mockExportToGif.mockResolvedValue(new Blob(["gif"]));
      const { result } = renderHook(() =>
        useExportState(animData, "my-gif"),
      );
      await act(async () => {
        await result.current.handleExportGif(mouseEvent);
      });
      expect(mockExportToGif).toHaveBeenCalledWith({
        animationData: animData,
        onProgress: expect.any(Function),
      });
      expect(clickSpy).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        message: "GIF exported successfully!",
        type: "success",
      });
      expect(result.current.gifExporting).toBe(false);
      expect(result.current.gifProgress).toBe(0);
    });

    it("shows error toast on failure", async () => {
      setupDOM();
      mockExportToGif.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportGif(mouseEvent);
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "GIF export failed. Please try again.",
        type: "error",
      });
      expect(result.current.gifExporting).toBe(false);
    });

    it("guards against duplicate clicks when already exporting", async () => {
      setupDOM();
      // Make the first export hang
      let resolveFirst!: (v: Blob) => void;
      mockExportToGif.mockImplementation(
        () => new Promise<Blob>((r) => (resolveFirst = r)),
      );
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );

      // Start first export (don't await)
      let firstDone = false;
      const p1 = act(async () => {
        await result.current.handleExportGif(mouseEvent);
        firstDone = true;
      });

      // Attempt second export while first is in progress
      await act(async () => {
        await result.current.handleExportGif(mouseEvent);
      });
      // Should only have been called once
      expect(mockExportToGif).toHaveBeenCalledTimes(1);

      // Resolve first
      resolveFirst(new Blob(["gif"]));
      await p1;
      expect(firstDone).toBe(true);
    });
  });

  // ── handleExportApng ───────────────────────────────────────
  describe("handleExportApng", () => {
    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportApng(mouseEvent);
      });
      expect(mockExportToApng).not.toHaveBeenCalled();
    });

    it("exports APNG successfully", async () => {
      const { clickSpy } = setupDOM();
      mockExportToApng.mockResolvedValue(new Blob(["apng"]));
      const { result } = renderHook(() =>
        useExportState(animData, "my-apng"),
      );
      await act(async () => {
        await result.current.handleExportApng(mouseEvent);
      });
      expect(mockExportToApng).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(result.current.apngExporting).toBe(false);
    });

    it("shows error toast on failure", async () => {
      setupDOM();
      mockExportToApng.mockRejectedValue(new Error("fail"));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportApng(mouseEvent);
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "APNG export failed. Please try again.",
        type: "error",
      });
      expect(result.current.apngExporting).toBe(false);
    });
  });

  // ── handleExportVideo ──────────────────────────────────────
  describe("handleExportVideo", () => {
    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportVideo(mouseEvent);
      });
      expect(mockExportToVideo).not.toHaveBeenCalled();
    });

    it("exports video with correct extension", async () => {
      const { clickSpy } = setupDOM();
      mockExportToVideo.mockResolvedValue(new Blob(["video"]));
      mockGetVideoExtension.mockReturnValue("webm");
      const { result } = renderHook(() =>
        useExportState(animData, "my-vid"),
      );
      await act(async () => {
        await result.current.handleExportVideo(mouseEvent);
      });
      expect(mockExportToVideo).toHaveBeenCalled();
      expect(mockGetVideoExtension).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      const anchor = findAnchorResult();
      expect(anchor.download).toBe("my-vid.webm");
      expect(mockToast).toHaveBeenCalledWith({
        message: "Video exported successfully!",
        type: "success",
      });
    });

    it("shows error toast on failure", async () => {
      setupDOM();
      mockExportToVideo.mockRejectedValue(new Error("vid err"));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportVideo(mouseEvent);
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "Video export failed. Please try again.",
        type: "error",
      });
      expect(result.current.videoExporting).toBe(false);
    });
  });

  // ── handleExportMp4 ────────────────────────────────────────
  describe("handleExportMp4", () => {
    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportMp4(mouseEvent);
      });
      expect(mockExportToMp4).not.toHaveBeenCalled();
    });

    it("exports MP4 successfully when supported", async () => {
      const { clickSpy } = setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(true);
      const blob = new Blob(["mp4"]);
      Object.defineProperty(blob, "size", { value: 12345 });
      mockExportToMp4.mockResolvedValue(blob);
      mockFormatFileSize.mockReturnValue("12.1 KB");
      const { result } = renderHook(() =>
        useExportState(animData, "my-mp4"),
      );
      await act(async () => {
        await result.current.handleExportMp4(mouseEvent);
      });
      expect(mockExportToMp4).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(mockFormatFileSize).toHaveBeenCalledWith(12345);
      expect(mockToast).toHaveBeenCalledWith({
        message: "MP4 exported (12.1 KB)",
        type: "success",
      });
    });

    it("shows unsupported browser toast when WebCodecs not available", async () => {
      setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(false);
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportMp4(mouseEvent);
      });
      expect(mockExportToMp4).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        message:
          "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).",
        type: "error",
      });
      // Should reset mp4Exporting even on early return
      expect(result.current.mp4Exporting).toBe(false);
    });

    it("shows Error.message on failure", async () => {
      setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(true);
      mockExportToMp4.mockRejectedValue(new Error("codec error"));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportMp4(mouseEvent);
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "codec error",
        type: "error",
      });
    });

    it("uses fallback message for non-Error exceptions", async () => {
      setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(true);
      mockExportToMp4.mockRejectedValue("string error");
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportMp4(mouseEvent);
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "MP4 export failed. Please try again.",
        type: "error",
      });
    });
  });

  // ── handleExportPreset ─────────────────────────────────────
  describe("handleExportPreset", () => {
    const makePreset = (
      overrides: Partial<{
        id: string;
        format: string;
        platform: string;
        maxFileSize: number;
        width: number;
        height: number;
      }> = {},
    ) => ({
      id: "test-preset",
      nameKey: "test",
      platform: "Test",
      category: "social" as const,
      width: 512,
      height: 512,
      format: "gif" as const,
      fps: 30,
      icon: "🧪",
      ...overrides,
    });

    it("does nothing when animationData is null", async () => {
      const { result } = renderHook(() => useExportState(null, "test"));
      await act(async () => {
        await result.current.handleExportPreset(makePreset());
      });
      expect(mockExportToGif).not.toHaveBeenCalled();
    });

    it("exports JSON preset", async () => {
      const { clickSpy } = setupDOM();
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "json" }),
        );
      });
      expect(clickSpy).toHaveBeenCalled();
      expect(result.current.presetExporting).toBe(false);
      expect(result.current.presetExportingId).toBeNull();
    });

    it("exports dotlottie preset", async () => {
      const { clickSpy } = setupDOM();
      mockExportDotLottie.mockResolvedValue(new Blob(["dl"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "dotlottie" }),
        );
      });
      expect(mockExportDotLottie).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it("exports gif preset without maxFileSize", async () => {
      const { clickSpy } = setupDOM();
      mockExportToGif.mockResolvedValue(new Blob(["gif"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "gif" }),
        );
      });
      expect(mockExportToGif).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it("exports gif preset with maxFileSize (uses exportWithSizeLimit)", async () => {
      setupDOM();
      // First call returns small blob
      mockExportToGif.mockResolvedValue(
        new Blob(["x".repeat(100)]),
      );
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "gif", maxFileSize: 1024 * 1024 }),
        );
      });
      expect(mockExportToGif).toHaveBeenCalled();
    });

    it("exports mp4 preset when supported", async () => {
      const { clickSpy } = setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(true);
      mockExportToMp4.mockResolvedValue(new Blob(["mp4"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "mp4" }),
        );
      });
      expect(mockExportToMp4).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it("shows error for mp4 preset when unsupported", async () => {
      setupDOM();
      mockIsMP4ExportSupported.mockReturnValue(false);
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "mp4" }),
        );
      });
      expect(mockToast).toHaveBeenCalledWith({
        message:
          "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).",
        type: "error",
      });
      expect(mockExportToMp4).not.toHaveBeenCalled();
    });

    it("exports apng preset", async () => {
      const { clickSpy } = setupDOM();
      mockExportToApng.mockResolvedValue(new Blob(["apng"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "apng" }),
        );
      });
      expect(mockExportToApng).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it("exports tgs preset and shows warnings", async () => {
      setupDOM();
      mockExportToTgs.mockResolvedValue({
        blob: new Blob(["tgs"]),
        warnings: ["Sticker too large", "Unsupported feature"],
      });
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "tgs" }),
        );
      });
      expect(mockExportToTgs).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        message: "Sticker too large. Unsupported feature",
        type: "info",
      });
    });

    it("exports tgs preset without warnings", async () => {
      setupDOM();
      mockExportToTgs.mockResolvedValue({
        blob: new Blob(["tgs"]),
        warnings: [],
      });
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "tgs" }),
        );
      });
      expect(mockExportToTgs).toHaveBeenCalled();
      // No info toast when no warnings
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "info" }),
      );
    });

    it("uses fallback format (apng) for unknown format", async () => {
      setupDOM();
      mockExportToApng.mockResolvedValue(new Blob(["fallback"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ format: "webp" as unknown as "gif" }),
        );
      });
      expect(mockExportToApng).toHaveBeenCalled();
    });

    it("shows error toast on preset export failure", async () => {
      setupDOM();
      mockExportToGif.mockRejectedValue(new Error("preset fail"));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ platform: "Instagram" }),
        );
      });
      expect(mockToast).toHaveBeenCalledWith({
        message: "Export failed for Instagram. Please try again.",
        type: "error",
      });
      expect(result.current.presetExporting).toBe(false);
      expect(result.current.presetExportingId).toBeNull();
    });

    it("sets and clears presetExportingId", async () => {
      setupDOM();
      mockExportToGif.mockResolvedValue(new Blob(["done"]));
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );

      await act(async () => {
        await result.current.handleExportPreset(
          makePreset({ id: "my-preset-42" }),
        );
      });

      // After completion, should be cleared
      expect(result.current.presetExportingId).toBeNull();
      expect(result.current.presetExporting).toBe(false);
    });
  });

  // ── exportWithSizeLimit (tested via handleExportPreset gif+maxFileSize) ──
  describe("exportWithSizeLimit", () => {
    it("returns blob immediately when under size limit", async () => {
      setupDOM();
      const smallBlob = new Blob(["small"]);
      Object.defineProperty(smallBlob, "size", { value: 100 });
      mockExportToGif.mockResolvedValue(smallBlob);
      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "size-test",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 1000,
          icon: "🧪",
        });
      });
      // Only called once — no FPS reduction needed
      expect(mockExportToGif).toHaveBeenCalledTimes(1);
    });

    it("tries FPS reduction when blob exceeds size limit", async () => {
      setupDOM();
      const bigBlob = new Blob(["big"]);
      Object.defineProperty(bigBlob, "size", { value: 2000 });
      const okBlob = new Blob(["ok"]);
      Object.defineProperty(okBlob, "size", { value: 500 });

      // First call: too big. Second call (fps=15): fits.
      mockExportToGif
        .mockResolvedValueOnce(bigBlob)
        .mockResolvedValueOnce(okBlob);

      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "fps-reduce",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 1000,
          icon: "🧪",
        });
      });
      // First attempt + at least one FPS reduction attempt
      expect(mockExportToGif.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("returns last blob when all FPS attempts still too large", async () => {
      setupDOM();
      const hugeBlob = new Blob(["huge"]);
      Object.defineProperty(hugeBlob, "size", { value: 9999 });

      // All calls return oversized blob
      mockExportToGif.mockResolvedValue(hugeBlob);

      const { result } = renderHook(() =>
        useExportState(animData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "all-fail",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 100,
          icon: "🧪",
        });
      });
      // Should have tried initial + fps attempts (15, 10, 8, 5 → 4 attempts that are < 30)
      expect(mockExportToGif.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it("skips FPS attempts >= original frame rate", async () => {
      setupDOM();
      const bigBlob = new Blob(["big"]);
      Object.defineProperty(bigBlob, "size", { value: 2000 });

      // Animation with low fps=8 → only fps=5 should be tried
      const lowFpsData = { w: 100, h: 100, fr: 8, op: 60, layers: [] };
      mockExportToGif.mockResolvedValue(bigBlob);

      const { result } = renderHook(() =>
        useExportState(lowFpsData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "low-fps",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 100,
          icon: "🧪",
        });
      });
      // Initial + only fps=5 (since 15, 10, 8 are all >= 8)
      expect(mockExportToGif).toHaveBeenCalledTimes(2);
    });

    it("handles animation data without fr/op/ip fields", async () => {
      setupDOM();
      const bigBlob = new Blob(["big"]);
      Object.defineProperty(bigBlob, "size", { value: 2000 });
      const okBlob = new Blob(["ok"]);
      Object.defineProperty(okBlob, "size", { value: 50 });

      // Data without fr, op, or ip — exercises the || defaults
      const sparseData = { w: 100, h: 100, layers: [{ ty: 1 }] };
      mockExportToGif
        .mockResolvedValueOnce(bigBlob)
        .mockResolvedValueOnce(okBlob);

      const { result } = renderHook(() =>
        useExportState(sparseData, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "sparse",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 100,
          icon: "\uD83E\uDDEA",
        });
      });
      // Should have used default fr=30, and fps=15 < 30 so at least one retry
      expect(mockExportToGif.mock.calls.length).toBeGreaterThanOrEqual(2);
      // Verify adjusted data used default op=60
      const secondCall = mockExportToGif.mock.calls[1][0];
      const adjusted = secondCall.animationData;
      expect(adjusted.fr).toBe(15);
      expect(adjusted.op).toBe(30); // Math.round(60 * 15/30)
    });

    it("handles layers without ip/op fields", async () => {
      setupDOM();
      const bigBlob = new Blob(["big"]);
      Object.defineProperty(bigBlob, "size", { value: 2000 });
      const okBlob = new Blob(["ok"]);
      Object.defineProperty(okBlob, "size", { value: 50 });

      // Layers without ip/op — exercises the typeof checks
      const dataNoLayerTiming = {
        w: 100, h: 100, fr: 30, op: 60,
        layers: [{ ty: 1, nm: "no-timing" }],
      };
      mockExportToGif
        .mockResolvedValueOnce(bigBlob)
        .mockResolvedValueOnce(okBlob);

      const { result } = renderHook(() =>
        useExportState(dataNoLayerTiming, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "no-timing",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 100,
          icon: "\uD83E\uDDEA",
        });
      });
      const secondCall = mockExportToGif.mock.calls[1][0];
      const adjusted = secondCall.animationData;
      // Layers should not have ip/op added
      expect(adjusted.layers[0].ip).toBeUndefined();
      expect(adjusted.layers[0].op).toBeUndefined();
    });

    it("adjusts layer ip/op during FPS reduction", async () => {
      setupDOM();
      const bigBlob = new Blob(["big"]);
      Object.defineProperty(bigBlob, "size", { value: 2000 });
      const okBlob = new Blob(["ok"]);
      Object.defineProperty(okBlob, "size", { value: 50 });

      const dataWithLayers = {
        w: 100,
        h: 100,
        fr: 30,
        op: 60,
        ip: 10,
        layers: [
          { ip: 0, op: 60, ty: 1 },
          { ip: 15, op: 45, ty: 2 },
        ],
      };

      mockExportToGif
        .mockResolvedValueOnce(bigBlob)
        .mockResolvedValueOnce(okBlob);

      const { result } = renderHook(() =>
        useExportState(dataWithLayers, "test"),
      );
      await act(async () => {
        await result.current.handleExportPreset({
          id: "layers",
          nameKey: "t",
          platform: "T",
          category: "social",
          width: 100,
          height: 100,
          format: "gif",
          fps: 30,
          maxFileSize: 100,
          icon: "🧪",
        });
      });
      // Verify second call used adjusted animation data
      const secondCall = mockExportToGif.mock.calls[1][0];
      const adjusted = secondCall.animationData;
      expect(adjusted.fr).toBe(15);
      // op should be scaled: Math.round(60 * 15/30) = 30
      expect(adjusted.op).toBe(30);
      // ip should be scaled: Math.round(10 * 15/30) = 5
      expect(adjusted.ip).toBe(5);
      // Layer ips and ops should be scaled
      expect(adjusted.layers[0].ip).toBe(0);
      expect(adjusted.layers[0].op).toBe(30);
      expect(adjusted.layers[1].ip).toBe(8); // Math.round(15 * 0.5)
      expect(adjusted.layers[1].op).toBe(23); // Math.round(45 * 0.5)
    });
  });
});
