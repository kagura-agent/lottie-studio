import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletionStream, chatCompletionRepairStream, parseResponse } from "@/lib/llm";
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

  const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(currentAnimation) },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

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
        let { reply, lottieJson, parseError } = parseResponse(accumulated);

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
          "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
        ).run(randomUUID(), capturedAnimationId, message);

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

          animationEvents.emit("updated", { animationId: capturedAnimationId });
        }

        // Emit final done event
        const doneEvent = JSON.stringify({
          type: "done",
          reply,
          lottieJson,
          animationId: capturedAnimationId,
          ...(warning ? { warning } : {}),
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
