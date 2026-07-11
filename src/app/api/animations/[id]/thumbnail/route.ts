import { db, ANIMATIONS_DIR } from "@/lib/db";
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT = 630;

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function generateFallbackThumbnail(name: string): Promise<Buffer> {
  const escapedName = escapeXml(name);
  const svg = `<svg width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="50%" stop-color="#16213e"/>
      <stop offset="100%" stop-color="#0f3460"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="900" cy="150" r="200" fill="#e94560" opacity="0.1"/>
  <circle cx="200" cy="500" r="150" fill="#533483" opacity="0.1"/>
  <text x="${FALLBACK_WIDTH / 2}" y="${FALLBACK_HEIGHT / 2 - 20}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-weight="bold" font-size="48" fill="#ffffff">${escapedName}</text>
  <text x="${FALLBACK_WIDTH / 2}" y="${FALLBACK_HEIGHT / 2 + 50}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="24" fill="#e94560">Lottie Studio</text>
  <rect x="20" y="20" width="${FALLBACK_WIDTH - 40}" height="${FALLBACK_HEIGHT - 40}" fill="none" stroke="rgba(233,69,96,0.3)" stroke-width="4"/>
</svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
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
  const buffer = await generateFallbackThumbnail(name);
  fs.writeFileSync(fallbackPath, buffer);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

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
