import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function isAdmin(request: Request): boolean {
  const token = request.headers.get("X-Admin-Token");
  const expected = process.env.ADMIN_TOKEN || "admin";
  return token === expected;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, reviewerNotes } = body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const submission = db.prepare("SELECT * FROM template_submissions WHERE id = ?").get(id) as { id: string; animation_id: string } | undefined;
  if (!submission) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }

  db.prepare(
    "UPDATE template_submissions SET status = ?, reviewer_notes = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(status, reviewerNotes || null, id);

  if (status === "approved") {
    db.prepare("UPDATE animations SET share_chat = 1 WHERE id = ?").run(submission.animation_id);
  }

  const updated = db.prepare("SELECT * FROM template_submissions WHERE id = ?").get(id);
  return Response.json(updated);
}
