import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const targetUser = db
    .prepare("SELECT id, COALESCE(follower_count, 0) as follower_count FROM users WHERE id = ?")
    .get(id) as { id: string; follower_count: number } | undefined;

  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const user = getAuthUser(request);
  let following = false;

  if (user) {
    const existing = db
      .prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?")
      .get(user.id, id) as { id: string } | undefined;
    following = !!existing;
  }

  return Response.json({ following, followerCount: targetUser.follower_count });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (user.id === id) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const targetUser = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?")
    .get(user.id, id) as { id: string } | undefined;

  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(user.id, id);
    db.prepare("UPDATE users SET follower_count = MAX(COALESCE(follower_count, 0) - 1, 0) WHERE id = ?").run(id);
    db.prepare("UPDATE users SET following_count = MAX(COALESCE(following_count, 0) - 1, 0) WHERE id = ?").run(user.id);

    const updated = db
      .prepare("SELECT COALESCE(follower_count, 0) as follower_count FROM users WHERE id = ?")
      .get(id) as { follower_count: number };

    return Response.json({ following: false, followerCount: updated.follower_count });
  }

  const followId = crypto.randomUUID();
  db.prepare("INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)").run(followId, user.id, id);
  db.prepare("UPDATE users SET follower_count = COALESCE(follower_count, 0) + 1 WHERE id = ?").run(id);
  db.prepare("UPDATE users SET following_count = COALESCE(following_count, 0) + 1 WHERE id = ?").run(user.id);

  const updated = db
    .prepare("SELECT COALESCE(follower_count, 0) as follower_count FROM users WHERE id = ?")
    .get(id) as { follower_count: number };

  return Response.json({ following: true, followerCount: updated.follower_count });
}
