import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_COLLABORATORS = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }

    const collab = db
      .prepare(
        `SELECT c.id, c.animation_id, c.permission, c.expires_at
         FROM collaborations c
         WHERE c.token = ? AND c.animation_id = ?`
      )
      .get(token, id) as { id: string; animation_id: string; permission: string; expires_at: string } | undefined;

    if (!collab) {
      return Response.json({ error: "Invalid collaboration token" }, { status: 404 });
    }

    if (new Date(collab.expires_at) <= new Date()) {
      return Response.json({ error: "Collaboration link has expired" }, { status: 410 });
    }

    const memberCount = db
      .prepare("SELECT COUNT(*) as count FROM collaboration_members WHERE collaboration_id = ?")
      .get(collab.id) as { count: number };

    if (memberCount.count >= MAX_COLLABORATORS) {
      return Response.json({ error: "Maximum collaborators reached" }, { status: 409 });
    }

    const memberId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO collaboration_members (id, collaboration_id, user_id)
       VALUES (?, ?, ?)
       ON CONFLICT(collaboration_id, user_id) DO UPDATE SET last_seen_at = datetime('now')`
    ).run(memberId, collab.id, user.id);

    const animation = db
      .prepare("SELECT id, name FROM animations WHERE id = ?")
      .get(id) as { id: string; name: string } | undefined;

    return Response.json({
      collaborationId: collab.id,
      permission: collab.permission,
      animation: animation ? { id: animation.id, name: animation.name } : null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
