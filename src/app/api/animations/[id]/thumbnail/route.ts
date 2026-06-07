import { db, ANIMATIONS_DIR } from "@/lib/db";
import { getThumbnailPath, THUMBNAILS_DIR } from "@/lib/thumbnail";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const THUMB_SIZE = 600;

function generateThumbnail(animationData: Record<string, unknown>): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Lottie = require("lottie-nodejs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("canvas");

  const canvas = createCanvas(THUMB_SIZE, THUMB_SIZE);
  const anim = Lottie.loadAnimation({
    container: canvas,
    renderer: "canvas",
    animationData,
    autoplay: false,
  });
  anim.goToAndStop(0, true);
  const buffer = canvas.toBuffer("image/png");
  anim.destroy();
  return buffer;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);
  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  const thumbPath = getThumbnailPath(id);

  // Return cached thumbnail if it exists
  if (fs.existsSync(thumbPath)) {
    const buffer = fs.readFileSync(thumbPath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Load animation data
  const animPath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(animPath)) {
    return new Response("Animation file not found", { status: 404 });
  }

  const animationData = JSON.parse(fs.readFileSync(animPath, "utf-8"));

  try {
    const buffer = generateThumbnail(animationData);

    // Cache the thumbnail
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    fs.writeFileSync(thumbPath, buffer);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Fallback: generate a branded placeholder with the animation name
    return generateFallbackThumbnail(row as Record<string, unknown>);
  }
}

function generateFallbackThumbnail(row: Record<string, unknown>): Response {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require("canvas");

  const canvas = createCanvas(THUMB_SIZE, THUMB_SIZE);
  const ctx = canvas.getContext("2d");

  // Background gradient
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  // Accent circle
  ctx.beginPath();
  ctx.arc(THUMB_SIZE / 2, THUMB_SIZE / 2 - 40, 80, 0, Math.PI * 2);
  ctx.fillStyle = "#6366f1";
  ctx.fill();

  // Play triangle
  ctx.beginPath();
  ctx.moveTo(THUMB_SIZE / 2 - 25, THUMB_SIZE / 2 - 75);
  ctx.lineTo(THUMB_SIZE / 2 - 25, THUMB_SIZE / 2 - 5);
  ctx.lineTo(THUMB_SIZE / 2 + 35, THUMB_SIZE / 2 - 40);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Animation name
  const name = (row.name as string) || "Untitled";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = THUMB_SIZE - 80;
  const displayName =
    ctx.measureText(name).width > maxWidth
      ? name.slice(0, 30) + "..."
      : name;
  ctx.fillText(displayName, THUMB_SIZE / 2, THUMB_SIZE / 2 + 100);

  // Branding
  ctx.fillStyle = "#9ca3af";
  ctx.font = "18px sans-serif";
  ctx.fillText("Lottie Studio", THUMB_SIZE / 2, THUMB_SIZE / 2 + 145);

  const buffer = canvas.toBuffer("image/png");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
