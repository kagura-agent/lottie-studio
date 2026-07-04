import { db, ANIMATIONS_DIR, getAllPresets, getPresetByName, createPreset, deletePresetByName, renamePreset } from "@/lib/db";
import { chatCompletionStream, chatCompletionRepairStream, parseResponse } from "@/lib/llm";
import { buildSystemPrompt, buildDesignTokensPrompt, buildPresetPrompt } from "@/lib/prompts";
import { compactHistory, isUndoIntent } from "@/lib/chat-utils";
import type { MessageRow } from "@/lib/chat-utils";
import { animationEvents } from "@/lib/events";
import { inferTags, serializeTags } from "@/lib/tag-inference";
import { extractDescription } from "@/lib/description";
import extractTitle from "@/lib/titleExtractor";
import { extractIp, checkRate } from "@/lib/rateLimit";
import { roundDecimals, removeEmptyGroups, removeHiddenLayers, validateAndFix } from "@/lib/optimizer";
import { parseCommand } from "@/lib/commands";
import { composeLayers } from "@/lib/compose";
import { sequenceLayers } from "@/lib/sequence";
import { listLayers, duplicateLayer, deleteLayer, renameLayer } from "@/lib/layer-ops";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

interface ChatRequest {
  animationId?: string;
  message: string;
  image?: string; // base64 data URL for image attachment
  regenerate?: boolean; // true when regenerating the last assistant response
  designTokens?: { primary?: string; secondary?: string; accent?: string; background?: string; font?: string };
}

/**
 * Handle undo/revert intent: restore previous version without calling the LLM.
 */
