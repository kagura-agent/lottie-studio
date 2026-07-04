import { db, ANIMATIONS_DIR } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
import _has from "lodash/has";
import _set from "lodash/set";
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
  const { name, data, share_chat } = body;

  if (data) {
    const frameCount = data.op ?? data.totalFrames ?? null;
    const frameRate = data.fr ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;

    fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));
    db.prepare(
      "UPDATE animations SET name = COALESCE(?, name), frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(name, frameCount, durationSeconds, id);

    const thumbnailPath = path.join(process.cwd(), "data", "thumbnails", `${id}.rendered.png`);
    renderLottieThumbnail(data, thumbnailPath).catch((err) =>
      console.error(`[thumbnail] Background generation failed for ${id}:`, err)
    );
  } else if (name) {
    db.prepare("UPDATE animations SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
  }

  if (share_chat !== undefined) {
    db.prepare("UPDATE animations SET share_chat = ? WHERE id = ?").run(share_chat ? 1 : 0, id);
  }

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  animationEvents.emit("updated", { animationId: id });

  return Response.json(row);
}

interface PatchOperation {
  path: string;
  value: unknown;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Animation file not found" }, { status: 404 });
  }

  const body = await request.json();
  const { operations } = body as { operations?: PatchOperation[] };

  if (!Array.isArray(operations) || operations.length === 0) {
    return Response.json(
      { error: "'operations' array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Validate each operation
  for (const op of operations) {
    if (!op.path || op.value === undefined) {
      return Response.json(
        { error: `Invalid operation: 'path' and 'value' are required`, operation: op },
        { status: 400 }
      );
    }
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Validate all paths exist before applying any (atomic)
  const invalidPaths: string[] = [];
  for (const op of operations) {
    if (!_has(data, op.path)) {
      invalidPaths.push(op.path);
    }
  }

  if (invalidPaths.length > 0) {
    return Response.json(
      { error: "Invalid paths: these paths do not exist in the animation", paths: invalidPaths },
      { status: 400 }
    );
  }

  // Apply all operations
  for (const op of operations) {
    _set(data, op.path, op.value);
  }

  // Save updated data
  fs.writeFileSync(filePath, JSON.stringify(data));

  // Update DB metadata
  const frameCount = data.op ?? data.totalFrames ?? null;
  const frameRate = data.fr ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;
  db.prepare(
    "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(frameCount, durationSeconds, id);

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  animationEvents.emit("updated", { animationId: id });

  return Response.json({
    ...row as Record<string, unknown>,
    appliedOperations: operations.length,
  });
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
