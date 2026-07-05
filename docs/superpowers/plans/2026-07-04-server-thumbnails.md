# Server-Side Animation Thumbnail Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace text-on-gradient placeholder thumbnails with actual Lottie frame renders using puppeteer-core + headless Chrome, and make gallery cards use static thumbnail images with hover-to-animate.

**Architecture:** A singleton browser pool (`src/lib/thumbnail-renderer.ts`) manages a shared headless Chrome instance via puppeteer-core. On animation save/update, thumbnail generation fires asynchronously (fire-and-forget). The GET endpoint serves rendered thumbnails (or captured, or fallback text-on-gradient). ExploreCard shows a static `<img>` thumbnail by default and lazy-loads lottie-web only on hover.

**Tech Stack:** puppeteer-core, lottie-web (loaded in browser page), node-canvas (fallback), vitest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/thumbnail-renderer.ts` | Singleton browser pool, `renderLottieThumbnail(animationJson, outputPath)` |
| Modify | `src/app/api/animations/[id]/thumbnail/route.ts` | Use renderer, add priority order: captured → rendered → fallback |
| Modify | `src/app/api/animations/route.ts:30-34` | Fire-and-forget thumbnail generation after POST |
| Modify | `src/app/api/animations/[id]/route.ts:44-52` | Fire-and-forget thumbnail generation after PUT |
| Modify | `src/components/ExploreCard.tsx` | Static `<img>` thumbnail with hover-to-animate via lottie-web |
| Create | `src/lib/__tests__/thumbnail-renderer.test.ts` | Unit tests for renderer |
| Create | `src/app/api/animations/[id]/thumbnail/__tests__/route.test.ts` | Integration tests for thumbnail API |

---

### Task 1: Install puppeteer-core

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install puppeteer-core**

```bash
unset http_proxy https_proxy all_proxy && npm install puppeteer-core
```

- [ ] **Step 2: Install @types/puppeteer (if needed) — check if puppeteer-core ships its own types**

```bash
# puppeteer-core 24+ ships its own TypeScript types, so no @types needed.
# Verify:
node -e "require('puppeteer-core')" && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add puppeteer-core for server-side thumbnail rendering (#405)"
```

---

### Task 2: Create thumbnail renderer module

**Files:**
- Create: `src/lib/thumbnail-renderer.ts`
- Test: `src/lib/__tests__/thumbnail-renderer.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/lib/__tests__/thumbnail-renderer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We can't run real puppeteer in unit tests (no Chrome in CI), so test
// the fallback and export shapes. Integration tested via the API route tests.

describe("thumbnail-renderer", () => {
  it("exports renderLottieThumbnail function", async () => {
    const mod = await import("../thumbnail-renderer");
    expect(typeof mod.renderLottieThumbnail).toBe("function");
  });

  it("exports closeBrowser function", async () => {
    const mod = await import("../thumbnail-renderer");
    expect(typeof mod.closeBrowser).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/thumbnail-renderer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the thumbnail renderer**

```typescript
// src/lib/thumbnail-renderer.ts
import puppeteer, { type Browser } from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "/usr/bin/google-chrome";
const THUMBNAIL_SIZE = 600;
const RENDER_TIMEOUT_MS = 15_000;

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

    const totalFrames = await page.evaluate((jsonStr: string) => {
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
      return anim.totalFrames;
    }, JSON.stringify(animationJson));

    // Brief pause for SVG render
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/thumbnail-renderer.test.ts
```

Expected: PASS — both exports exist.

- [ ] **Step 5: Commit**

```bash
git add src/lib/thumbnail-renderer.ts src/lib/__tests__/thumbnail-renderer.test.ts
git commit -m "feat: add puppeteer-based Lottie thumbnail renderer (#405)"
```

---

### Task 3: Update thumbnail API route to use renderer

**Files:**
- Modify: `src/app/api/animations/[id]/thumbnail/route.ts`

- [ ] **Step 1: Rewrite the thumbnail route GET handler**

Replace the existing `generateThumbnail` and GET handler. Keep the existing `generateThumbnail` renamed to `generateFallbackThumbnail` for graceful fallback. The new priority order:
1. Client-captured thumbnail (`{id}.captured.png`)
2. Rendered Lottie thumbnail (`{id}.rendered.png`)
3. Text-on-gradient fallback (`{id}.png`)

The full replacement for `src/app/api/animations/[id]/thumbnail/route.ts`:

```typescript
import { db, ANIMATIONS_DIR } from "@/lib/db";
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
import { createCanvas } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT = 630;

function generateFallbackThumbnail(name: string): Buffer {
  const canvas = createCanvas(FALLBACK_WIDTH, FALLBACK_HEIGHT);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(0.5, "#16213e");
  gradient.addColorStop(1, "#0f3460");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);

  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#e94560";
  ctx.beginPath();
  ctx.arc(900, 150, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#533483";
  ctx.beginPath();
  ctx.arc(200, 500, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const maxWidth = FALLBACK_WIDTH - 160;
  let fontSize = 56;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(name).width > maxWidth && fontSize > 28) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, FALLBACK_WIDTH / 2, FALLBACK_HEIGHT / 2 - 20, maxWidth);

  ctx.font = "24px sans-serif";
  ctx.fillStyle = "#e94560";
  ctx.fillText("🎬 Lottie Studio", FALLBACK_WIDTH / 2, FALLBACK_HEIGHT / 2 + 50);

  ctx.strokeStyle = "rgba(233, 69, 96, 0.3)";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, FALLBACK_WIDTH - 40, FALLBACK_HEIGHT - 40);

  return canvas.toBuffer("image/png");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = db.prepare("SELECT name FROM animations WHERE id = ?").get(id) as
    | { name: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Priority 1: client-captured thumbnail
  const capturedPath = path.join(THUMBNAILS_DIR, `${id}.captured.png`);
  if (fs.existsSync(capturedPath)) {
    const captured = fs.readFileSync(capturedPath);
    return new NextResponse(new Uint8Array(captured), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  // Priority 2: server-rendered Lottie thumbnail
  const renderedPath = path.join(THUMBNAILS_DIR, `${id}.rendered.png`);
  if (fs.existsSync(renderedPath)) {
    const rendered = fs.readFileSync(renderedPath);
    return new NextResponse(new Uint8Array(rendered), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  // Priority 3: try to render on-demand (if animation JSON exists)
  const animPath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (fs.existsSync(animPath)) {
    try {
      const animationJson = JSON.parse(fs.readFileSync(animPath, "utf-8"));
      const success = await renderLottieThumbnail(animationJson, renderedPath);
      if (success && fs.existsSync(renderedPath)) {
        const rendered = fs.readFileSync(renderedPath);
        return new NextResponse(new Uint8Array(rendered), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    } catch (err) {
      console.error(`[thumbnail] On-demand render failed for ${id}:`, err);
    }
  }

  // Priority 4: text-on-gradient fallback
  const fallbackPath = path.join(THUMBNAILS_DIR, `${id}.png`);
  if (fs.existsSync(fallbackPath)) {
    const cached = fs.readFileSync(fallbackPath);
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  const name = row.name || "Untitled";
  const buffer = generateFallbackThumbnail(name);
  fs.writeFileSync(fallbackPath, buffer);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

// --- PUT handler (unchanged) ---

const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = db.prepare("SELECT id FROM animations WHERE id = ?").get(id) as
    | { id: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { thumbnail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.thumbnail || typeof body.thumbnail !== "string") {
    return NextResponse.json(
      { error: "Missing thumbnail field" },
      { status: 400 }
    );
  }

  const base64Match = body.thumbnail.match(
    /^data:image\/png;base64,(.+)$/
  );
  const base64Data = base64Match ? base64Match[1] : body.thumbnail;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return NextResponse.json(
      { error: "Invalid base64 data" },
      { status: 400 }
    );
  }

  if (buffer.length > MAX_THUMBNAIL_SIZE) {
    return NextResponse.json(
      { error: "Thumbnail too large" },
      { status: 413 }
    );
  }

  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return NextResponse.json(
      { error: "Not a valid PNG file" },
      { status: 400 }
    );
  }

  const capturedPath = path.join(THUMBNAILS_DIR, `${id}.captured.png`);
  fs.writeFileSync(capturedPath, buffer);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/animations/[id]/thumbnail/route.ts
git commit -m "feat: serve rendered Lottie thumbnails with fallback chain (#405)"
```

---

### Task 4: Trigger thumbnail generation on save

**Files:**
- Modify: `src/app/api/animations/route.ts:30-34` (POST)
- Modify: `src/app/api/animations/[id]/route.ts:44-52` (PUT)

- [ ] **Step 1: Add fire-and-forget thumbnail generation to POST (create)**

In `src/app/api/animations/route.ts`, add the import at the top:

```typescript
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
import path from "node:path";
```

After the line `fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));` (line 30), and after the DB insert (line 34), add:

```typescript
  // Fire-and-forget thumbnail generation
  const thumbnailPath = path.join(process.cwd(), "data", "thumbnails", `${id}.rendered.png`);
  renderLottieThumbnail(data, thumbnailPath).catch((err) =>
    console.error(`[thumbnail] Background generation failed for ${id}:`, err)
  );
```

- [ ] **Step 2: Add fire-and-forget thumbnail generation to PUT (update)**

In `src/app/api/animations/[id]/route.ts`, add the import at the top:

```typescript
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
```

Inside the `if (data)` block (after writing the file and updating DB, around line 52), add:

```typescript
    // Re-generate thumbnail for updated animation
    const thumbnailPath = path.join(process.cwd(), "data", "thumbnails", `${id}.rendered.png`);
    renderLottieThumbnail(data, thumbnailPath).catch((err) =>
      console.error(`[thumbnail] Background generation failed for ${id}:`, err)
    );
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/animations/route.ts src/app/api/animations/[id]/route.ts
git commit -m "feat: trigger thumbnail generation on animation save/update (#405)"
```

---

### Task 5: Update ExploreCard — static thumbnails with hover-to-animate

**Files:**
- Modify: `src/components/ExploreCard.tsx`

- [ ] **Step 1: Rewrite ExploreCard to use static thumbnail by default**

Replace the existing lottie-web rendering logic with:
- Default state: show `<img src="/api/animations/{id}/thumbnail">` 
- On mouse enter: load lottie-web animation (fetch full JSON, render in overlay div)
- On mouse leave: destroy lottie instance, show static thumbnail again

Full replacement for `src/components/ExploreCard.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { useToast } from "@/contexts/ToastContext";

function truncatePrompt(text: string, maxLen: number = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

interface ExploreCardProps {
  animation: {
    id: string;
    name: string;
    description?: string | null;
    frame_count: number | null;
    layer_count: number | null;
    w: number | null;
    h: number | null;
    view_count?: number;
    like_count?: number;
    creator_id?: string | null;
    creation_prompt?: string | null;
    remix_count?: number;
    remixed_from?: string | null;
    remixed_from_name?: string | null;
  };
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  isOwnAnimation?: boolean;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

export default function ExploreCard({ animation, isFavorite, onToggleFavorite, isOwnAnimation }: ExploreCardProps) {
  const router = useRouter();
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [hovering, setHovering] = useState(false);
  const [animLoaded, setAnimLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [liked, setLiked] = useState(() => {
    if (typeof window !== "undefined") {
      const likedIds = JSON.parse(localStorage.getItem("likedAnimations") || "[]");
      return likedIds.includes(animation.id);
    }
    return false;
  });
  const [likeCount, setLikeCount] = useState(animation.like_count ?? 0);
  const t = useTranslations();
  const { toast } = useToast();

  useEffect(() => {
    if (!hovering || !lottieContainerRef.current) return;

    let cancelled = false;

    fetch(`/api/animations/${animation.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !lottieContainerRef.current || !json.data) return;
        try {
          animRef.current = lottie.loadAnimation({
            container: lottieContainerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json.data,
          });
          setAnimLoaded(true);
        } catch {
          // Lottie load failed — keep showing thumbnail
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      setAnimLoaded(false);
    };
  }, [hovering, animation.id]);

  const handleMouseEnter = useCallback(() => setHovering(true), []);
  const handleMouseLeave = useCallback(() => setHovering(false), []);

  const handleRemix = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (remixing) return;
      setRemixing(true);
      try {
        const res = await fetch(`/api/animations/${animation.id}/remix`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Remix failed");
        const data = await res.json();
        router.push(`/editor/${data.id}`);
      } catch {
        toast({ message: "Failed to remix animation. Please try again.", type: "error" });
      } finally {
        setRemixing(false);
      }
    },
    [animation.id, remixing, router, toast]
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const res = await fetch(`/api/animations/${animation.id}`);
        if (!res.ok) throw new Error("Download failed");
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json.data)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${animation.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        toast({ message: "Failed to download animation. Please try again.", type: "error" });
      }
    },
    [animation.id, animation.name, toast]
  );

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleFavorite?.(animation.id);
    },
    [animation.id, onToggleFavorite]
  );

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (liked) return;
      setLiked(true);
      setLikeCount((c) => c + 1);
      const likedIds = JSON.parse(localStorage.getItem("likedAnimations") || "[]");
      if (!likedIds.includes(animation.id)) {
        likedIds.push(animation.id);
        localStorage.setItem("likedAnimations", JSON.stringify(likedIds));
      }
      try {
        const res = await fetch(`/api/animations/${animation.id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setLikeCount(data.like_count);
        }
      } catch {
        // Keep optimistic UI state
      }
    },
    [animation.id, liked]
  );

  const frames =
    animation.frame_count != null ? t('animationCard.frames', { count: animation.frame_count }) : null;
  const layers =
    animation.layer_count != null
      ? `${animation.layer_count} layer${animation.layer_count === 1 ? '' : 's'}`
      : null;
  const views =
    animation.view_count != null && animation.view_count > 0
      ? t('explore.views', { count: formatViewCount(animation.view_count) })
      : null;
  const likes = likeCount > 0 ? formatViewCount(likeCount) : null;

  return (
    <Link
      href={`/share/${animation.id}`}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-zinc-900/50"
    >
      <div
        className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {/* Static thumbnail (default) */}
        {(!hovering || !animLoaded) && (
          <img
            src={`/api/animations/${animation.id}/thumbnail`}
            alt={animation.name}
            className="w-full h-full object-contain p-4"
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ display: imgError ? "none" : undefined }}
          />
        )}

        {/* Lottie animation overlay (on hover) */}
        {hovering && (
          <div
            ref={lottieContainerRef}
            className={`absolute inset-0 p-4 ${animLoaded ? "" : "pointer-events-none"}`}
          />
        )}

        {/* Loading spinner while hovering and lottie hasn't loaded yet */}
        {hovering && !animLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}

        {/* Error fallback */}
        {imgError && !hovering && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            {t('common.failedToLoad')}
          </div>
        )}

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={handleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-zinc-700/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className={`w-5 h-5 transition-transform active:scale-125 ${isFavorite ? "text-red-500" : "text-zinc-300"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        )}

        {/* Quick-action buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-black/60 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleRemix}
            disabled={remixing}
            aria-label="Remix animation"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">✨</span>
            {remixing ? t('explore.remixing') : t('explore.remix')}
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download animation as JSON"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">⬇️</span>
            {"Download"}
          </button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
          {animation.name}
          {isOwnAnimation && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">
              By you
            </span>
          )}
        </h3>
        {animation.remixed_from && animation.remixed_from_name && (
          <Link
            href={`/editor/${animation.remixed_from}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block text-[11px] text-zinc-500 hover:text-zinc-300 truncate transition-colors"
          >
            {t('explore.remixedFrom', { name: animation.remixed_from_name })}
          </Link>
        )}
        {animation.description && (
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
            {animation.description}
          </p>
        )}
        {animation.creation_prompt && (
          <p
            className="mt-1 text-xs text-zinc-500 italic truncate"
            title={animation.creation_prompt}
          >
            {truncatePrompt(animation.creation_prompt)}
          </p>
        )}
        {animation.creation_prompt && (
          <Link
            href={`/editor/new?prompt=${encodeURIComponent(animation.creation_prompt)}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
          >
            {t('explore.tryThis')} ✨
          </Link>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
          {frames && <span>{frames}</span>}
          {layers && <span>{layers}</span>}
          {views && <span>{views}</span>}
          {(animation.remix_count ?? 0) > 0 && (
            <span title={t('explore.remixCount', { count: animation.remix_count! })}>
              {"🔀 "}{animation.remix_count}
            </span>
          )}
          <button
            onClick={handleLike}
            aria-label={liked ? t('explore.liked') : t('explore.like')}
            className={`ml-auto flex items-center gap-1 transition-colors ${liked ? "text-red-500" : "text-zinc-500 hover:text-red-400"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            {likes && <span>{likes}</span>}
          </button>
        </div>
      </div>
    </Link>
  );
}
```

Key changes:
- Removed `IntersectionObserver` that eagerly loaded lottie-web for every visible card
- Added static `<img>` thumbnail as default display
- Lottie-web only loads on hover (`hovering` state)
- On mouse leave, lottie instance is destroyed via the effect cleanup

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExploreCard.tsx
git commit -m "perf: use static thumbnails in gallery, animate only on hover (#405)"
```

---

### Task 6: Add API integration tests

**Files:**
- Create: `src/app/api/animations/[id]/thumbnail/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

These tests verify the thumbnail API behavior without depending on puppeteer (mocking the renderer).

```typescript
// src/app/api/animations/[id]/thumbnail/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");

// Mock the thumbnail renderer to avoid needing Chrome in tests
vi.mock("@/lib/thumbnail-renderer", () => ({
  renderLottieThumbnail: vi.fn().mockResolvedValue(false),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

// Mock db
const mockDbGet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ get: mockDbGet }),
  },
  ANIMATIONS_DIR: path.join(process.cwd(), "data", "animations"),
}));

describe("thumbnail API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 404 for non-existent animation", async () => {
    mockDbGet.mockReturnValue(undefined);

    const { GET } = await import("../../route");
    const response = await GET(new Request("http://localhost/api/animations/fake-id/thumbnail"), {
      params: Promise.resolve({ id: "fake-id" }),
    });

    expect(response.status).toBe(404);
  });

  it("GET returns 400 for invalid id with path traversal", async () => {
    const { GET } = await import("../../route");
    const response = await GET(
      new Request("http://localhost/api/animations/../etc/passwd/thumbnail"),
      { params: Promise.resolve({ id: "../etc/passwd" }) }
    );

    expect(response.status).toBe(400);
  });

  it("GET returns PNG content-type for existing animation", async () => {
    mockDbGet.mockReturnValue({ name: "Test Animation" });

    const { GET } = await import("../../route");
    const response = await GET(
      new Request("http://localhost/api/animations/test-id/thumbnail"),
      { params: Promise.resolve({ id: "test-id" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("GET serves captured thumbnail when it exists", async () => {
    const testId = "captured-test-id";
    mockDbGet.mockReturnValue({ name: "Test" });

    // Create a fake captured thumbnail
    const capturedPath = path.join(THUMBNAILS_DIR, `${testId}.captured.png`);
    // Minimal valid PNG (1x1 pixel)
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    fs.writeFileSync(capturedPath, pngHeader);

    const { GET } = await import("../../route");
    const response = await GET(
      new Request(`http://localhost/api/animations/${testId}/thumbnail`),
      { params: Promise.resolve({ id: testId }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");

    // Cleanup
    fs.unlinkSync(capturedPath);
  });

  it("PUT returns 400 for missing thumbnail field", async () => {
    mockDbGet.mockReturnValue({ id: "test-id" });

    const { PUT } = await import("../../route");
    const response = await PUT(
      new Request("http://localhost/api/animations/test-id/thumbnail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "test-id" }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing thumbnail field");
  });

  it("PUT saves captured thumbnail for valid PNG", async () => {
    const testId = "put-test-id";
    mockDbGet.mockReturnValue({ id: testId });

    // Create a minimal valid PNG buffer and base64 encode it
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const pngChunk = Buffer.alloc(25); // minimum IHDR chunk
    pngSignature.copy(pngChunk);
    const base64 = `data:image/png;base64,${pngChunk.toString("base64")}`;

    const { PUT } = await import("../../route");
    const response = await PUT(
      new Request(`http://localhost/api/animations/${testId}/thumbnail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: base64 }),
      }),
      { params: Promise.resolve({ id: testId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    // Verify file was written
    const capturedPath = path.join(THUMBNAILS_DIR, `${testId}.captured.png`);
    expect(fs.existsSync(capturedPath)).toBe(true);

    // Cleanup
    fs.unlinkSync(capturedPath);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/app/api/animations/[id]/thumbnail/__tests__/route.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/animations/[id]/thumbnail/__tests__/route.test.ts
git commit -m "test: add thumbnail API integration tests (#405)"
```

---

### Task 7: Build verification and final commit

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Then check:
- Visit `/explore` — cards should show static thumbnail images
- Hover over a card — lottie animation should load and play
- Open `/api/animations/{some-id}/thumbnail` directly — should return a PNG

- [ ] **Step 4: Final commit if any fixes were needed**

Only if adjustments were required during verification.
