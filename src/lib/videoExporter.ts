import lottie, { AnimationItem } from "lottie-web";

interface ExportOptions {
  animationData: object;
  onProgress?: (percent: number) => void;
}

/**
 * Renders a Lottie animation to a WebM video using canvas captureStream() + MediaRecorder.
 * Browser-native approach — no external dependencies needed.
 *
 * Note: MediaRecorder natively supports WebM (VP8/VP9) in most browsers.
 * MP4 (H.264) is not universally supported by MediaRecorder. If you need MP4,
 * consider using ffmpeg.wasm for client-side transcoding or server-side conversion.
 */
export async function exportToVideo({
  animationData,
  onProgress,
}: ExportOptions): Promise<Blob> {
  const data = animationData as Record<string, unknown>;
  const width = (data.w as number) || 512;
  const height = (data.h as number) || 512;
  const nativeFps = (data.fr as number) || 30;
  const inPoint = (data.ip as number) || 0;
  const outPoint = (data.op as number) || 60;
  const totalNativeFrames = Math.round(outPoint - inPoint);
  const durationMs = (totalNativeFrames / nativeFps) * 1000;

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

    // Set up MediaRecorder with captureStream
    const stream = canvas.captureStream(nativeFps);

    // Determine best supported mime type
    const mimeType = getPreferredMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000, // 5 Mbps for good quality
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    // Start recording
    recorder.start();

    // Play the animation frame-by-frame at real-time speed so MediaRecorder captures
    const frameInterval = 1000 / nativeFps;
    let currentFrame = 0;

    await new Promise<void>((resolve) => {
      const renderNextFrame = () => {
        if (currentFrame >= totalNativeFrames) {
          resolve();
          return;
        }

        anim!.goToAndStop(currentFrame, true);

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
          renderer.renderFrame(currentFrame);
        }

        currentFrame++;

        if (onProgress) {
          onProgress((currentFrame / totalNativeFrames) * 0.9);
        }

        setTimeout(renderNextFrame, frameInterval);
      };

      renderNextFrame();
    });

    // Stop recording and collect the result
    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        if (onProgress) onProgress(1);
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };
      recorder.onerror = (e) => {
        reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message || "unknown"}`));
      };
      recorder.stop();
    });
  } finally {
    if (anim) {
      anim.destroy();
    }
    document.body.removeChild(container);
  }
}

/**
 * Returns the best supported video MIME type for MediaRecorder.
 * Prefers VP9 WebM, falls back to VP8 WebM.
 */
function getPreferredMimeType(): string {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback — let the browser decide
  return "video/webm";
}

/**
 * Returns the file extension for the exported video.
 */
export function getVideoExtension(): string {
  return "webm";
}
