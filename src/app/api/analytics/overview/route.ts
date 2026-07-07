import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);

    const views = db
      .prepare(
        `SELECT COALESCE(SUM(a.view_count), 0) as total
         FROM animations a WHERE a.user_id = ?`
      )
      .get(user.id) as { total: number };

    const animationCount = db
      .prepare("SELECT COUNT(*) as count FROM animations WHERE user_id = ?")
      .get(user.id) as { count: number };

    const likes = db
      .prepare(
        `SELECT COALESCE(SUM(a.like_count), 0) as total
         FROM animations a WHERE a.user_id = ?`
      )
      .get(user.id) as { total: number };

    const comments = db
      .prepare(
        `SELECT COALESCE(SUM(a.comment_count), 0) as total
         FROM animations a WHERE a.user_id = ?`
      )
      .get(user.id) as { total: number };

    const followers = db
      .prepare("SELECT follower_count FROM users WHERE id = ?")
      .get(user.id) as { follower_count: number } | undefined;

    return Response.json({
      totalViews: views.total,
      totalAnimations: animationCount.count,
      totalLikes: likes.total,
      totalComments: comments.total,
      totalFollowers: followers?.follower_count ?? 0,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
