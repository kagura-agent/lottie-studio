import { db, ANIMATIONS_DIR } from "@/lib/db";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = db
    .prepare("SELECT * FROM animations WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Animation file not found" }, { status: 404 });
  }

  const newId = randomUUID();
  const originalName = row.name as string;
  const newName = `Remix of ${originalName}`;

  // Copy animation JSON file
  const data = fs.readFileSync(filePath, "utf-8");
  fs.writeFileSync(path.join(ANIMATIONS_DIR, `${newId}.json`), data);

  // Insert new animation row with provenance tracking
  db.prepare(
    `INSERT INTO animations (id, name, frame_count, duration_seconds, tags, description, remixed_from)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId,
    newName,
    row.frame_count as number | null,
    row.duration_seconds as number | null,
    row.tags as string | null,
    row.description as string | null,
    id
  );

  // Insert a system message to provide context in the chat
  const messageId = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, animation_id, role, content)
     VALUES (?, ?, 'assistant', ?)`
  ).run(
    messageId,
    newId,
    `This animation was remixed from "${originalName}". Feel free to modify it — try describing changes in the chat!`
  );

  const newRow = db.prepare("SELECT * FROM animations WHERE id = ?").get(newId);
  return Response.json(newRow, { status: 201 });
}
