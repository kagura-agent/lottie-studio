import lottie, { AnimationItem } from "lottie-web";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

interface ExportOptions {
  animationData: object;
  onProgress?: (percent: number) => void;
}

/**
 * Check if the WebCodecs VideoEncoder API is available in this browser.
 */
export function isMP4ExportSupported(): boolean {
  return typeof VideoEncoder !== "undefined";
}

/**
 * Format a file size in bytes to a human-readable string (KB or MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders a Lottie animation frame-by-frame to an MP4 (H.264) video
 * using the WebCodecs VideoEncoder API and mp4-muxer for container muxing.
 */
export async function exportToMp4({
  animationData,
  onProgress,
}: ExportOptions): Promise<Blob> {
  if (!isMP4ExportSupported()) {
    throw new Error(
      "MP4 export is not supported in this browser. Please use Chrome 94+ or Edge 94+."
    );
  }

  const data = animationData as Record<string, unknown>;
  const width = (data.w as number) || 512;
  const height = (data.h as number) || 512;
  const nativeFps = (data.fr as number) || 30;
  const inPoint = (data.ip as number) || 0;
  const outPoint = (data.op as number) || 60;
  const totalNativeFrames = Math.round(outPoint - inPoint);

  // WebCodecs requires even dimensions
  const encodedWidth = width % 2 === 0 ? width : width + 1;
  const encodedHeight = height % 2 === 0 ? height : height + 1;

  // Create offscreen container and canvas for lottie's canvas renderer
  const container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  document.body.appendChild(container);

  let anim: AnimationItem | null = null;

  try {
    anim = lottie.loadAnimation({
      container,
      renderer: "canvas",
      loop: false,
      autoplay: false,
      animationData: structuredClone(animationData),
    });

    // Wait for lottie to finish loading
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Lottie load timeout")),
        10000
      );
      anim!.addEventListener("DOMLoaded", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Get the canvas that lottie created inside the container
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("Lottie canvas renderer did not create a canvas element");
    }

    // Set up mp4-muxer
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: "avc",
        width: encodedWidth,
        height: encodedHeight,
      },
      fastStart: "in-memory",
    });

    // Set up VideoEncoder
    const frameDurationMicros = Math.round(1_000_000 / nativeFps);
    const keyframeInterval = Math.round(nativeFps * 2); // keyframe every 2 seconds

    let encodedFrames = 0;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
        encodedFrames++;
      },
      error: (err) => {
        throw new Error(`VideoEncoder error: ${err.message}`);
      },
    });

    encoder.configure({
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width: encodedWidth,
      height: encodedHeight,
      bitrate: 5_000_000, // 5 Mbps
      framerate: nativeFps,
    });

    // Render frames and encode
    for (let i = 0; i < totalNativeFrames; i++) {
      anim.goToAndStop(i, true);

      // Force synchronous re-render
      if (
        typeof (anim as unknown as Record<string, unknown>).renderer ===
        "object"
      ) {
        const renderer = (
          anim as unknown as {
            renderer: { renderFrame: (frame: number) => void };
          }
        ).renderer;
        renderer.renderFrame(i);
      }

      // Create VideoFrame from canvas
      const frame = new VideoFrame(canvas, {
        timestamp: i * frameDurationMicros,
        duration: frameDurationMicros,
      });

      const keyFrame = i % keyframeInterval === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();

      if (onProgress) {
        onProgress((i + 1) / totalNativeFrames * 0.9);
      }

      // Yield to prevent UI freeze on large animations
      if (i % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Flush encoder and finalize muxer
    await encoder.flush();
    encoder.close();
    muxer.finalize();

    if (onProgress) onProgress(1);

    const buffer = target.buffer;
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    if (anim) {
      anim.destroy();
    }
    document.body.removeChild(container);
  }
}
