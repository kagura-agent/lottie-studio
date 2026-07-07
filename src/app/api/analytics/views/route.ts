import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);

    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "7d";

    let daysBack: number | null;
    switch (period) {
      case "30d":
        daysBack = 30;
        break;
      case "all":
        daysBack = null;
        break;
      default:
        daysBack = 7;
    }

    const userAnimationIds = db
      .prepare("SELECT id FROM animations WHERE user_id = ?")
      .all(user.id) as { id: string }[];

    if (userAnimationIds.length === 0) {
      return Response.json({ views: [] });
    }

    const placeholders = userAnimationIds.map(() => "?").join(",");
    const ids = userAnimationIds.map((r) => r.id);

    let query: string;
    let params: (string | number)[];

    if (daysBack !== null) {
      query = `SELECT date(created_at) as date, COUNT(*) as count
               FROM animation_views
               WHERE animation_id IN (${placeholders})
                 AND created_at >= datetime('now', ?)
               GROUP BY date(created_at)
               ORDER BY date(created_at) ASC`;
      params = [...ids, `-${daysBack} days`];
    } else {
      query = `SELECT date(created_at) as date, COUNT(*) as count
               FROM animation_views
               WHERE animation_id IN (${placeholders})
               GROUP BY date(created_at)
               ORDER BY date(created_at) ASC`;
      params = ids;
    }

    const views = db.prepare(query).all(...params) as {
      date: string;
      count: number;
    }[];

    return Response.json({ views, period });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
