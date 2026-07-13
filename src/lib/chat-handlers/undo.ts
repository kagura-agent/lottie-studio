import { db, ANIMATIONS_DIR } from "@/lib/db";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
} from "./helpers";

export function handleUndo(animationId: string, message: string): Response {
  const lastVersion = db.prepare(
    "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
  ).get(animationId) as { max_num: number | null } | undefined;

  const currentVersionNum = lastVersion?.max_num ?? 0;

  if (currentVersionNum <= 1) {
    const reply = "Nothing to undo — this is the first version.";
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);
    return sendDoneEvent({ reply, animationId });
  }

  const prevVersion = db.prepare(
    "SELECT lottie_json FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(animationId, currentVersionNum - 1) as { lottie_json: string } | undefined;

  if (!prevVersion) {
    const reply = "Nothing to undo — previous version not found.";
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);
    return sendDoneEvent({ reply, animationId });
  }

  const lottieJson = JSON.parse(prevVersion.lottie_json);

  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  fs.writeFileSync(animationFile, prevVersion.lottie_json);

  updateAnimationMetadata(animationId, lottieJson as Record<string, unknown>);

  const reply = "↩️ Reverted to the previous version.";
  saveVersion(animationId, prevVersion.lottie_json, message);

  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, prevVersion.lottie_json);

  emitUpdated(animationId);

  return sendDoneEvent({ reply, lottieJson, animationId });
}
