import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  if (adminIds.length > 0 && !adminIds.includes(user.id)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const tierCounts = db
    .prepare(
      `SELECT COALESCE(api_tier, 'free') as tier, COUNT(*) as count
       FROM users GROUP BY COALESCE(api_tier, 'free')`
    )
    .all() as { tier: string; count: number }[];

  const totalApiCalls = db
    .prepare(`SELECT COUNT(*) as count FROM api_usage`)
    .get() as { count: number };

  const todayCalls = db
    .prepare(
      `SELECT COUNT(*) as count FROM api_usage WHERE timestamp >= datetime('now', 'start of day')`
    )
    .get() as { count: number };

  const topUsers = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, COALESCE(u.api_tier, 'free') as tier,
              COUNT(au.id) as total_calls
       FROM users u
       LEFT JOIN api_usage au ON au.user_id = u.id
       GROUP BY u.id
       ORDER BY total_calls DESC
       LIMIT 20`
    )
    .all() as {
    id: string;
    email: string;
    display_name: string | null;
    tier: string;
    total_calls: number;
  }[];

  return Response.json({
    usersPerTier: tierCounts,
    totalApiCalls: totalApiCalls.count,
    todayApiCalls: todayCalls.count,
    topUsers,
  });
}
