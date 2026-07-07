import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
    const offset = (page - 1) * limit;

    const totalRow = db
      .prepare("SELECT COUNT(*) as count FROM animations WHERE user_id = ?")
      .get(user.id) as { count: number };

    const animations = db
      .prepare(
        `SELECT a.id, a.name, a.view_count, a.like_count, a.comment_count, a.created_at
         FROM animations a
         WHERE a.user_id = ?
         ORDER BY a.view_count DESC, a.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(user.id, limit, offset) as {
      id: string;
      name: string;
      view_count: number;
      like_count: number;
      comment_count: number;
      created_at: string;
    }[];

    return Response.json({
      animations,
      total: totalRow.count,
      page,
      totalPages: Math.ceil(totalRow.count / limit),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
