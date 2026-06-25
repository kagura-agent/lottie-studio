import UPNG from "upng-js";
import lottie, { AnimationItem } from "lottie-web";

interface ExportOptions {
  animationData: object;
  onProgress?: (percent: number) => void;
}

/**
 * Renders a Lottie animation frame-by-frame to an animated PNG (APNG).
 * Uses an offscreen canvas with lottie-web's canvas renderer and UPNG.js for encoding.
 * Unlike GIF export, APNG supports full alpha transparency and uses native FPS.
 */
export async function exportToApng({
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

  // Use native FPS for full quality (no capping like GIF)
  const delayMs = Math.round(1000 / nativeFps);

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

    // Wait for lottie to finish loading and render the first frame
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Lottie load timeout")), 10000);
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

    // Render phase: capture frames (~80% of progress)
    const frames: ArrayBuffer[] = [];
    const delays: number[] = [];

    for (let f = 0; f < totalNativeFrames; f++) {
      anim.goToAndStop(f, true);

      // Force a synchronous re-render so the canvas is up to date
      if (typeof (anim as unknown as Record<string, unknown>).renderer === "object") {
        const renderer = (anim as unknown as { renderer: { renderFrame: (frame: number) => void } }).renderer;
        renderer.renderFrame(f);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas 2d context");
      const imageData = ctx.getImageData(0, 0, width, height);

      // UPNG expects ArrayBuffer of raw RGBA data
      frames.push(imageData.data.buffer.slice(0));
      delays.push(delayMs);

      if (onProgress) {
        onProgress(((f + 1) / totalNativeFrames) * 0.8);
      }
    }

    // Encoding phase (~20% of progress)
    if (onProgress) onProgress(0.85);

    const apngBuffer = UPNG.encode(frames, width, height, 0, delays);

    if (onProgress) onProgress(1);

    return new Blob([apngBuffer], { type: "image/apng" });
  } finally {
    if (anim) {
      anim.destroy();
    }
    document.body.removeChild(container);
  }
}
