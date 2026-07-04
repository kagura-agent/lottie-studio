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
