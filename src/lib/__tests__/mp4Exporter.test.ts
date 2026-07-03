// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMP4ExportSupported, formatFileSize, exportToMp4 } from "../mp4Exporter";

// Track mock instances for assertions
let mockMuxerInstance: { addVideoChunk: ReturnType<typeof vi.fn>; finalize: ReturnType<typeof vi.fn> }; // eslint-disable-line @typescript-eslint/no-unused-vars
let mockTargetInstance: { buffer: ArrayBuffer }; // eslint-disable-line @typescript-eslint/no-unused-vars

// Mock mp4-muxer with real classes
vi.mock("mp4-muxer", () => {
  class MockArrayBufferTarget {
    buffer = new ArrayBuffer(1024);
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      mockTargetInstance = this;
    }
  }
  class MockMuxer {
    addVideoChunk = vi.fn();
    finalize = vi.fn();
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      mockMuxerInstance = this;
    }
  }
  return { Muxer: MockMuxer, ArrayBufferTarget: MockArrayBufferTarget };
});

// Mock lottie-web
const mockLottieAnim = {
  goToAndStop: vi.fn(),
  destroy: vi.fn(),
  addEventListener: vi.fn((event: string, cb: () => void) => {
    if (event === "DOMLoaded") {
      setTimeout(cb, 0);
    }
  }),
  renderer: {
    renderFrame: vi.fn(),
  },
};

vi.mock("lottie-web", () => ({
  default: {
    loadAnimation: vi.fn(() => mockLottieAnim),
  },
}));

function makeAnimation(overrides: Record<string, unknown> = {}) {
  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [],
    ...overrides,
  };
}

