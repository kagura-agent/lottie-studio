import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const targetUser = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "24", 10)));
  const offset = (page - 1) * limit;

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM follows WHERE following_id = ?")
    .get(id) as { count: number };
  const total = totalRow.count;

  const followers = db
    .prepare(`
      SELECT u.id, u.display_name, u.avatar_url, f.created_at as followed_at
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(id, limit, offset) as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      followed_at: string;
    }[];

  return Response.json({
    users: followers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
