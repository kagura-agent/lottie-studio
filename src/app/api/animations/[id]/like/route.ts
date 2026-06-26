import { db } from "@/lib/db";
import { extractIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = db
    .prepare("SELECT id, COALESCE(like_count, 0) as like_count FROM animations WHERE id = ?")
    .get(id) as { id: string; like_count: number } | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const ip = extractIp(request);
  const existing = db
    .prepare("SELECT id FROM likes WHERE animation_id = ? AND ip = ?")
    .get(id, ip) as { id: number } | undefined;

  return Response.json({
    liked: !!existing,
    like_count: row.like_count,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = db
    .prepare("SELECT id FROM animations WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const ip = extractIp(request);

  // Check if already liked
  const existing = db
    .prepare("SELECT id FROM likes WHERE animation_id = ? AND ip = ?")
    .get(id, ip) as { id: number } | undefined;

  if (existing) {
    const current = db
      .prepare("SELECT COALESCE(like_count, 0) as like_count FROM animations WHERE id = ?")
      .get(id) as { like_count: number };
    return Response.json({ liked: true, like_count: current.like_count });
  }

  // Insert like and increment count
  db.prepare("INSERT INTO likes (animation_id, ip) VALUES (?, ?)").run(id, ip);
  db.prepare(
    "UPDATE animations SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?"
  ).run(id);

  const updated = db
    .prepare("SELECT COALESCE(like_count, 0) as like_count FROM animations WHERE id = ?")
    .get(id) as { like_count: number };

  return Response.json({ liked: true, like_count: updated.like_count });
}
