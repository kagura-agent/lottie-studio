import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import { extractIp } from "@/lib/rateLimit";
import { createNotification } from "@/lib/notifications";

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

  const user = getAuthUser(request);
  let liked = false;

  if (user) {
    const existing = db
      .prepare("SELECT id FROM likes WHERE animation_id = ? AND user_id = ?")
      .get(id, user.id) as { id: number } | undefined;
    liked = !!existing;
  } else {
    const ip = extractIp(request);
    const existing = db
      .prepare("SELECT id FROM likes WHERE animation_id = ? AND ip = ? AND user_id IS NULL")
      .get(id, ip) as { id: number } | undefined;
    liked = !!existing;
  }

  return Response.json({ liked, likeCount: row.like_count });
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

  const user = getAuthUser(request);

  if (user) {
    const existing = db
      .prepare("SELECT id FROM likes WHERE animation_id = ? AND user_id = ?")
      .get(id, user.id) as { id: number } | undefined;

    if (existing) {
      // Unlike — remove the like and decrement count
      db.prepare("DELETE FROM likes WHERE animation_id = ? AND user_id = ?").run(id, user.id);
      db.prepare("UPDATE animations SET like_count = MAX(COALESCE(like_count, 0) - 1, 0) WHERE id = ?").run(id);

      const updated = db
        .prepare("SELECT COALESCE(like_count, 0) as like_count FROM animations WHERE id = ?")
        .get(id) as { like_count: number };

      return Response.json({ liked: false, likeCount: updated.like_count });
    }

    // Like — insert and increment count
    db.prepare("INSERT INTO likes (animation_id, user_id, ip) VALUES (?, ?, '')").run(id, user.id);
    db.prepare("UPDATE animations SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?").run(id);

    const owner = db
      .prepare("SELECT creator_id, user_id FROM animations WHERE id = ?")
      .get(id) as { creator_id: string | null; user_id: string | null } | undefined;
    const ownerId = owner?.user_id || owner?.creator_id;
    if (ownerId) {
      createNotification({ userId: ownerId, type: "like", actorId: user.id, animationId: id });
    }

    const updated = db
      .prepare("SELECT COALESCE(like_count, 0) as like_count FROM animations WHERE id = ?")
      .get(id) as { like_count: number };

    return Response.json({ liked: true, likeCount: updated.like_count });
  }

  // Unauthenticated — require login
  return Response.json({ error: "Authentication required" }, { status: 401 });
}
