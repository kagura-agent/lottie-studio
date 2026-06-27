import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return Response.json(
      { error: "creator_id query parameter is required" },
      { status: 400 }
    );
  }

  const rows = db
    .prepare(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) as item_count
       FROM collections c 
       WHERE c.creator_id = ? 
       ORDER BY c.updated_at DESC`
    )
    .all(creatorId);

  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, creator_id, is_public } = body;

  if (!name || !creator_id) {
    return Response.json(
      { error: "name and creator_id are required" },
      { status: 400 }
    );
  }

  const id = randomUUID();

  db.prepare(
    `INSERT INTO collections (id, name, description, creator_id, is_public)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, description || "", creator_id, is_public ? 1 : 0);

  const row = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
  return Response.json(row, { status: 201 });
}
