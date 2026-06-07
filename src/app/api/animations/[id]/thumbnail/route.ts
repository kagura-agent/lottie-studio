import { db, ANIMATIONS_DIR } from "@/lib/db";
import { createCanvas } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const WIDTH = 1200;
const HEIGHT = 630;

function generateThumbnail(name: string): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(0.5, "#16213e");
  gradient.addColorStop(1, "#0f3460");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Decorative circles
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

  // Animation name
  const maxWidth = WIDTH - 160;
  let fontSize = 56;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(name).width > maxWidth && fontSize > 28) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, WIDTH / 2, HEIGHT / 2 - 20, maxWidth);

  // Branding
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "#e94560";
  ctx.fillText("🎬 Lottie Studio", WIDTH / 2, HEIGHT / 2 + 50);

  // Subtle border
  ctx.strokeStyle = "rgba(233, 69, 96, 0.3)";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);

  return canvas.toBuffer("image/png");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate id to prevent path traversal
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check if animation exists
  const row = db.prepare("SELECT name FROM animations WHERE id = ?").get(id) as
    | { name: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check cache
  const cachePath = path.join(THUMBNAILS_DIR, `${id}.png`);
  if (fs.existsSync(cachePath)) {
    const cached = fs.readFileSync(cachePath);
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  // Generate thumbnail
  const name = row.name || "Untitled";
  const buffer = generateThumbnail(name);

  // Cache to filesystem
  fs.writeFileSync(cachePath, buffer);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