function handleUndo(animationId: string, message: string): Response {
  const encoder = new TextEncoder();

  // Find the previous version (second-to-last)
  const lastVersion = db.prepare(
    "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
  ).get(animationId) as { max_num: number | null } | undefined;

  const currentVersionNum = lastVersion?.max_num ?? 0;

  if (currentVersionNum <= 1) {
    // No previous version to revert to
    const reply = "Nothing to undo \u2014 this is the first version.";

    // Save user message and assistant reply
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);

    const doneEvent = JSON.stringify({ type: "done", reply, animationId });
    const body = encoder.encode(`data: ${doneEvent}\n\n`);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      }
    }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // Get the previous version
  const prevVersion = db.prepare(
    "SELECT lottie_json FROM versions WHERE animation_id = ? AND version_num = ?"
  ).get(animationId, currentVersionNum - 1) as { lottie_json: string } | undefined;

  if (!prevVersion) {
    // Shouldn't happen, but handle gracefully
    const reply = "Nothing to undo \u2014 previous version not found.";
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);

    const doneEvent = JSON.stringify({ type: "done", reply, animationId });
    const body = encoder.encode(`data: ${doneEvent}\n\n`);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      }
    }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  const lottieJson = JSON.parse(prevVersion.lottie_json);

  // Restore animation file
  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  fs.writeFileSync(animationFile, prevVersion.lottie_json);

  // Update animations table metadata
  const lottie = lottieJson as Record<string, unknown>;
  const frameCount = (lottie.op as number) ?? null;
  const frameRate = (lottie.fr as number) ?? 30;
  const durationSeconds = frameCount != null ? frameCount / frameRate : null;
  db.prepare(
    "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(frameCount, durationSeconds, animationId);

  // Save the revert as a new version (so further undo is possible)
  const nextVersion = currentVersionNum + 1;
  const reply = "\u21a9\ufe0f Reverted to the previous version.";
  db.prepare(
    "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
  ).run(animationId, nextVersion, prevVersion.lottie_json, message);

  // Save messages
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);
  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
  ).run(randomUUID(), animationId, reply, prevVersion.lottie_json);

  // Emit update event
  animationEvents.emit("updated", { animationId });

  const doneEvent = JSON.stringify({ type: "done", reply, lottieJson, animationId });
  const body = encoder.encode(`data: ${doneEvent}\n\n`);
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  }), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const ip = extractIp(request);
  const rate = checkRate(ip);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: "Too many requests, slow down 🌸", retryAfterSec: rate.retryAfterSec }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body: ChatRequest = await request.json();
  const { message, image, regenerate } = body;
  let { animationId } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // --- Undo intent detection (before LLM call) ---
  if (isUndoIntent(message)) {
    if (!animationId) {
      // No animation context — cannot undo
      const encoder = new TextEncoder();
      const reply = "Cannot undo \u2014 no saved animation to revert.";
      const doneEvent = JSON.stringify({ type: "done", reply });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
    const existing = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!existing) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    return handleUndo(animationId, message);
  }

  // --- Compose command detection (before LLM call) ---
  const parsedCmd = parseCommand(message);
  if (parsedCmd && parsedCmd.type === "compose") {
    if (!animationId) {
      const encoder = new TextEncoder();
      const reply = "Cannot compose — no current animation to compose into. Create an animation first.";
      const doneEvent = JSON.stringify({ type: "done", reply });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const encoder = new TextEncoder();
    const sourceId = parsedCmd.id;

    // Verify target animation exists
    const targetRow = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!targetRow) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }

    // Fetch source animation from DB
    const sourceRow = db.prepare("SELECT id, name FROM animations WHERE id = ?").get(sourceId) as { id: string; name: string } | undefined;
    if (!sourceRow) {
      const reply = `Source animation "${sourceId}" not found.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Read source animation JSON from disk
    const sourceFile = path.join(ANIMATIONS_DIR, `${sourceId}.json`);
    if (!fs.existsSync(sourceFile)) {
      const reply = `Source animation "${sourceRow.name}" has no saved JSON file.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    let sourceJson: object;
    try {
      sourceJson = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));
    } catch {
      const reply = `Failed to parse source animation JSON.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Read current target animation
    const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
    let targetJson: object = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [], assets: [] };
    if (fs.existsSync(animationFile)) {
      try {
        targetJson = JSON.parse(fs.readFileSync(animationFile, "utf-8"));
      } catch {}
    }

    // Compose layers
    const merged = composeLayers(targetJson, sourceJson);
    const sourceLayerCount = (sourceJson as { layers?: unknown[] }).layers?.length ?? 0;

    // Save merged result
    fs.writeFileSync(animationFile, JSON.stringify(merged));

    // Update DB metadata
    const lottie = merged as Record<string, unknown>;
    const frameCount = (lottie.op as number) ?? null;
    const frameRate = (lottie.fr as number) ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;
    db.prepare(
      "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(frameCount, durationSeconds, animationId);

    // Save version
    const lastVersion = db.prepare(
      "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
    ).get(animationId) as { max_num: number | null } | undefined;
    const nextVersion = (lastVersion?.max_num ?? 0) + 1;
    const mergedJson = JSON.stringify(merged);
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(animationId, nextVersion, mergedJson, message);

    // Save messages
    const reply = `\u2728 Composed ${sourceLayerCount} layer${sourceLayerCount !== 1 ? "s" : ""} from "${sourceRow.name}" into the current animation.`;
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(randomUUID(), animationId, reply, mergedJson);

    // Emit update event
    animationEvents.emit("updated", { animationId });

    const doneEvent = JSON.stringify({ type: "done", reply, lottieJson: merged, animationId });
    const body = encoder.encode(`data: ${doneEvent}\n\n`);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      }
    }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // --- Sequence command detection (before LLM call) ---
  if (parsedCmd && parsedCmd.type === "sequence") {
    if (!animationId) {
      const encoder = new TextEncoder();
      const reply = "Cannot sequence — no current animation to append to. Create an animation first.";
      const doneEvent = JSON.stringify({ type: "done", reply });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const encoder = new TextEncoder();
    const sourceId = parsedCmd.id;

    // Verify target animation exists
    const targetRow = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!targetRow) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }

    // Fetch source animation from DB
    const sourceRow = db.prepare("SELECT id, name FROM animations WHERE id = ?").get(sourceId) as { id: string; name: string } | undefined;
    if (!sourceRow) {
      const reply = `Source animation "${sourceId}" not found.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Read source animation JSON from disk
    const sourceFile = path.join(ANIMATIONS_DIR, `${sourceId}.json`);
    if (!fs.existsSync(sourceFile)) {
      const reply = `Source animation "${sourceRow.name}" has no saved JSON file.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    let sourceJson: object;
    try {
      sourceJson = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));
    } catch {
      const reply = `Failed to parse source animation JSON.`;
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Read current target animation
    const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
    let targetJson: object = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [], assets: [] };
    if (fs.existsSync(animationFile)) {
      try {
        targetJson = JSON.parse(fs.readFileSync(animationFile, "utf-8"));
      } catch {}
    }

    // Sequence layers (append source after target temporally)
    const merged = sequenceLayers(targetJson, sourceJson);
    const sourceLayerCount = (sourceJson as { layers?: unknown[] }).layers?.length ?? 0;

    // Save merged result
    fs.writeFileSync(animationFile, JSON.stringify(merged));

    // Update DB metadata
    const lottie = merged as Record<string, unknown>;
    const frameCount = (lottie.op as number) ?? null;
    const frameRate = (lottie.fr as number) ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;
    db.prepare(
      "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(frameCount, durationSeconds, animationId);

    // Save version
    const lastVersion = db.prepare(
      "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
    ).get(animationId) as { max_num: number | null } | undefined;
    const nextVersion = (lastVersion?.max_num ?? 0) + 1;
    const mergedJson = JSON.stringify(merged);
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(animationId, nextVersion, mergedJson, message);

    // Save messages
    const reply = `\u2728 Sequenced ${sourceLayerCount} layer${sourceLayerCount !== 1 ? "s" : ""} from "${sourceRow.name}" — appended after the current animation.`;
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(randomUUID(), animationId, reply, mergedJson);

    // Emit update event
    animationEvents.emit("updated", { animationId });

    const doneEvent = JSON.stringify({ type: "done", reply, lottieJson: merged, animationId });
    const body = encoder.encode(`data: ${doneEvent}\n\n`);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      }
    }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // --- Layer commands (before LLM call) ---
  if (parsedCmd && (parsedCmd.type === "layers" || parsedCmd.type === "duplicate_layer" || parsedCmd.type === "delete_layer" || parsedCmd.type === "rename_layer")) {
    const encoder = new TextEncoder();

    // /layers does not require an animation
    if (parsedCmd.type !== "layers" && !animationId) {
      const reply = "Cannot modify layers — no current animation. Create an animation first.";
      const doneEvent = JSON.stringify({ type: "done", reply });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Read current animation for all layer commands
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

      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For mutation commands, we need an animation with data
    if (!currentJson) {
      const reply = "Cannot modify layers — animation has no data yet.";
      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
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
        // rename_layer
        const cmd = parsedCmd as { type: "rename_layer"; oldName: string; newName: string };
        resultAnimation = renameLayer(currentJson, cmd.oldName, cmd.newName);
        reply = `✏️ Renamed layer "${cmd.oldName}" → "${cmd.newName}".`;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Layer operation failed";
      const doneEvent = JSON.stringify({ type: "done", reply: `⚠️ ${errMsg}`, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Save result
    const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
    const resultJson = JSON.stringify(resultAnimation);
    fs.writeFileSync(animFile, resultJson);

    // Update DB metadata
    const lottie = resultAnimation as Record<string, unknown>;
    const frameCount = (lottie.op as number) ?? null;
    const frameRate = (lottie.fr as number) ?? 30;
    const durationSeconds = frameCount != null ? frameCount / frameRate : null;
    db.prepare(
      "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(frameCount, durationSeconds, animationId);

    // Save version
    const lastVersion = db.prepare(
      "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
    ).get(animationId) as { max_num: number | null } | undefined;
    const nextVersion = (lastVersion?.max_num ?? 0) + 1;
    db.prepare(
      "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
    ).run(animationId, nextVersion, resultJson, message);

    // Save messages
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(randomUUID(), animationId, reply, resultJson);

    // Emit update event
    animationEvents.emit("updated", { animationId });

    const doneEvent = JSON.stringify({ type: "done", reply, lottieJson: resultAnimation, animationId });
    const body = encoder.encode(`data: ${doneEvent}\n\n`);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      }
    }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // --- Critique command handling (before LLM call) ---
  if (parsedCmd && parsedCmd.type === "critique") {
    const encoder = new TextEncoder();

    if (!animationId) {
      const reply = "Create an animation first, then I can critique it.";
      const doneEvent = JSON.stringify({ type: "done", reply });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const existing = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!existing) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }

    const animFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
    let animJson: string | null = null;
    if (fs.existsSync(animFile)) {
      try {
        animJson = fs.readFileSync(animFile, "utf-8");
      } catch {}
    }

    if (!animJson) {
      const reply = "Create an animation first, then I can critique it.";
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
      ).run(randomUUID(), animationId, message);
      db.prepare(
        "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
      ).run(randomUUID(), animationId, reply);
      const doneEvent = JSON.stringify({ type: "done", reply, animationId });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const critiqueSystemPrompt = `You are an expert motion designer and Lottie animation reviewer. The user wants a critique of their current animation. Analyze the provided Lottie JSON and give structured, actionable feedback.

Use these severity indicators:
- 🟢 for things that are done well
- 🟡 for things that could be improved
- 🔴 for issues that should be fixed

Structure your response with these sections:

**Timing & Easing** — Evaluate the use of easing curves, duration, and rhythm. Are keyframes well-timed? Is the pacing natural?

**Visual Hierarchy** — Assess the composition, layering, and visual weight. Do the right elements draw attention?

**Motion Principles** — Check for anticipation, follow-through, overshoot, secondary motion, and squash-and-stretch. Is the motion believable and expressive?

**Performance** — Comment on shape count, keyframe density, layer count, and overall complexity. Will this animate smoothly?

**Top Suggestions** — List 2-3 specific, actionable improvements the user could make.

Be honest but constructive. Reference specific layers by name when possible. Do NOT generate any Lottie JSON — this is analysis only.`;

    const critiqueMessages = [
      { role: "system" as const, content: critiqueSystemPrompt },
      { role: "user" as const, content: `Here is the Lottie JSON to critique:\n\n\`\`\`json\n${animJson}\n\`\`\`` },
    ];

    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);

    let llmResponse: Response;
    try {
      llmResponse = await chatCompletionStream(critiqueMessages);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: `LLM request failed: ${errMsg}` }, { status: 502 });
    }

    const llmBody = llmResponse.body;
    if (!llmBody) {
      return Response.json({ error: "LLM returned no body" }, { status: 502 });
    }

    const capturedAnimationId = animationId;

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        const reader = llmBody.getReader();
        let accumulated = "";
        let sseBuffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  accumulated += content;
                  const chunk = JSON.stringify({ type: "token", text: content });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }

          const reply = accumulated.trim() || "Unable to generate critique.";

          db.prepare(
            "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
          ).run(randomUUID(), capturedAnimationId, reply);

          const doneEvent = JSON.stringify({ type: "done", reply, animationId: capturedAnimationId });
          controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Stream processing error";
          const errorEvent = JSON.stringify({ type: "error", error: errMsg });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // --- Presets command handling (before LLM call) ---
  if (parsedCmd && parsedCmd.type === "presets") {
    const encoder = new TextEncoder();

    if (parsedCmd.subcommand === "list") {
      // List all presets — no LLM call needed
      const presets = getAllPresets();
      let reply: string;
      if (presets.length === 0) {
        reply = "No presets available yet. Use `/presets save <name>` after creating an animation to save the current motion as a preset.";
      } else {
        const lines = presets.map(
          (p) => `- **${p.name}**${p.description ? ` — ${p.description}` : ""}${p.is_builtin ? " _(built-in)_" : ""}`
        );
        reply = `Available presets:\n${lines.join("\n")}\n\nTo apply a preset, just say "apply bounce" or describe the style you want.`;
      }

      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "save") {
      const presetName = parsedCmd.subcommand.name;
      const presetDescription = parsedCmd.subcommand.description || null;
      const creatorIdHeader = request.headers.get("x-creator-id") || undefined;

      // Extract instructions from the last assistant message in this conversation
      let instructions: string | null = null;
      if (animationId) {
        const lastAssistant = db.prepare(
          "SELECT content FROM messages WHERE animation_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
        ).get(animationId) as { content: string } | undefined;
        if (lastAssistant) {
          instructions = lastAssistant.content;
        }
      }

      if (!instructions) {
        const reply = "Cannot save preset — no previous assistant message found. Create an animation first, then save it as a preset.";
        const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
        const body = encoder.encode(`data: ${doneEvent}\n\n`);
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          }
        }), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      try {
        createPreset(presetName, presetDescription, instructions, creatorIdHeader);
        const reply = `Saved preset **"${presetName}"**. You can apply it anytime by saying "apply ${presetName}".`;
        const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
        const body = encoder.encode(`data: ${doneEvent}\n\n`);
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          }
        }), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to save preset";
        const reply = errMsg.includes("UNIQUE constraint")
          ? `A preset named "${presetName}" already exists. Choose a different name.`
          : `Failed to save preset: ${errMsg}`;
        const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
        const body = encoder.encode(`data: ${doneEvent}\n\n`);
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          }
        }), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "delete") {
      const presetName = parsedCmd.subcommand.name;
      const deleted = deletePresetByName(presetName);
      let reply: string;
      if (deleted) {
        reply = `Deleted preset **"${presetName}"**.`;
      } else {
        const exists = getPresetByName(presetName);
        if (exists && exists.is_builtin) {
          reply = `Cannot delete **"${presetName}"** \u2014 it's a built-in preset.`;
        } else {
          reply = `Preset **"${presetName}"** not found.`;
        }
      }
      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "rename") {
      const { oldName, newName } = parsedCmd.subcommand;
      const renamed = renamePreset(oldName, newName);
      let reply: string;
      if (renamed) {
        reply = `Renamed preset **"${oldName}"** \u2192 **"${newName}"**.`;
      } else {
        const exists = getPresetByName(oldName);
        if (!exists) {
          reply = `Preset **"${oldName}"** not found.`;
        } else if (exists.is_builtin) {
          reply = `Cannot rename **"${oldName}"** \u2014 it's a built-in preset.`;
        } else {
          reply = `Cannot rename \u2014 a preset named **"${newName}"** already exists.`;
        }
      }
      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "info") {
      const presetName = parsedCmd.subcommand.name;
      const preset = getPresetByName(presetName);
      let reply: string;
      if (!preset) {
        reply = `Preset **"${presetName}"** not found.`;
      } else {
        reply = `**${preset.name}**${preset.is_builtin ? " _(built-in)_" : ""}\n\n`;
        if (preset.description) reply += `${preset.description}\n\n`;
        reply += `**Instructions:** ${preset.instructions}\n\n`;
        reply += `**Created:** ${preset.created_at}`;
      }
      const doneEvent = JSON.stringify({ type: "done", reply, animationId: animationId || undefined });
      const body = encoder.encode(`data: ${doneEvent}\n\n`);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        }
      }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
  }

  // Read creator identity headers
  const creatorId = request.headers.get("x-creator-id") || null;
  const creatorName = request.headers.get("x-creator-name") || null;

  let isNewAnimation = false;
  if (animationId) {
    const existing = db.prepare("SELECT id FROM animations WHERE id = ?").get(animationId);
    if (!existing) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
  } else {
    animationId = randomUUID();
    const name = extractTitle(message);
    db.prepare(
      "INSERT INTO animations (id, name, creator_id, creator_name) VALUES (?, ?, ?, ?)"
    ).run(animationId, name, creatorId, creatorName);
    isNewAnimation = true;
  }

  // When regenerating, delete the previous user + assistant messages for this turn
  // BEFORE loading history so the LLM won't see the old response in its context
  if (regenerate && animationId) {
    // Delete the last assistant message
    const lastAssistant = db.prepare(
      "SELECT id FROM messages WHERE animation_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).get(animationId) as { id: string } | undefined;
    if (lastAssistant) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(lastAssistant.id);
    }
    // Delete the last user message (the one being re-sent)
    const lastUser = db.prepare(
      "SELECT id FROM messages WHERE animation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1"
    ).get(animationId) as { id: string } | undefined;
    if (lastUser) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(lastUser.id);
    }
  }

  let currentAnimation: object | null = null;
  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);
  if (fs.existsSync(animationFile)) {
    try {
      currentAnimation = JSON.parse(fs.readFileSync(animationFile, "utf-8"));
    } catch {}
  }

  const rawHistory = db.prepare(
    "SELECT role, content, image_url FROM messages WHERE animation_id = ? ORDER BY created_at ASC"
  ).all(animationId) as MessageRow[];

  const history = compactHistory(rawHistory);

  // Check if animation was created from a template
  const animRow = db.prepare(
    "SELECT template_source FROM animations WHERE id = ?"
  ).get(animationId) as { template_source: string | null } | undefined;
  const templateSource = animRow?.template_source || null;

  type ContentPart = { type: "text" | "image_url"; text?: string; image_url?: { url: string } };
  type LLMMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

  let systemPrompt = buildSystemPrompt(currentAnimation, message);
  if (templateSource) {
    systemPrompt += `\n\nThe user is working with a remix of the "${templateSource}" template.`;
  }

  // Inject design tokens into system prompt if provided
  if (body.designTokens) {
    const tokenPrompt = buildDesignTokensPrompt(body.designTokens);
    if (tokenPrompt) {
      systemPrompt += `\n\n${tokenPrompt}`;
    }
  }

  // Style command: add extra instructions to preserve motion/keyframes
  const styleMatch = message.match(/^\[STYLE:\s*(\w+)\]/);
  if (styleMatch && currentAnimation) {
    systemPrompt += `\n\nIMPORTANT STYLE INSTRUCTION: The user is applying a visual style preset. You MUST preserve ALL existing motion, keyframes, timing, easing, and animation structure exactly as-is. Only modify visual properties: colors (fill/stroke), gradients, opacity values, stroke widths, and background. Do NOT add, remove, or reorder layers. Do NOT change any position/rotation/scale keyframes or timing.`;
  }

  // Animate command: add extra instructions to preserve visual properties
  const animateMatch = message.match(/^\[ANIMATE:\s*([\w-]+)\]/);
  if (animateMatch && currentAnimation) {
    systemPrompt += `\n\nIMPORTANT MOTION INSTRUCTION: The user is applying a motion preset. You MUST preserve ALL existing visual properties (colors, fills, strokes, gradients, opacity). Only modify or add keyframes, timing, and easing. You may add new layers if the effect requires it (e.g., confetti overlay).`;
  }

  // Detect preset intent in natural language (e.g., "apply bounce", "use the pulse preset")
  if (!parsedCmd || (parsedCmd.type !== "presets")) {
    const allPresets = getAllPresets();
    const messageLower = message.toLowerCase();
    for (const preset of allPresets) {
      if (messageLower.includes(preset.name)) {
        systemPrompt += `\n\n${buildPresetPrompt(preset.instructions)}`;
        break;
      }
    }
  }

  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => {
      if (m.role === "user" && m.image_url) {
        return {
          role: m.role as "user" | "assistant",
          content: [
            { type: "image_url" as const, image_url: { url: m.image_url } },
            { type: "text" as const, text: m.content },
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  // Build the current user message (multimodal if image attached)
  if (image) {
    llmMessages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        { type: "text", text: message },
      ],
    });
  } else {
    llmMessages.push({ role: "user", content: message });
  }

  // Use higher temperature for regeneration to get more variety
  const llmTemperature = regenerate ? 0.9 : undefined;

  let llmResponse: Response;
  try {
    llmResponse = await chatCompletionStream(llmMessages, { temperature: llmTemperature });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `LLM request failed: ${errMsg}` }, { status: 502 });
  }

  const llmBody = llmResponse.body;
  if (!llmBody) {
    return Response.json({ error: "LLM returned no body" }, { status: 502 });
  }

  // Capture animationId in closure for the stream
  const capturedAnimationId = animationId;
  const capturedIsNew = isNewAnimation;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = llmBody.getReader();
      let accumulated = "";
      let sseBuffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = sseBuffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                const chunk = JSON.stringify({ type: "token", text: content });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }

        // Stream ended — finalize
        const parsed = parseResponse(accumulated);
        const { command } = parsed;
        let { reply, lottieJson, parseError, suggestions } = parsed;

        // Auto-repair: if parse failed, try once with error context
        const shouldRetryNoJson =
          parseError === "no_json" &&
          (/"v"\s*:/.test(accumulated) || /"layers"\s*:/.test(accumulated));

        if (
          !lottieJson &&
          !command &&
          parseError &&
          (parseError === "invalid_json" || parseError === "invalid_lottie" || shouldRetryNoJson)
        ) {
          // Notify client that a repair attempt is starting
          const repairingEvent = JSON.stringify({ type: "repairing" });
          controller.enqueue(encoder.encode(`data: ${repairingEvent}\n\n`));

          try {
            const repairResponse = await chatCompletionRepairStream(llmMessages, accumulated, parseError);
            const repairBody = repairResponse.body;
            if (repairBody) {
              const repairReader = repairBody.getReader();
              const repairDecoder = new TextDecoder();
              let repairAccumulated = "";
              let repairSseBuffer = "";

              while (true) {
                const { done: repairDone, value: repairValue } = await repairReader.read();
                if (repairDone) break;

                repairSseBuffer += repairDecoder.decode(repairValue, { stream: true });

                const repairLines = repairSseBuffer.split("\n");
                repairSseBuffer = repairLines.pop() || "";

                for (const repairLine of repairLines) {
                  const repairTrimmed = repairLine.trim();
                  if (!repairTrimmed || !repairTrimmed.startsWith("data: ")) continue;

                  const repairData = repairTrimmed.slice(6);
                  if (repairData === "[DONE]") continue;

                  try {
                    const repairParsed = JSON.parse(repairData);
                    const repairContent = repairParsed.choices?.[0]?.delta?.content;
                    if (repairContent) {
                      repairAccumulated += repairContent;
                      const repairChunk = JSON.stringify({ type: "repair_token", text: repairContent });
                      controller.enqueue(encoder.encode(`data: ${repairChunk}\n\n`));
                    }
                  } catch {
                    // Skip malformed JSON chunks
                  }
                }
              }

              const repaired = parseResponse(repairAccumulated);
              if (repaired.lottieJson && !repaired.parseError) {
                reply = repaired.reply;
                lottieJson = repaired.lottieJson;
                parseError = null;
                suggestions = repaired.suggestions;
              }
            }
            // If repair also failed, fall through to original warning behavior
          } catch {
            // Repair request failed — fall through to original warning behavior
          }
        }

        // Build warning message when Lottie JSON generation failed
        let warning: string | undefined;
        if (!lottieJson && !command && parseError) {
          switch (parseError) {
            case "invalid_json":
              warning = "The generated animation code was malformed. Try rephrasing your request.";
              break;
            case "invalid_lottie":
              warning = "The response contained JSON but it wasn\u2019t a valid Lottie animation. Try describing your animation more specifically.";
              break;
            case "no_json":
              warning = "Could not generate animation from the response. Try describing your animation more specifically.";
              break;
          }
        }

        // Save messages to DB
        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content, image_url) VALUES (?, ?, 'user', ?, ?)"
        ).run(randomUUID(), capturedAnimationId, message, image || null);

        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content, lottie_json, previous_lottie_json) VALUES (?, ?, 'assistant', ?, ?, ?)"
        ).run(randomUUID(), capturedAnimationId, reply, lottieJson ? JSON.stringify(lottieJson) : null, lottieJson && currentAnimation ? JSON.stringify(currentAnimation) : null);

        // Save animation file and update DB if we got Lottie JSON
        if (lottieJson) {
          // Auto-optimize: clean up LLM numerical noise and redundancies
          const validation = validateAndFix(lottieJson);
          lottieJson = removeHiddenLayers(
            removeEmptyGroups(
              roundDecimals(validation.fixed, 3)
            )
          ) as object;

          if (validation.warnings.length > 0) {
            const validationWarning = validation.warnings.join('; ');
            warning = warning ? `${warning} ${validationWarning}` : validationWarning;
          }

          fs.writeFileSync(animationFile, JSON.stringify(lottieJson));

          const lottie = lottieJson as Record<string, unknown>;
          const frameCount = (lottie.op as number) ?? null;
          const frameRate = (lottie.fr as number) ?? 30;
          const durationSeconds = frameCount != null ? frameCount / frameRate : null;

          db.prepare(
            "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(frameCount, durationSeconds, capturedAnimationId);

          // Infer and save tags from user prompt
          const tags = inferTags(message);
          if (tags.length > 0) {
            db.prepare(
              "UPDATE animations SET tags = ? WHERE id = ?"
            ).run(serializeTags(tags), capturedAnimationId);
          }

          // Extract and save description from assistant reply
          const description = extractDescription(reply);
          if (description) {
            db.prepare(
              "UPDATE animations SET description = ? WHERE id = ?"
            ).run(description, capturedAnimationId);
          }

          // Auto-save version
          const lastVersion = db.prepare(
            "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
          ).get(capturedAnimationId) as { max_num: number | null } | undefined;
          const nextVersion = (lastVersion?.max_num ?? 0) + 1;
          db.prepare(
            "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
          ).run(capturedAnimationId, nextVersion, JSON.stringify(lottieJson), message);

          animationEvents.emit("updated", { animationId: capturedAnimationId });
        }

        // Cleanup: if this was a new animation and no Lottie JSON was produced,
        // remove the orphaned DB row to prevent empty entries in the gallery
        if (!lottieJson && capturedIsNew) {
          db.prepare("DELETE FROM messages WHERE animation_id = ?").run(capturedAnimationId);
          db.prepare("DELETE FROM animations WHERE id = ?").run(capturedAnimationId);
        }

        // Emit final done event
        const doneEvent = JSON.stringify({
          type: "done",
          reply,
          lottieJson,
          animationId: capturedAnimationId,
          ...(warning ? { warning } : {}),
          ...(suggestions ? { suggestions } : {}),
          ...(command ? { command } : {}),
          ...(lottieJson && currentAnimation ? { previousLottieJson: currentAnimation } : {}),
        });
        controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Stream processing error";
        const errorEvent = JSON.stringify({ type: "error", error: errMsg });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
