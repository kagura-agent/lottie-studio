import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id) as Record<string, unknown> | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  let data = null;
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return Response.json({ ...row, data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, data } = body;

  if (data) {
    const frameCount = data.op ?? data.totalFrames ?? null;
    const frameRate = data.fr ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));
    db.prepare(
      "UPDATE animations SET name = COALESCE(?, name), frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, frameCount, durationSeconds, id);
  } else if (name) {
    db.prepare("UPDATE animations SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
  }

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);
  return Response.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM animations WHERE id = ?").run(id);

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return Response.json({ success: true });
}
