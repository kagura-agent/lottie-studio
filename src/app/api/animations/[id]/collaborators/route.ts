import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const animation = db
      .prepare("SELECT id, user_id FROM animations WHERE id = ?")
      .get(id) as { id: string; user_id: string | null } | undefined;

    if (!animation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = animation.user_id === user.id;

    if (!isOwner) {
      const isMember = db
        .prepare(
          `SELECT 1 FROM collaboration_members cm
           JOIN collaborations c ON c.id = cm.collaboration_id
           WHERE c.animation_id = ? AND cm.user_id = ? AND c.expires_at > datetime('now')`
        )
        .get(id, user.id);

      if (!isMember) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const members = db
      .prepare(
        `SELECT DISTINCT cm.user_id, u.display_name, u.avatar_url, c.permission, cm.last_seen_at
         FROM collaboration_members cm
         JOIN collaborations c ON c.id = cm.collaboration_id
         JOIN users u ON u.id = cm.user_id
         WHERE c.animation_id = ? AND c.expires_at > datetime('now')
         ORDER BY cm.joined_at ASC`
      )
      .all(id) as { user_id: string; display_name: string | null; avatar_url: string | null; permission: string; last_seen_at: string }[];

    const collaborators = members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      permission: m.permission,
      lastSeenAt: m.last_seen_at,
      isOwner: false,
    }));

    if (animation.user_id) {
      const owner = db
        .prepare("SELECT id, display_name, avatar_url FROM users WHERE id = ?")
        .get(animation.user_id) as { id: string; display_name: string | null; avatar_url: string | null } | undefined;

      if (owner) {
        collaborators.unshift({
          userId: owner.id,
          displayName: owner.display_name,
          avatarUrl: owner.avatar_url,
          permission: "owner",
          lastSeenAt: new Date().toISOString(),
          isOwner: true,
        });
      }
    }

    return Response.json({ collaborators });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
