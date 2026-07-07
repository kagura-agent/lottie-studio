import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const plugins = db
    .prepare(
      `SELECT p.*, pi.installed_at, pi.enabled
       FROM plugin_installs pi
       JOIN plugins p ON p.id = pi.plugin_id
       WHERE pi.user_id = ?
       ORDER BY pi.installed_at DESC`
    )
    .all(user.id);

  return Response.json(plugins);
}
