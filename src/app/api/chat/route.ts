import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletionStream, chatCompletionRepairStream, parseResponse } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompts";
import { compactHistory, isUndoIntent } from "@/lib/chat-utils";
import type { MessageRow } from "@/lib/chat-utils";
import { animationEvents } from "@/lib/events";
import { extractIp, checkRate } from "@/lib/rateLimit";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

interface ChatRequest {
  animationId?: string;
  message: string;
  image?: string; // base64 data URL for image attachment
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
  const { message, image } = body;
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

  const rawHistory = db.prepare(
    "SELECT role, content, image_url FROM messages WHERE animation_id = ? ORDER BY created_at ASC"
  ).all(animationId) as MessageRow[];

  const history = compactHistory(rawHistory);

  type ContentPart = { type: "text" | "image_url"; text?: string; image_url?: { url: string } };
  type LLMMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

  const llmMessages: LLMMessage[] = [
    { role: "system", content: buildSystemPrompt(currentAnimation, message) },
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

  let llmResponse: Response;
  try {
    llmResponse = await chatCompletionStream(llmMessages);
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
        let { reply, lottieJson, parseError, suggestions } = parseResponse(accumulated);

        // Auto-repair: if parse failed, try once with error context
        const shouldRetryNoJson =
          parseError === "no_json" &&
          (/"v"\s*:/.test(accumulated) || /"layers"\s*:/.test(accumulated));

        if (
          !lottieJson &&
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
        if (!lottieJson && parseError) {
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
          "INSERT INTO messages (id, animation_id, role, content, lottie_json) VALUES (?, ?, 'assistant', ?, ?)"
        ).run(randomUUID(), capturedAnimationId, reply, lottieJson ? JSON.stringify(lottieJson) : null);

        // Save animation file and update DB if we got Lottie JSON
        if (lottieJson) {
          fs.writeFileSync(animationFile, JSON.stringify(lottieJson));

          const lottie = lottieJson as Record<string, unknown>;
          const frameCount = (lottie.op as number) ?? null;
          const frameRate = (lottie.fr as number) ?? 30;
          const durationSeconds = frameCount != null ? frameCount / frameRate : null;

          db.prepare(
            "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(frameCount, durationSeconds, capturedAnimationId);

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

        // Emit final done event
        const doneEvent = JSON.stringify({
          type: "done",
          reply,
          lottieJson,
          animationId: capturedAnimationId,
          ...(warning ? { warning } : {}),
          ...(suggestions ? { suggestions } : {}),
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
