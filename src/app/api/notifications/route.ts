import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ?")
    .get(user.id) as { count: number };

  const rows = db
    .prepare(
      `SELECT n.id, n.type, n.animation_id, n.comment_id, n.read, n.created_at,
              u.id as actor_id, u.display_name as actor_display_name, u.avatar_url as actor_avatar_url,
              a.name as animation_name
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN animations a ON a.id = n.animation_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(user.id, limit, offset) as {
      id: string;
      type: string;
      animation_id: string | null;
      comment_id: string | null;
      read: number;
      created_at: string;
      actor_id: string;
      actor_display_name: string | null;
      actor_avatar_url: string | null;
      animation_name: string | null;
    }[];

  const notifications = rows.map((row) => ({
    id: row.id,
    type: row.type,
    animationId: row.animation_id,
    commentId: row.comment_id,
    read: row.read === 1,
    createdAt: row.created_at,
    actor: {
      id: row.actor_id,
      displayName: row.actor_display_name,
      avatarUrl: row.actor_avatar_url,
    },
    animationName: row.animation_name,
  }));

  return Response.json({
    notifications,
    total: totalRow.count,
    page,
    totalPages: Math.ceil(totalRow.count / limit),
  });
}
