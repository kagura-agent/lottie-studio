import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = db
    .prepare("SELECT id FROM animations WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare(
    "UPDATE animations SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?"
  ).run(id);

  const updated = db
    .prepare("SELECT view_count FROM animations WHERE id = ?")
    .get(id) as { view_count: number };

  return Response.json({ view_count: updated.view_count });
}
