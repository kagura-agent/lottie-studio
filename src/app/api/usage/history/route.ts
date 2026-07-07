import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") ?? "30", 10)));

  const rows = db
    .prepare(
      `SELECT DATE(timestamp) as date,
              COUNT(*) as api_calls,
              SUM(CASE WHEN endpoint = 'generation' THEN 1 ELSE 0 END) as generations,
              SUM(tokens_used) as total_tokens
       FROM api_usage
       WHERE user_id = ? AND timestamp >= datetime('now', ?)
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`
    )
    .all(user.id, `-${days} days`) as {
    date: string;
    api_calls: number;
    generations: number;
    total_tokens: number;
  }[];

  return Response.json({ days, history: rows });
}
