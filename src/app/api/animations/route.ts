import { db, ANIMATIONS_DIR } from "@/lib/db";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db.prepare("SELECT id, name, created_at, updated_at, frame_count, duration_seconds FROM animations ORDER BY created_at DESC").all();
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, data, templateName, templateDesc } = body;

  if (!name || !data) {
    return Response.json({ error: "name and data are required" }, { status: 400 });
  }

  const id = randomUUID();
  const frameCount = data.op ?? data.totalFrames ?? null;
  const frameRate = data.fr ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;

  fs.writeFileSync(path.join(ANIMATIONS_DIR, `${id}.json`), JSON.stringify(data));

  db.prepare(
    "INSERT INTO animations (id, name, frame_count, duration_seconds, template_source) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, frameCount, durationSeconds, templateName || null);

  // Persist seed assistant message when created from a template
  if (templateName) {
    const msgId = randomUUID();
    const content = `I loaded the **${templateName}** template — ${templateDesc || "a starter animation"}. Tell me what you'd like to change!`;
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(msgId, id, content);
  }

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);
  return Response.json(row, { status: 201 });
}
