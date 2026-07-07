import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = db
    .prepare("SELECT id, user_id FROM animations WHERE id = ?")
    .get(id) as { id: string; user_id: string | null } | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = getAuthUser(request);
  const viewerId = user?.id ?? null;

  if (viewerId && viewerId === row.user_id) {
    const current = db
      .prepare("SELECT view_count FROM animations WHERE id = ?")
      .get(id) as { view_count: number };
    return Response.json({ view_count: current.view_count ?? 0 });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (viewerId) {
    const existing = db
      .prepare(
        `SELECT id FROM animation_views
         WHERE animation_id = ? AND viewer_id = ? AND date(created_at) = ?`
      )
      .get(id, viewerId, today);

    if (existing) {
      const current = db
        .prepare("SELECT view_count FROM animations WHERE id = ?")
        .get(id) as { view_count: number };
      return Response.json({ view_count: current.view_count ?? 0 });
    }
  }

  db.prepare(
    "INSERT INTO animation_views (animation_id, viewer_id) VALUES (?, ?)"
  ).run(id, viewerId);

  db.prepare(
    "UPDATE animations SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?"
  ).run(id);

  const updated = db
    .prepare("SELECT view_count FROM animations WHERE id = ?")
    .get(id) as { view_count: number };

  return Response.json({ view_count: updated.view_count });
}
