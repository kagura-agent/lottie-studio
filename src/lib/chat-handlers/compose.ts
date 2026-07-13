import { db, ANIMATIONS_DIR } from "@/lib/db";
import { composeLayers } from "@/lib/compose";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
} from "./helpers";

export function handleCompose(animationId: string, sourceId: string, message: string): Response {
  const sourceRow = db.prepare("SELECT id, name FROM animations WHERE id = ?").get(sourceId) as { id: string; name: string } | undefined;
  if (!sourceRow) {
    return sendDoneEvent({ reply: `Source animation "${sourceId}" not found.`, animationId });
  }

  const sourceFile = path.join(ANIMATIONS_DIR, `${sourceId}.json`);
  if (!fs.existsSync(sourceFile)) {
    return sendDoneEvent({ reply: `Source animation "${sourceRow.name}" has no saved JSON file.`, animationId });
  }

  let sourceJson: object;
  try {
    sourceJson = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));
  } catch {
    return sendDoneEvent({ reply: `Failed to parse source animation JSON.`, animationId });
  }

  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  let targetJson: object = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [], assets: [] };
  if (fs.existsSync(animationFile)) {
    try {
      targetJson = JSON.parse(fs.readFileSync(animationFile, "utf-8"));
    } catch {}
  }

  const merged = composeLayers(targetJson, sourceJson);
  const sourceLayerCount = (sourceJson as { layers?: unknown[] }).layers?.length ?? 0;

  fs.writeFileSync(animationFile, JSON.stringify(merged));
  updateAnimationMetadata(animationId, merged as Record<string, unknown>);

  const mergedJson = JSON.stringify(merged);
  saveVersion(animationId, mergedJson, message);

  const reply = `✨ Composed ${sourceLayerCount} layer${sourceLayerCount !== 1 ? "s" : ""} from "${sourceRow.name}" into the current animation.`;
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, mergedJson);

  emitUpdated(animationId);

  return sendDoneEvent({ reply, lottieJson: merged, animationId });
}