describe("mp4Exporter", () => {
  describe("isMP4ExportSupported", () => {
    const originalVideoEncoder = (globalThis as Record<string, unknown>).VideoEncoder;

    afterEach(() => {
      if (originalVideoEncoder) {
        (globalThis as Record<string, unknown>).VideoEncoder = originalVideoEncoder;
      } else {
        delete (globalThis as Record<string, unknown>).VideoEncoder;
      }
    });

    it("returns true when VideoEncoder is defined", () => {
      (globalThis as Record<string, unknown>).VideoEncoder = class {};
      expect(isMP4ExportSupported()).toBe(true);
    });

    it("returns false when VideoEncoder is undefined", () => {
      delete (globalThis as Record<string, unknown>).VideoEncoder;
      expect(isMP4ExportSupported()).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes less than 1MB as KB", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(512)).toBe("0.5 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("formats bytes at exactly 1MB boundary as MB", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    });

    it("formats bytes greater than 1MB as MB", () => {
      expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
      expect(formatFileSize(10.7 * 1024 * 1024)).toBe("10.7 MB");
    });

    it("formats zero bytes", () => {
      expect(formatFileSize(0)).toBe("0.0 KB");
    });

    it("formats bytes just below 1MB as KB", () => {
      expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
    });
  });

  describe("exportToMp4", () => {
    let mockCanvas: Record<string, unknown>;
    let mockContainer: Record<string, unknown>;
    let mockEncoderInstance: {
      configure: ReturnType<typeof vi.fn>;
      encode: ReturnType<typeof vi.fn>;
      flush: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      // Reset lottie mock
      mockLottieAnim.goToAndStop.mockClear();
      mockLottieAnim.destroy.mockClear();
      mockLottieAnim.addEventListener.mockClear();
      mockLottieAnim.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === "DOMLoaded") {
          setTimeout(cb, 0);
        }
      });
      mockLottieAnim.renderer.renderFrame.mockClear();

      // Mock canvas element
      mockCanvas = {
        width: 512,
        height: 512,
        getContext: vi.fn(() => ({
          getImageData: vi.fn(() => ({
            data: new Uint8Array(512 * 512 * 4),
            width: 512,
            height: 512,
          })),
        })),
      };

      // Mock container element
      mockContainer = {
        style: {} as CSSStyleDeclaration,
        querySelector: vi.fn(() => mockCanvas),
      };

      vi.spyOn(document, "createElement").mockReturnValue(
        mockContainer as unknown as HTMLElement
      );
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      // Mock VideoEncoder as a class
      mockEncoderInstance = {
        configure: vi.fn(),
        encode: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };

      (globalThis as Record<string, unknown>).VideoEncoder = class {
        configure = mockEncoderInstance.configure;
        encode = mockEncoderInstance.encode;
        flush = mockEncoderInstance.flush;
        close = mockEncoderInstance.close;
        constructor(init: { output: (chunk: unknown, meta: unknown) => void }) {
          // simulate output on encode
          mockEncoderInstance.encode.mockImplementation(() => {
            init.output({ byteLength: 100 }, undefined);
          });
        }
      };

      // Mock VideoFrame as a class
      (globalThis as Record<string, unknown>).VideoFrame = class {
        close = vi.fn();
        constructor() {}
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete (globalThis as Record<string, unknown>).VideoEncoder;
      delete (globalThis as Record<string, unknown>).VideoFrame;
    });

    it("throws when VideoEncoder is not supported", async () => {
      delete (globalThis as Record<string, unknown>).VideoEncoder;

      await expect(
        exportToMp4({ animationData: makeAnimation() })
      ).rejects.toThrow("MP4 export is not supported in this browser");
    });

    it("creates video with correct dimensions from animation data", async () => {
      const anim = makeAnimation({ w: 800, h: 600 });
      await exportToMp4({ animationData: anim });

      expect(mockEncoderInstance.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 800,
          height: 600,
        })
      );
    });

    it("adjusts odd dimensions to even numbers", async () => {
      const anim = makeAnimation({ w: 511, h: 513 });
      await exportToMp4({ animationData: anim });

      expect(mockEncoderInstance.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 512,
          height: 514,
        })
      );
    });

    it("keeps even dimensions unchanged", async () => {
      const anim = makeAnimation({ w: 1024, h: 768 });
      await exportToMp4({ animationData: anim });

      expect(mockEncoderInstance.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1024,
          height: 768,
        })
      );
    });

    it("calls progress callback during encoding", async () => {
      const anim = makeAnimation({ op: 10, ip: 0, fr: 30 }); // 10 frames
      const onProgress = vi.fn();

      await exportToMp4({ animationData: anim, onProgress });

      expect(onProgress).toHaveBeenCalled();
      // Last call should be progress(1)
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(1);
      // Earlier calls should be <= 0.9
      for (let i = 0; i < onProgress.mock.calls.length - 1; i++) {
        expect(onProgress.mock.calls[i][0]).toBeLessThanOrEqual(0.9);
      }
    });

    it("returns a Blob with video/mp4 mime type", async () => {
      const anim = makeAnimation();
      const result = await exportToMp4({ animationData: anim });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe("video/mp4");
    });

    it("uses default dimensions (512x512) when not specified", async () => {
      const anim = { v: "5.7.0", fr: 30, ip: 0, op: 60, layers: [] };
      await exportToMp4({ animationData: anim });

      expect(mockEncoderInstance.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 512,
          height: 512,
        })
      );
    });

    it("cleans up DOM elements on success", async () => {
      const anim = makeAnimation();
      await exportToMp4({ animationData: anim });

      expect(document.body.removeChild).toHaveBeenCalled();
    });

    it("cleans up DOM elements on error", async () => {
      mockContainer.querySelector = vi.fn(() => null);

      const anim = makeAnimation();
      await expect(exportToMp4({ animationData: anim })).rejects.toThrow();
      expect(document.body.removeChild).toHaveBeenCalled();
    });

    it("encodes correct number of frames based on animation length", async () => {
      const anim = makeAnimation({ ip: 0, op: 20, fr: 30 }); // 20 frames
      await exportToMp4({ animationData: anim });

      expect(mockEncoderInstance.encode).toHaveBeenCalledTimes(20);
    });

    it("destroys lottie animation in finally block", async () => {
      const anim = makeAnimation();
      await exportToMp4({ animationData: anim });

      expect(mockLottieAnim.destroy).toHaveBeenCalled();
    });
  });
});
