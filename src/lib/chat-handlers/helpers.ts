import { db, ANIMATIONS_DIR } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
} as const;

const encoder = new TextEncoder();

export function createSSEResponse(body: Uint8Array): Response {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  }), { headers: SSE_HEADERS });
}

export function sendDoneEvent(data: Record<string, unknown>): Response {
  const doneEvent = JSON.stringify({ type: "done", ...data });
  return createSSEResponse(encoder.encode(`data: ${doneEvent}\n\n`));
}

export function encodeSSE(data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

export function saveUserMessage(animationId: string, content: string, imageUrl?: string | null): void {
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, image_url) VALUES (?, ?, 'user', ?, ?)"
  ).run(randomUUID(), animationId, content, imageUrl || null);
}

export function saveAssistantMessage(
  animationId: string,
  content: string,
  lottieJson?: string | null,
  previousLottieJson?: string | null,
): void {
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json, previous_lottie_json) VALUES (?, ?, 'assistant', ?, ?, ?)"
  ).run(randomUUID(), animationId, content, lottieJson || null, previousLottieJson || null);
}

export function updateAnimationMetadata(animationId: string, lottieJson: Record<string, unknown>): void {
  const frameCount = (lottieJson.op as number) ?? null;
  const frameRate = (lottieJson.fr as number) ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;
  db.prepare(
    "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(frameCount, durationSeconds, animationId);
}

export function saveVersion(animationId: string, lottieJsonStr: string, triggerMessage: string): number {
  const lastVersion = db.prepare(
    "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
  ).get(animationId) as { max_num: number | null } | undefined;
  const nextVersion = (lastVersion?.max_num ?? 0) + 1;
  db.prepare(
    "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
  ).run(animationId, nextVersion, lottieJsonStr, triggerMessage);
  return nextVersion;
}

export function emitUpdated(animationId: string): void {
  animationEvents.emit("updated", { animationId });
}

export function readAnimationFile(animationId: string): object | null {
  const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  if (fs.existsSync(animFile)) {
    try {
      return JSON.parse(fs.readFileSync(animFile, "utf-8"));
    } catch {}
  }
  return null;
}

export function readAnimationFileRaw(animationId: string): string | null {
  const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  if (fs.existsSync(animFile)) {
    try {
      return fs.readFileSync(animFile, "utf-8");
    } catch {}
  }
  return null;
}

export function writeAnimationFile(animationId: string, json: object): void {
  const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  fs.writeFileSync(animFile, JSON.stringify(json));
}

export function animationExists(animationId: string): boolean {
  return !!db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
}

export function createStreamingSSEResponse(streamBody: ReadableStream): Response {
  return new Response(streamBody, { headers: SSE_HEADERS });
}
