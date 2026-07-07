import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id, token } = await params;

    const animation = db
      .prepare("SELECT id, user_id FROM animations WHERE id = ?")
      .get(id) as { id: string; user_id: string | null } | undefined;

    if (!animation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (animation.user_id !== user.id) {
      return Response.json({ error: "Only the owner can revoke collaborations" }, { status: 403 });
    }

    const collab = db
      .prepare("SELECT id FROM collaborations WHERE token = ? AND animation_id = ?")
      .get(token, id) as { id: string } | undefined;

    if (!collab) {
      return Response.json({ error: "Collaboration not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM collaboration_members WHERE collaboration_id = ?").run(collab.id);
    db.prepare("DELETE FROM collaborations WHERE id = ?").run(collab.id);

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
