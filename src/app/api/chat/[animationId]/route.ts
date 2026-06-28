import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ animationId: string }> }
) {
  const { animationId } = await params;

  const animation = db.prepare("SELECT id, template_source FROM animations WHERE id = ?").get(animationId) as { id: string; template_source: string | null } | undefined;
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const messages = db.prepare(
    "SELECT id, role, content, lottie_json, image_url, created_at FROM messages WHERE animation_id = ? ORDER BY created_at ASC"
  ).all(animationId) as { id: string; role: string; content: string; lottie_json: string | null; image_url: string | null; created_at: string }[];

  const formatted = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    lottieJson: m.lottie_json ? JSON.parse(m.lottie_json) : null,
    imageUrl: m.image_url || undefined,
    createdAt: m.created_at,
  }));

  return Response.json({ animationId, messages: formatted, templateSource: animation.template_source || null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ animationId: string }> }
) {
  const { animationId } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM messages WHERE animation_id = ?").run(animationId);

  return Response.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ animationId: string }> }
) {
  const { animationId } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
  if (!animation) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const body = await request.json();
  const { messageId, newContent } = body;

  if (!messageId || typeof newContent !== "string") {
    return Response.json({ error: "messageId and newContent are required" }, { status: 400 });
  }

  const message = db.prepare(
    "SELECT id, created_at FROM messages WHERE id = ? AND animation_id = ?"
  ).get(messageId, animationId) as { id: string; created_at: string } | undefined;

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  // Delete all messages after this one
  db.prepare(
    "DELETE FROM messages WHERE animation_id = ? AND created_at > ?"
  ).run(animationId, message.created_at);

  // Update the target message content
  db.prepare(
    "UPDATE messages SET content = ? WHERE id = ?"
  ).run(newContent, messageId);

  return Response.json({ success: true });
}
