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
  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id) as Record<string, unknown> | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Animation file not found" }, { status: 404 });
  }

  const newId = randomUUID();
  const newName = `Copy of ${row.name}`;
  const data = fs.readFileSync(filePath, "utf-8");

  // Write the duplicated animation file
  fs.writeFileSync(path.join(ANIMATIONS_DIR, `${newId}.json`), data);

  // Insert DB record
  db.prepare(
    "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
  ).run(newId, newName, row.frame_count, row.duration_seconds);

  const newRow = db.prepare("SELECT * FROM animations WHERE id = ?").get(newId);

  return Response.json(newRow, { status: 201 });
}
