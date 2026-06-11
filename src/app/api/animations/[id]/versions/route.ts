import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface VersionRow {
  id: number;
  version_num: number;
  trigger_message: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(id);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const versions = db.prepare(
    "SELECT id, version_num, trigger_message, created_at FROM versions WHERE animation_id = ? ORDER BY version_num DESC"
  ).all(id) as VersionRow[];

  return Response.json({ versions });
}
