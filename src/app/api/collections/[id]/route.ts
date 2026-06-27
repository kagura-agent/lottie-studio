import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const collection = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!collection) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const items = db
    .prepare(
      `SELECT a.id, a.name, a.frame_count, a.duration_seconds, a.created_at, a.description, a.tags, ci.position, ci.added_at
       FROM collection_items ci
       JOIN animations a ON a.id = ci.animation_id
       WHERE ci.collection_id = ?
       ORDER BY ci.position ASC, ci.added_at ASC`
    )
    .all(id);

  return Response.json({ ...collection, animations: items });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id);

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, is_public, cover_animation_id } = body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(description);
  }
  if (is_public !== undefined) {
    updates.push("is_public = ?");
    values.push(is_public ? 1 : 0);
  }
  if (cover_animation_id !== undefined) {
    updates.push("cover_animation_id = ?");
    values.push(cover_animation_id);
  }

  if (updates.length === 0) {
    return Response.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(
    `UPDATE collections SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values);

  const row = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
  return Response.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id);

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Delete collection items first (cascade should handle it, but be explicit)
  db.prepare("DELETE FROM collection_items WHERE collection_id = ?").run(id);
  db.prepare("DELETE FROM collections WHERE id = ?").run(id);

  return Response.json({ success: true });
}
