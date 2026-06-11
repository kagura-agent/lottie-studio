import { db, ANIMATIONS_DIR } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

interface VersionRow {
  id: number;
  animation_id: string;
  version_num: number;
  lottie_json: string;
  trigger_message: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; num: string }> }
) {
  const { id, num } = await params;
  const versionNum = parseInt(num, 10);

  if (isNaN(versionNum)) {
    return Response.json({ error: "Invalid version number" }, { status: 400 });
  }

  const version = db.prepare(
    "SELECT id, version_num, lottie_json, trigger_message, created_at FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(id, versionNum) as VersionRow | undefined;

  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  return Response.json({
    id: version.id,
    version_num: version.version_num,
    lottie_json: JSON.parse(version.lottie_json),
    trigger_message: version.trigger_message,
    created_at: version.created_at,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; num: string }> }
) {
  const { id, num } = await params;
  const versionNum = parseInt(num, 10);

  if (isNaN(versionNum)) {
    return Response.json({ error: "Invalid version number" }, { status: 400 });
  }

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(id);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const targetVersion = db.prepare(
    "SELECT lottie_json FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(id, versionNum) as { lottie_json: string } | undefined;

  if (!targetVersion) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const animationFile = path.join(ANIMATIONS_DIR, `${id}.json`);

  // Save current state as a new version before restoring
  if (fs.existsSync(animationFile)) {
    const currentJson = fs.readFileSync(animationFile, "utf-8");
    const lastVersion = db.prepare(
      "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
    ).get(id) as { max_num: number | null } | undefined;
    const nextVersion = (lastVersion?.max_num ?? 0) + 1;
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(id, nextVersion, currentJson, `Snapshot before restoring v${versionNum}`);
  }

  // Restore the target version
  const restoredJson = targetVersion.lottie_json;
  fs.writeFileSync(animationFile, restoredJson);

  // Update animation metadata
  const data = JSON.parse(restoredJson);
  const frameCount = data.op ?? data.totalFrames ?? null;
  const frameRate = data.fr ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;
  db.prepare(
    "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(frameCount, durationSeconds, id);

  // Fire WebSocket event
  animationEvents.emit("updated", { animationId: id });

  return Response.json({
    restored: true,
    version_num: versionNum,
    lottie_json: data,
  });
}
