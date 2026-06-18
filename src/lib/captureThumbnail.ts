import lottie from "lottie-web";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CAPTURE_SIZE = 512;
const PADDING = 40;
const CAPTURE_TIMEOUT_MS = 5000;
const BG_COLOR = "#18181b"; // zinc-900

/**
 * Capture a thumbnail frame from a Lottie animation at ~30% playback.
 * Renders an offscreen canvas-based lottie instance, composites the frame
 * centered on a 1200×630 dark background suitable for OG share previews.
 *
 * Returns a base64 PNG data URL, or null on failure.
 * Designed to be non-blocking and failure-safe.
 */
export async function captureThumbnail(
  animationData: object
): Promise<string | null> {
  try {
    return await captureFrame(animationData);
  } catch {
    // Silently swallow — thumbnail capture must never break UX
    return null;
  }
}

function captureFrame(animationData: object): Promise<string | null> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.width = `${CAPTURE_SIZE}px`;
    container.style.height = `${CAPTURE_SIZE}px`;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        anim.destroy();
      } catch {
        /* ignore */
      }
      try {
        document.body.removeChild(container);
      } catch {
        /* ignore */
      }
    }

    // Safety timeout — never hang
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, CAPTURE_TIMEOUT_MS);

    const anim = lottie.loadAnimation({
      container,
      renderer: "canvas",
      loop: false,
      autoplay: false,
      animationData,
    });

    anim.addEventListener("DOMLoaded", () => {
      try {
        // Seek to 30% through the animation (more visually interesting)
        const targetFrame = Math.floor(anim.totalFrames * 0.3);
        anim.goToAndStop(targetFrame, true);

        // lottie-web canvas renderer creates a <canvas> inside the container
        const srcCanvas = container.querySelector("canvas");
        if (!srcCanvas) {
          clearTimeout(timer);
          cleanup();
          resolve(null);
          return;
        }

        // Compose the OG-sized preview image
        const ogCanvas = document.createElement("canvas");
        ogCanvas.width = OG_WIDTH;
        ogCanvas.height = OG_HEIGHT;
        const ctx = ogCanvas.getContext("2d");
        if (!ctx) {
          clearTimeout(timer);
          cleanup();
          resolve(null);
          return;
        }

        // Dark background matching the site aesthetic
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

        // Center the captured frame with padding
        const maxW = OG_WIDTH - PADDING * 2;
        const maxH = OG_HEIGHT - PADDING * 2;
        const scale = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height);
        const drawW = srcCanvas.width * scale;
        const drawH = srcCanvas.height * scale;
        const x = (OG_WIDTH - drawW) / 2;
        const y = (OG_HEIGHT - drawH) / 2;

        ctx.drawImage(srcCanvas, x, y, drawW, drawH);

        const dataUrl = ogCanvas.toDataURL("image/png");

        clearTimeout(timer);
        cleanup();
        resolve(dataUrl);
      } catch {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      }
    });

    // Handle load errors
    anim.addEventListener("error", () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    });
  });
}

/**
 * Capture a thumbnail and upload it to the server.
 * Fully non-blocking and failure-safe.
 */
export async function captureAndUploadThumbnail(
  animationId: string,
  animationData: object
): Promise<void> {
  try {
    const dataUrl = await captureThumbnail(animationData);
    if (!dataUrl) return;

    await fetch(`/api/animations/${animationId}/thumbnail`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail: dataUrl }),
    });
  } catch {
    // Silent failure — never break UX for a thumbnail
  }
}
