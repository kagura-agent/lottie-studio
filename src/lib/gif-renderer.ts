import { getBrowser } from "./thumbnail-renderer";
import fs from "node:fs";
import path from "node:path";

const GIF_SIZE = 480;
const FRAME_COUNT = 20;

let GifEncoder: typeof import("gifencoder") | null = null;
let createCanvas: typeof import("canvas").createCanvas | null = null;

async function loadDeps(): Promise<boolean> {
  if (GifEncoder && createCanvas) return true;
  try {
    GifEncoder = (await import("gifencoder")).default ?? (await import("gifencoder"));
    createCanvas = (await import("canvas")).createCanvas;
    return true;
  } catch (err) {
    console.error("[gif-renderer] Failed to load gifencoder/canvas:", err);
    return false;
  }
}

export async function renderAnimatedPreview(
  animationJson: unknown,
  outputPath: string
): Promise<boolean> {
  if (!await loadDeps()) return false;

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

    const encoder = new GifEncoder!(GIF_SIZE, GIF_SIZE);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const stream = fs.createWriteStream(outputPath);
    encoder.createReadStream().pipe(stream);

    const frameRate = (animationJson as { fr?: number }).fr || 30;
    const duration = totalFrames / frameRate;
    const delay = Math.round((duration * 1000) / FRAME_COUNT);

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(delay);
    encoder.setQuality(10);

    const canvas = createCanvas!(GIF_SIZE, GIF_SIZE);
    const ctx = canvas.getContext("2d");

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
      const img = await (await import("canvas")).loadImage(Buffer.from(screenshot));
      ctx.drawImage(img, 0, 0, GIF_SIZE, GIF_SIZE);
      encoder.addFrame(ctx as unknown as CanvasRenderingContext2D);
    }

    encoder.finish();

    await new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

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
