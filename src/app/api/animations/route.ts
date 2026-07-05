import { db, ANIMATIONS_DIR } from "@/lib/db";
import { renderLottieThumbnail } from "@/lib/thumbnail-renderer";
import { getAuthUser } from "@/lib/auth-middleware";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine");

  if (mine === "true") {
    const user = getAuthUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const rows = db
      .prepare(
        "SELECT id, name, description, created_at, updated_at, frame_count, duration_seconds FROM animations WHERE user_id = ? AND frame_count IS NOT NULL ORDER BY created_at DESC"
      )
      .all(user.id);
    return Response.json(rows);
  }

  const rows = db.prepare("SELECT id, name, description, created_at, updated_at, frame_count, duration_seconds FROM animations WHERE frame_count IS NOT NULL ORDER BY created_at DESC").all();
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, data, templateName, templateDesc, importMessage } = body;

  if (!name || !data) {
    return Response.json({ error: "name and data are required" }, { status: 400 });
  }

  // Read creator identity headers
  const creatorId = request.headers.get("x-creator-id") || null;
  const creatorName = request.headers.get("x-creator-name") || null;

  // Set user_id if authenticated
  const authUser = getAuthUser(request);
  const userId = authUser?.id || null;

  const id = randomUUID();
  const frameCount = data.op ?? data.totalFrames ?? null;
  const frameRate = data.fr ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;

  fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));

  db.prepare(
    "INSERT INTO animations (id, name, frame_count, duration_seconds, template_source, creator_id, creator_name, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name, frameCount, durationSeconds, templateName || null, creatorId, creatorName, userId);

  const thumbnailPath = path.join(process.cwd(), "data", "thumbnails", `${id}.rendered.png`);
  renderLottieThumbnail(data, thumbnailPath).catch((err) =>
    console.error(`[thumbnail] Background generation failed for ${id}:`, err)
  );

  // Persist seed assistant message when created from a template
  if (templateName) {
    const msgId = randomUUID();
    const content = `I loaded the **${templateName}** template — ${templateDesc || "a starter animation"}. Tell me what you'd like to change!`;
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(msgId, id, content);
  }

  // Persist seed assistant message for file imports
  if (importMessage) {
    const msgId = randomUUID();
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(msgId, id, importMessage);
  }

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);
  return Response.json(row, { status: 201 });
}
