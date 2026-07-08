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

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const tier = url.searchParams.get("tier") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: string[] = [];

  if (status) {
    conditions.push("s.status = ?");
    params.push(status);
  }
  if (tier) {
    conditions.push("s.tier = ?");
    params.push(tier);
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM subscriptions s ${whereClause}`)
    .get(...params) as { count: number };

  const subscriptions = db
    .prepare(
      `SELECT s.*, u.email, u.display_name
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Record<string, unknown>[];

  return Response.json({
    subscriptions,
    total: totalRow.count,
    page,
    limit,
    totalPages: Math.ceil(totalRow.count / limit),
  });
}
