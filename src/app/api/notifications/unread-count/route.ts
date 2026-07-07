import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const row = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { count: number };

  return Response.json({ count: row.count });
}
