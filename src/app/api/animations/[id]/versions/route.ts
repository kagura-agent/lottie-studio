import { db, ANIMATIONS_DIR } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

interface VersionRow {
  id: number;
  version_num: number;
  lottie_json?: string;
  trigger_message: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(id);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const versions = db.prepare(
    "SELECT id, version_num, trigger_message, created_at FROM versions WHERE animation_id = ? ORDER BY version_num DESC"
  ).all(id) as VersionRow[];

  return Response.json({ versions });
}

interface RestoreBody {
  version_num?: number;
  undo?: boolean;
  steps?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(id);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const body: RestoreBody = await request.json();

  let targetVersionNum: number;

  if (body.version_num != null) {
    targetVersionNum = body.version_num;
  } else if (body.undo) {
    const steps = body.steps || 1;
    const last = db.prepare(
      "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
    ).get(id) as { max_num: number | null } | undefined;
    const current = last?.max_num ?? 0;
    targetVersionNum = current - steps;
    if (targetVersionNum < 1) {
      return Response.json({ error: "Cannot undo that far" }, { status: 400 });
    }
  } else {
    return Response.json({ error: "Provide version_num or undo:true" }, { status: 400 });
  }

  const targetVersion = db.prepare(
    "SELECT version_num, lottie_json FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(id, targetVersionNum) as { version_num: number; lottie_json: string } | undefined;

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
    ).run(id, nextVersion, currentJson, `Snapshot before restoring v${targetVersionNum}`);
  }

  // Restore the target version
  fs.writeFileSync(animationFile, targetVersion.lottie_json);

  const data = JSON.parse(targetVersion.lottie_json);
  const frameCount = data.op ?? data.totalFrames ?? null;
  const frameRate = data.fr ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;
  db.prepare(
    "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(frameCount, durationSeconds, id);

  animationEvents.emit("updated", { animationId: id });

  return Response.json({
    restored: true,
    version_num: targetVersionNum,
    lottie_json: data,
  });
}
