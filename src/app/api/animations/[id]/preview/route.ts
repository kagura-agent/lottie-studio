import { db, ANIMATIONS_DIR } from "@/lib/db";
import { renderAnimatedPreview } from "@/lib/gif-renderer";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");

export async function GET(
  _request: Request,
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

  const cachedPath = path.join(THUMBNAILS_DIR, `${id}.preview.gif`);
  if (fs.existsSync(cachedPath)) {
    const data = fs.readFileSync(cachedPath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  const animPath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(animPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let animationJson: unknown;
  try {
    animationJson = JSON.parse(fs.readFileSync(animPath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Invalid animation data" }, { status: 500 });
  }

  const success = await renderAnimatedPreview(animationJson, cachedPath);
  if (!success || !fs.existsSync(cachedPath)) {
    console.error(`[preview] GIF render failed for ${id}`);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = fs.readFileSync(cachedPath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
