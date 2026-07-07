import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import crypto from "node:crypto";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const animation = db
    .prepare("SELECT id FROM animations WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!animation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM comments WHERE animation_id = ?")
    .get(id) as { count: number };
  const total = totalRow.count;

  const rows = db
    .prepare(
      `SELECT c.id, c.content, c.parent_id, c.created_at, c.updated_at, c.user_id,
              u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.animation_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(id, limit, offset) as {
      id: string;
      content: string;
      parent_id: string | null;
      created_at: string;
      updated_at: string;
      user_id: string;
      display_name: string | null;
      avatar_url: string | null;
    }[];

  const comments = rows.map((row) => ({
    id: row.id,
    content: row.content,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    },
  }));

  return Response.json({
    comments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const animation = db
    .prepare("SELECT id FROM animations WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!animation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { content?: string; parentId?: string };
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

  const parentId = body.parentId ?? null;
  if (parentId) {
    const parent = db
      .prepare("SELECT id, parent_id FROM comments WHERE id = ? AND animation_id = ?")
      .get(parentId, id) as { id: string; parent_id: string | null } | undefined;

    if (!parent) {
      return Response.json({ error: "Parent comment not found" }, { status: 400 });
    }
    if (parent.parent_id) {
      return Response.json({ error: "Cannot reply to a reply" }, { status: 400 });
    }
  }

  const commentId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO comments (id, animation_id, user_id, content, parent_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(commentId, id, user.id, content, parentId);

  db.prepare(
    "UPDATE animations SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = ?"
  ).run(id);

  const owner = db
    .prepare("SELECT creator_id, user_id FROM animations WHERE id = ?")
    .get(id) as { creator_id: string | null; user_id: string | null } | undefined;
  const ownerId = owner?.user_id || owner?.creator_id;
  if (ownerId) {
    createNotification({ userId: ownerId, type: "comment", actorId: user.id, animationId: id, commentId });
  }

  return Response.json({
    id: commentId,
    content,
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
  }, { status: 201 });
}
