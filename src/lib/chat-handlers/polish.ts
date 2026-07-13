import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletionStream, parseResponse } from "@/lib/llm";
import { roundDecimals, removeEmptyGroups, removeHiddenLayers, validateAndFix } from "@/lib/optimizer";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sendDoneEvent,
  encodeSSE,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
  animationExists,
  createStreamingSSEResponse,
} from "./helpers";

export async function handlePolish(animationId: string | undefined, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then I can polish it." });
  }

  if (!animationExists(animationId)) {
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
    const reply = "Create an animation first, then I can polish it.";
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);
    return sendDoneEvent({ reply, animationId });
  }

  const polishSystemPrompt = `You are an expert motion designer and Lottie animation specialist. The user wants you to analyze and IMPROVE their current animation. Review the provided Lottie JSON, identify issues, and output an improved version.

Your response should have two parts:

1. **Brief Analysis** — A short summary of what you improved (2-4 bullet points). Use these indicators:
   - 🔧 for fixes applied
   - ✨ for enhancements made
   - ⚡ for performance improvements

Cover these areas in your improvements:
- **Timing & Easing** — Replace linear easing with natural curves (ease-in-out, overshoot, elastic). Fix awkward timing.
- **Motion Principles** — Add anticipation, follow-through, overshoot, or secondary motion where missing.
- **Visual Quality** — Fix color inconsistencies, improve visual hierarchy, adjust opacity/scale for polish.
- **Performance** — Remove redundant keyframes, simplify over-complex paths, optimize layer count.

2. **Improved Lottie JSON** — Output the complete improved Lottie JSON inside a \`\`\`json code block. The JSON must be a valid, complete Lottie animation that can be rendered directly.

IMPORTANT:
- Keep the same general animation concept — polish, don't redesign.
- Preserve the canvas dimensions (w, h), frame rate (fr), and approximate duration unless they are clearly wrong.
- You MUST output a complete valid Lottie JSON in a \`\`\`json code block.`;

  const polishMessages = [
    { role: "system" as const, content: polishSystemPrompt },
    { role: "user" as const, content: `Here is the Lottie JSON to polish:\n\n\`\`\`json\n${animJson}\n\`\`\`` },
  ];

  db.prepare(
    "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(randomUUID(), animationId, message);

  let llmResponse: Response;
  try {
    llmResponse = await chatCompletionStream(polishMessages);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `LLM request failed: ${errMsg}` }, { status: 502 });
  }

  const llmBody = llmResponse.body;
  if (!llmBody) {
    return Response.json({ error: "LLM returned no body" }, { status: 502 });
  }

  const capturedAnimationId = animationId;
  const animationFile = path.join(ANIMATIONS_DIR, `${animationId}.json`);

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
                controller.enqueue(encodeSSE(JSON.stringify({ type: "token", text: content })));
              }
            } catch {}
          }
        }

        const reply = accumulated.trim() || "Unable to generate polished animation.";
        const parsedResult = parseResponse(accumulated);
        let lottieJson = parsedResult.lottieJson;

        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content, lottie_json, previous_lottie_json) VALUES (?, ?, 'assistant', ?, ?, ?)"
        ).run(randomUUID(), capturedAnimationId, reply, lottieJson ? JSON.stringify(lottieJson) : null, lottieJson ? animJson : null);

        if (lottieJson) {
          const validation = validateAndFix(lottieJson);
          lottieJson = removeHiddenLayers(
            removeEmptyGroups(
              roundDecimals(validation.fixed, 3)
            )
          ) as object;

          fs.writeFileSync(animationFile, JSON.stringify(lottieJson));
          updateAnimationMetadata(capturedAnimationId, lottieJson as Record<string, unknown>);
          saveVersion(capturedAnimationId, JSON.stringify(lottieJson), message);
          emitUpdated(capturedAnimationId);
        }

        const doneEvent = JSON.stringify({
          type: "done",
          reply,
          lottieJson,
          animationId: capturedAnimationId,
          ...(lottieJson ? { previousLottieJson: JSON.parse(animJson!) } : {}),
        });
        controller.enqueue(encodeSSE(doneEvent));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Stream processing error";
        controller.enqueue(encodeSSE(JSON.stringify({ type: "error", error: errMsg })));
      } finally {
        controller.close();
      }
    },
  });

  return createStreamingSSEResponse(stream);
}
