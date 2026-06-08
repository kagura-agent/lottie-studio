import GIF from "gif.js";
import lottie, { AnimationItem } from "lottie-web";

interface ExportOptions {
  animationData: object;
  onProgress?: (percent: number) => void;
}

/**
 * Renders a Lottie animation frame-by-frame to an animated GIF.
 * Uses an offscreen canvas with lottie-web's canvas renderer and gif.js for encoding.
 */
export async function exportToGif({
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

  // Target ~20fps for reasonable GIF file size
  const targetFps = Math.min(nativeFps, 20);
  const frameStep = nativeFps / targetFps;
  const delayMs = Math.round(1000 / targetFps);

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

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      workerScript: "/gif.worker.js",
    });

    // Render phase: capture frames (~50% of progress)
    const framesToCapture: number[] = [];
    for (let f = 0; f < totalNativeFrames; f += frameStep) {
      framesToCapture.push(Math.floor(f));
    }

    for (let i = 0; i < framesToCapture.length; i++) {
      anim.goToAndStop(framesToCapture[i], true);

      // Force a synchronous re-render so the canvas is up to date
      if (typeof (anim as unknown as Record<string, unknown>).renderer === "object") {
        const renderer = (anim as unknown as { renderer: { renderFrame: (frame: number) => void } }).renderer;
        renderer.renderFrame(framesToCapture[i]);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas 2d context");
      const imageData = ctx.getImageData(0, 0, width, height);

      gif.addFrame(imageData, { delay: delayMs, copy: true });

      if (onProgress) {
        onProgress(((i + 1) / framesToCapture.length) * 0.5);
      }
    }

    // Encoding phase: gif.js encodes (~50% of progress)
    return await new Promise<Blob>((resolve, reject) => {
      gif.on("progress", (p: number) => {
        if (onProgress) onProgress(0.5 + p * 0.5);
      });
      gif.on("finished", (blob: Blob) => {
        resolve(blob);
      });
      gif.on("abort", () => {
        reject(new Error("GIF encoding was aborted"));
      });
      gif.render();
    });
  } finally {
    if (anim) {
      anim.destroy();
    }
    document.body.removeChild(container);
  }
}
