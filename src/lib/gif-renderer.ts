import { getBrowser } from "./thumbnail-renderer";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const GIF_SIZE = 480;
const FRAME_COUNT = 20;

export async function renderAnimatedPreview(
  animationJson: unknown,
  outputPath: string
): Promise<boolean> {
  let page = null;
  try {
    const jsonStr = JSON.stringify(animationJson);
    if (!jsonStr || jsonStr === "null") return false;

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: GIF_SIZE, height: GIF_SIZE, deviceScaleFactor: 1 });

    const lottieWebPath = path.join(
      process.cwd(), "node_modules", "lottie-web", "build", "player", "lottie.min.js"
    );
    const lottieScript = fs.readFileSync(lottieWebPath, "utf-8");

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { width: ${GIF_SIZE}px; height: ${GIF_SIZE}px; overflow: hidden; background: white; }
          #anim { width: 100%; height: 100%; }
        </style>
      </head>
      <body><div id="anim"></div></body>
      </html>
    `);

    await page.evaluate(lottieScript);

    const totalFrames = await page.evaluate((json: string) => {
      const data = JSON.parse(json);
      const anim = (window as unknown as Record<string, unknown> & {
        lottie: { loadAnimation: (opts: Record<string, unknown>) => { totalFrames: number; goToAndStop: (frame: number, isFrame: boolean) => void } }
      }).lottie.loadAnimation({
        container: document.getElementById("anim")!,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
      });
      (window as unknown as Record<string, unknown>).__anim = anim;
      return anim.totalFrames;
    }, jsonStr);

    if (!totalFrames || totalFrames <= 0) return false;

    const frameRate = (animationJson as { fr?: number }).fr || 30;
    const duration = totalFrames / frameRate;
    const delayMs = Math.round((duration * 1000) / FRAME_COUNT);

    // Capture frames as raw RGBA buffers via sharp
    const rawFrames: Buffer[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const frame = Math.floor((i / FRAME_COUNT) * totalFrames);

      await page.evaluate((f: number) => {
        const anim = (window as unknown as Record<string, unknown>).__anim as {
          goToAndStop: (frame: number, isFrame: boolean) => void;
        };
        anim.goToAndStop(f, true);
      }, frame);

      await new Promise((r) => setTimeout(r, 100));

      const screenshot = await page.screenshot({ type: "png", omitBackground: false });

      // Convert PNG screenshot to raw RGBA buffer at target size
      const rawBuf = await sharp(Buffer.from(screenshot))
        .resize(GIF_SIZE, GIF_SIZE)
        .ensureAlpha()
        .raw()
        .toBuffer();

      rawFrames.push(rawBuf);
    }

    // Stack all frames vertically into one tall raw buffer
    const stacked = Buffer.concat(rawFrames);

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Create animated GIF using sharp
    // sharp interprets the tall image as multi-page when delay array is provided
    await sharp(stacked, {
      raw: {
        width: GIF_SIZE,
        height: GIF_SIZE * FRAME_COUNT,
        channels: 4,
      },
    })
      .gif({
        delay: Array(FRAME_COUNT).fill(delayMs),
        loop: 0,
      })
      .toFile(outputPath);

    return true;
  } catch (err) {
    console.error("[gif-renderer] Failed to render:", err);
    return false;
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}
