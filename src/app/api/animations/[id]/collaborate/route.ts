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

    const animation = db
      .prepare("SELECT id, user_id FROM animations WHERE id = ?")
      .get(id) as { id: string; user_id: string | null } | undefined;

    if (!animation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (animation.user_id !== user.id) {
      return Response.json({ error: "Only the owner can create collaboration links" }, { status: 403 });
    }

    let body: { permission?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const permission = body.permission;
    if (permission !== "edit" && permission !== "view") {
      return Response.json({ error: "Permission must be 'edit' or 'view'" }, { status: 400 });
    }

    const collabId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO collaborations (id, animation_id, token, permission, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(collabId, id, token, permission, user.id, expiresAt);

    const url = `/editor/${id}?collab=${token}`;

    return Response.json({ token, url, permission, expiresAt }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

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

    if (animation.user_id !== user.id) {
      return Response.json({ error: "Only the owner can list collaborations" }, { status: 403 });
    }

    const rows = db
      .prepare(
        `SELECT c.id, c.token, c.permission, c.expires_at,
                (SELECT COUNT(*) FROM collaboration_members cm WHERE cm.collaboration_id = c.id) as member_count
         FROM collaborations c
         WHERE c.animation_id = ? AND c.expires_at > datetime('now')
         ORDER BY c.created_at DESC`
      )
      .all(id) as { id: string; token: string; permission: string; expires_at: string; member_count: number }[];

    const collaborations = rows.map((row) => ({
      id: row.id,
      token: row.token,
      permission: row.permission,
      expiresAt: row.expires_at,
      memberCount: row.member_count,
    }));

    return Response.json({ collaborations, maxCollaborators: MAX_COLLABORATORS });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
