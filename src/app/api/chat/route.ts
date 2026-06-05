import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletion } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { animationEvents } from "@/lib/events";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

interface ChatRequest {
  animationId?: string;
  message: string;
}

interface MessageRow {
  id: string;
  animation_id: string;
  role: "user" | "assistant";
  content: string;
  lottie_json: string | null;
  created_at: string;
}

export async function POST(request: Request) {
  const body: ChatRequest = await request.json();
  const { message } = body;
  let { animationId } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (animationId) {
    const existing = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!existing) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
  } else {
    animationId = randomUUID();
    const name = message.slice(0, 80).trim() || "Untitled";
    db.prepare(
      "INSERT INTO animations (id, name) VALUES (?, ?)"
    ).run(animationId, name);
  }

  let currentAnimation: object | null = null;
  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  if (fs.existsSync(animationFile)) {
    try {
      currentAnimation = JSON.parse(fs.readFileSync(animationFile, "utf-8"));
    } catch {}
  }

  const history = db.prepare(
    "SELECT role, content FROM messages WHERE animation_id = ? ORDER BY created_at ASC"
  ).all(animationId) as MessageRow[];

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(currentAnimation) },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  let reply: string;
  let lottieJson: object | null;

  try {
    const result = await chatCompletion(messages);
    reply = result.reply;
    lottieJson = result.lottieJson;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `LLM request failed: ${errMsg}` }, { status: 502 });
  }

  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);

  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, lottieJson ? JSON.stringify(lottieJson) : null);

  if (lottieJson) {
    fs.writeFileSync(animationFile, JSON.stringify(lottieJson));

    const lottie = lottieJson as Record<string, unknown>;
    const frameCount = (lottie.op as number) ?? null;
    const frameRate = (lottie.fr as number) ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;

    db.prepare(
      "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(frameCount, durationSeconds, animationId);

    animationEvents.emit("updated", { animationId });
  }

  return Response.json({
    animationId,
    reply,
    animationData: lottieJson,
  });
}
