import puppeteer, { type Browser } from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "/usr/bin/google-chrome";
const THUMBNAIL_SIZE = 600;

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;

  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = puppeteer
    .launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    })
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;

      browser.on("disconnected", () => {
        browserInstance = null;
      });

      return browser;
    })
    .catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });

  return browserLaunchPromise;
}

export async function renderLottieThumbnail(
  animationJson: unknown,
  outputPath: string
): Promise<boolean> {
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      deviceScaleFactor: 1,
    });

    const lottieWebPath = path.join(
      process.cwd(),
      "node_modules",
      "lottie-web",
      "build",
      "player",
      "lottie.min.js"
    );
    const lottieScript = fs.readFileSync(lottieWebPath, "utf-8");

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { width: ${THUMBNAIL_SIZE}px; height: ${THUMBNAIL_SIZE}px; overflow: hidden; background: transparent; }
          #anim { width: 100%; height: 100%; }
        </style>
      </head>
      <body><div id="anim"></div></body>
      </html>
    `);

    await page.evaluate(lottieScript);

    await page.evaluate((jsonStr: string) => {
      const data = JSON.parse(jsonStr);
      const anim = (window as unknown as Record<string, unknown> & { lottie: { loadAnimation: (opts: Record<string, unknown>) => { totalFrames: number; goToAndStop: (frame: number, isFrame: boolean) => void } } }).lottie.loadAnimation({
        container: document.getElementById("anim")!,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
      });
      const targetFrame = Math.floor(anim.totalFrames * 0.25);
      anim.goToAndStop(targetFrame, true);
    }, JSON.stringify(animationJson));

    await new Promise((r) => setTimeout(r, 200));

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
    });

    return true;
  } catch (err) {
    console.error("[thumbnail-renderer] Failed to render:", err);
    return false;
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
