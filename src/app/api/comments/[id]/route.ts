import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const comment = db
    .prepare("SELECT id, user_id, animation_id FROM comments WHERE id = ?")
    .get(id) as { id: string; user_id: string; animation_id: string } | undefined;

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > 1000) {
    return Response.json({ error: "Content must be 1000 characters or less" }, { status: 400 });
  }

  db.prepare(
    "UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(content, id);

  return Response.json({
    id,
    content,
    updatedAt: new Date().toISOString(),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const comment = db
    .prepare("SELECT id, user_id, animation_id FROM comments WHERE id = ?")
    .get(id) as { id: string; user_id: string; animation_id: string } | undefined;

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const childCount = (db
    .prepare("SELECT COUNT(*) as count FROM comments WHERE parent_id = ?")
    .get(id) as { count: number }).count;

  const deleteCount = 1 + childCount;

  db.prepare("DELETE FROM comments WHERE parent_id = ?").run(id);
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);

  db.prepare(
    "UPDATE animations SET comment_count = MAX(COALESCE(comment_count, 0) - ?, 0) WHERE id = ?"
  ).run(deleteCount, comment.animation_id);

  return Response.json({ success: true });
}
