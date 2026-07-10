import { db } from "@/lib/db";
import { emitWebhook } from "@/lib/events";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { animationId, title, description, category, tags } = body;

  if (!animationId || !title) {
    return Response.json({ error: "animationId and title are required" }, { status: 400 });
  }

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const tagsStr = Array.isArray(tags) ? tags.join(",") : tags || null;

  db.prepare(
    "INSERT INTO template_submissions (id, animation_id, title, description, category, tags) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, animationId, title, description || null, category || null, tagsStr);

  emitWebhook("template.submitted", { submissionId: id, animationId, title });

  const submission = db.prepare("SELECT * FROM template_submissions WHERE id = ?").get(id);
  return Response.json(submission, { status: 201 });
}
