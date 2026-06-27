import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const collection = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id);

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  const body = await request.json();
  const { animationIds } = body;

  if (!Array.isArray(animationIds) || animationIds.length === 0) {
    return Response.json(
      { error: "animationIds array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Get current max position
  const maxPos = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) as max_pos FROM collection_items WHERE collection_id = ?"
    )
    .get(id) as { max_pos: number };

  let position = maxPos.max_pos + 1;

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO collection_items (collection_id, animation_id, position)
     VALUES (?, ?, ?)`
  );

  const addAll = db.transaction(() => {
    for (const animationId of animationIds) {
      insertStmt.run(id, animationId, position++);
    }
  });

  addAll();

  // Update collection's updated_at
  db.prepare(
    "UPDATE collections SET updated_at = datetime('now') WHERE id = ?"
  ).run(id);

  const items = db
    .prepare(
      `SELECT a.id, a.name, a.frame_count, a.duration_seconds, ci.position
       FROM collection_items ci
       JOIN animations a ON a.id = ci.animation_id
       WHERE ci.collection_id = ?
       ORDER BY ci.position ASC`
    )
    .all(id);

  return Response.json({ items }, { status: 201 });
}
