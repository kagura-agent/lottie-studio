import { db, ANIMATIONS_DIR } from "@/lib/db";
import { chatCompletionStream } from "@/lib/llm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  sendDoneEvent,
  encodeSSE,
  animationExists,
  createStreamingSSEResponse,
} from "./helpers";

export async function handleCritique(animationId: string | undefined, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then I can critique it." });
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
    const reply = "Create an animation first, then I can critique it.";
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(randomUUID(), animationId, message);
    db.prepare(
      "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).run(randomUUID(), animationId, reply);
    return sendDoneEvent({ reply, animationId });
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
                controller.enqueue(encodeSSE(JSON.stringify({ type: "token", text: content })));
              }
            } catch {}
          }
        }

        const reply = accumulated.trim() || "Unable to generate critique.";
        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content) VALUES (?, ?, 'assistant', ?)"
        ).run(randomUUID(), capturedAnimationId, reply);

        controller.enqueue(encodeSSE(JSON.stringify({ type: "done", reply, animationId: capturedAnimationId })));
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
