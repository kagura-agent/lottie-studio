import { db, ANIMATIONS_DIR } from "@/lib/db";
import { listLayers, duplicateLayer, deleteLayer, renameLayer } from "@/lib/layer-ops";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
} from "./helpers";

type LayerCommand =
  | { type: "layers" }
  | { type: "duplicate_layer"; name: string }
  | { type: "delete_layer"; name: string }
  | { type: "rename_layer"; oldName: string; newName: string };

export function handleLayerCommand(
  parsedCmd: LayerCommand,
  animationId: string | undefined,
  message: string,
): Response {
  if (parsedCmd.type !== "layers" && !animationId) {
    return sendDoneEvent({ reply: "Cannot modify layers — no current animation. Create an animation first." });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentJson: any = null;
  if (animationId) {
    const existingRow = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!existingRow) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
    if (fs.existsSync(animFile)) {
      try {
        currentJson = JSON.parse(fs.readFileSync(animFile, "utf-8"));
      } catch {}
    }
  }

  if (parsedCmd.type === "layers") {
    const layers = currentJson ? listLayers(currentJson) : [];
    let reply: string;
    if (layers.length === 0) {
      reply = "No layers found in the current animation.";
    } else {
      const lines = layers.map((l, i) =>
        `${i + 1}. **${l.name}** — ${l.typeName} (ind: ${l.index}, frames ${l.inPoint}–${l.outPoint})${l.hidden ? " 🙈 hidden" : ""}${l.parent != null ? ` ↑ parent: ${l.parent}` : ""}`
      );
      reply = `📋 **Layers** (${layers.length}):\n${lines.join("\n")}`;
    }

    if (animationId) {
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
      ).run(randomUUID(), animationId, message);
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
      ).run(randomUUID(), animationId, reply);
    }

    return sendDoneEvent({ reply, animationId: animationId || undefined });
  }

  if (!currentJson) {
    return sendDoneEvent({ reply: "Cannot modify layers — animation has no data yet.", animationId: animationId || undefined });
  }

  let resultAnimation: object;
  let reply: string;

  try {
    if (parsedCmd.type === "duplicate_layer") {
      const result = duplicateLayer(currentJson, parsedCmd.name);
      resultAnimation = result.animation;
      reply = `✨ Duplicated layer "${parsedCmd.name}" → "${result.newLayerName}".`;
    } else if (parsedCmd.type === "delete_layer") {
      resultAnimation = deleteLayer(currentJson, parsedCmd.name);
      reply = `🗑️ Deleted layer "${parsedCmd.name}".`;
    } else {
      const cmd = parsedCmd as { type: "rename_layer"; oldName: string; newName: string };
      resultAnimation = renameLayer(currentJson, cmd.oldName, cmd.newName);
      reply = `✏️ Renamed layer "${cmd.oldName}" → "${cmd.newName}".`;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Layer operation failed";
    return sendDoneEvent({ reply: `⚠️ ${errMsg}`, animationId: animationId || undefined });
  }

  const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  const resultJson = JSON.stringify(resultAnimation);
  fs.writeFileSync(animFile, resultJson);

  updateAnimationMetadata(animationId!, resultAnimation as Record<string, unknown>);
  saveVersion(animationId!, resultJson, message);

  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, resultJson);

  emitUpdated(animationId!);

  return sendDoneEvent({ reply, lottieJson: resultAnimation, animationId });
}
