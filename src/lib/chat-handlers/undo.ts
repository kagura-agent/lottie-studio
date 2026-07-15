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
import { detectUndoIntent, type UndoIntent } from "@/lib/undo-intent";

interface VersionRow {
  version_num: number;
  lottie_json: string;
  trigger_message: string | null;
}

function saveMessages(animationId: string, userMsg: string, reply: string, lottieJson?: string) {
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, userMsg);
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, lottieJson || null);
}

function getCurrentVersionNum(animationId: string): number {
  const row = db.prepare(
    "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
  ).get(animationId) as { max_num: number | null } | undefined;
  return row?.max_num ?? 0;
}

function restoreVersion(animationId: string, version: VersionRow, userMsg: string, reply: string): Response {
  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  fs.writeFileSync(animationFile, version.lottie_json);

  const lottieJson = JSON.parse(version.lottie_json);
  updateAnimationMetadata(animationId, lottieJson as Record<string, unknown>);
  saveVersion(animationId, version.lottie_json, userMsg);
  saveMessages(animationId, userMsg, reply, version.lottie_json);
  emitUpdated(animationId);

  return sendDoneEvent({ reply, lottieJson, animationId, versionRestored: version.version_num });
}

function findVersionByNamedRef(animationId: string, namedRef: string): VersionRow | null {
  // Search trigger_message for a matching version, then return the version before it
  const versions = db.prepare(
    "SELECT version_num, lottie_json, trigger_message FROM versions WHERE animation_id = ? ORDER BY version_num ASC"
  ).all(animationId) as VersionRow[];

  for (let i = versions.length - 1; i >= 1; i--) {
    const msg = versions[i].trigger_message?.toLowerCase() || "";
    if (msg.includes(namedRef.toLowerCase())) {
      return versions[i - 1]; // return the version BEFORE the matched change
    }
  }
  return null;
}

export function handleUndo(animationId: string, message: string): Response {
  const intent = detectUndoIntent(message);
  // Fallback: if detectUndoIntent doesn't parse it, treat as simple undo
  const effectiveIntent: UndoIntent = intent || { isUndo: true, isRedo: false };

  const currentVersionNum = getCurrentVersionNum(animationId);

  if (effectiveIntent.isRedo) {
    // Redo: the current version was created by an undo. We can't truly redo in an
    // append-only model, but we look for the version that was undone from.
    // In our model, undo creates version N by copying N-2's JSON. So "redo" means
    // go forward to the version whose JSON differs from current (the one we undid).
    // Simple approach: if the last trigger_message was an undo, go to the version before that undo.
    // For simplicity, we support redo only if the immediately previous version (before the undo
    // version) exists and has different content.
    const steps = effectiveIntent.steps || 1;
    const targetNum = currentVersionNum + steps;

    // In append-only model, there's no "future" version to redo to unless we track undo stack.
    // Instead, look at all versions and see if there was a version saved before the undo that
    // has different JSON (the "undone from" version).
    // Practical approach: walk back to find the last non-undo version.
    // Actually, simplest: "redo" restores the version 2 before current (since undo copies N-1 to N+1)
    // i.e., if user did undo which created v5 from v3's JSON, redo should restore v4's JSON.

    // Find the version that was "undone" - it's the version just before the current one
    // whose JSON differs from the current version.
    if (currentVersionNum < 2) {
      const reply = "Nothing to redo.";
      saveMessages(animationId, message, reply);
      return sendDoneEvent({ reply, animationId });
    }

    // Get the version right before the current (which is what was "undone from")
    const targetVersion = db.prepare(
      "SELECT version_num, lottie_json, trigger_message FROM versions WHERE animation_id = ? AND version_num = ?"
    ).get(animationId, currentVersionNum - 1) as VersionRow | undefined;

    if (!targetVersion) {
      const reply = "Nothing to redo — no forward version found.";
      saveMessages(animationId, message, reply);
      return sendDoneEvent({ reply, animationId });
    }

    // Check if the current version's trigger was an undo (otherwise redo makes no sense)
    const currentVersion = db.prepare(
      "SELECT trigger_message FROM versions WHERE animation_id = ? AND version_num = ?"
    ).get(animationId, currentVersionNum) as { trigger_message: string | null } | undefined;

    const lastTrigger = currentVersion?.trigger_message?.toLowerCase() || "";
    const wasUndo = lastTrigger.includes("undo") || lastTrigger.includes("revert") ||
                    lastTrigger.includes("go back") || lastTrigger.includes("撤销") || lastTrigger.includes("回退");

    if (!wasUndo) {
      const reply = "Nothing to redo — the last change wasn't an undo.";
      saveMessages(animationId, message, reply);
      return sendDoneEvent({ reply, animationId });
    }

    return restoreVersion(animationId, targetVersion, message, `↪️ Redone — restored to v${targetVersion.version_num}.`);
  }

  // Undo logic
  if (effectiveIntent.namedRef) {
    const target = findVersionByNamedRef(animationId, effectiveIntent.namedRef);
    if (!target) {
      const reply = `Couldn't find a version related to "${effectiveIntent.namedRef}".`;
      saveMessages(animationId, message, reply);
      return sendDoneEvent({ reply, animationId });
    }
    return restoreVersion(animationId, target, message, `↩️ Reverted to v${target.version_num} (before "${effectiveIntent.namedRef}").`);
  }

  const steps = effectiveIntent.steps || 1;
  const targetNum = currentVersionNum - steps;

  if (targetNum < 1) {
    const reply = currentVersionNum <= 1
      ? "Nothing to undo — this is the first version."
      : `Cannot undo ${steps} steps — only ${currentVersionNum - 1} previous version(s) available.`;
    saveMessages(animationId, message, reply);
    return sendDoneEvent({ reply, animationId });
  }

  const targetVersion = db.prepare(
    "SELECT version_num, lottie_json, trigger_message FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(animationId, targetNum) as VersionRow | undefined;

  if (!targetVersion) {
    const reply = "Nothing to undo — previous version not found.";
    saveMessages(animationId, message, reply);
    return sendDoneEvent({ reply, animationId });
  }

  const stepText = steps > 1 ? ` ${steps} steps` : "";
  return restoreVersion(animationId, targetVersion, message, `↩️ Reverted${stepText} to v${targetVersion.version_num}.`);
}
