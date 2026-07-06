import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  const userExists = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(userId) as { id: string } | undefined;

  if (!userExists) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(_request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "24", 10)));
  const offset = (page - 1) * limit;

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM likes WHERE user_id = ?")
    .get(userId) as { count: number };

  const total = totalRow.count;
  const totalPages = Math.ceil(total / limit);

  const animations = db
    .prepare(
      `SELECT a.id, a.name, a.description, a.created_at, a.frame_count, a.duration_seconds,
              COALESCE(a.like_count, 0) as like_count, COALESCE(a.view_count, 0) as view_count,
              l.created_at as liked_at
       FROM likes l
       JOIN animations a ON a.id = l.animation_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, limit, offset) as {
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      frame_count: number | null;
      duration_seconds: number | null;
      like_count: number;
      view_count: number;
      liked_at: string;
    }[];

  return Response.json({
    animations,
    total,
    page,
    limit,
    totalPages,
  });
}
