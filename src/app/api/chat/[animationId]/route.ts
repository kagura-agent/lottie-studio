import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ animationId: string }> }
) {
  const { animationId } = await params;

  const animation = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
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

  return Response.json({ animationId, messages: formatted });
}
