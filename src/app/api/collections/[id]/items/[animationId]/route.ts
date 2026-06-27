import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; animationId: string }> }
) {
  const { id, animationId } = await params;

  const collection = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id);

  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }

  const item = db
    .prepare(
      "SELECT * FROM collection_items WHERE collection_id = ? AND animation_id = ?"
    )
    .get(id, animationId);

  if (!item) {
    return Response.json(
      { error: "Animation not in this collection" },
      { status: 404 }
    );
  }

  db.prepare(
    "DELETE FROM collection_items WHERE collection_id = ? AND animation_id = ?"
  ).run(id, animationId);

  // Update collection's updated_at
  db.prepare(
    "UPDATE collections SET updated_at = datetime('now') WHERE id = ?"
  ).run(id);

  return Response.json({ success: true });
}
