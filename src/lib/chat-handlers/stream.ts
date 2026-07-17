import { db, ANIMATIONS_DIR, getAllPresets } from "@/lib/db";
import { chatCompletionStream, chatCompletionRepairStream, parseResponse } from "@/lib/llm";
import { buildSystemPrompt, buildDesignTokensPrompt, buildPresetPrompt } from "@/lib/prompts";
import { compactHistory } from "@/lib/chat-utils";
import type { MessageRow } from "@/lib/chat-utils";
import { animationEvents, emitWebhook } from "@/lib/events";
import { inferTags, serializeTags } from "@/lib/tag-inference";
import { extractDescription } from "@/lib/description";
import extractTitle from "@/lib/titleExtractor";
import { roundDecimals, removeEmptyGroups, removeHiddenLayers, validateAndFix } from "@/lib/optimizer";
import { analyzeQuality } from "@/lib/quality";
import { validateStructure } from "@/lib/validation";
import { summarizeChanges } from "@/lib/animation-diff";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  encodeSSE,
  createStreamingSSEResponse,
} from "./helpers";

interface ChatRequest {
  animationId?: string;
  message: string;
  image?: string;
  regenerate?: boolean;
  designTokens?: { primary?: string; secondary?: string; accent?: string; background?: string; font?: string };
  layerContext?: { name: string; type: string; index: number; inPoint?: number; outPoint?: number; position?: unknown; opacity?: unknown; scale?: unknown; rotation?: unknown };
}

export async function handleMainChat(
  request: Request,
  body: ChatRequest,
  animationId: string | undefined,
  locale: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedCmd: any,
): Promise<Response> {
  const { message, image, regenerate } = body;

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
    emitWebhook("animation.created", { animationId, name }, creatorId || undefined);
  }

  if (regenerate && animationId) {
    const lastAssistant = db.prepare(
      "SELECT id FROM messages WHERE animation_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).get(animationId) as { id: string } | undefined;
    if (lastAssistant) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(lastAssistant.id);
    }
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

  const animRow = db.prepare(
    "SELECT template_source FROM animations WHERE id = ?"
  ).get(animationId) as { template_source: string | null } | undefined;
  const templateSource = animRow?.template_source || null;

  type ContentPart = { type: "text" | "image_url"; text?: string; image_url?: { url: string } };
  type LLMMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

  let systemPrompt = buildSystemPrompt(currentAnimation, message, locale);
  if (templateSource) {
    systemPrompt += `\n\nThe user is working with a remix of the "${templateSource}" template.`;
  }

  if (body.designTokens) {
    const tokenPrompt = buildDesignTokensPrompt(body.designTokens);
    if (tokenPrompt) {
      systemPrompt += `\n\n${tokenPrompt}`;
    }
  }

  if (body.layerContext) {
    const lc = body.layerContext;
    const props = [
      lc.inPoint != null ? `in-point: ${lc.inPoint}` : null,
      lc.outPoint != null ? `out-point: ${lc.outPoint}` : null,
      lc.opacity != null ? `opacity: ${JSON.stringify(lc.opacity)}` : null,
      lc.position != null ? `position: ${JSON.stringify(lc.position)}` : null,
      lc.scale != null ? `scale: ${JSON.stringify(lc.scale)}` : null,
      lc.rotation != null ? `rotation: ${JSON.stringify(lc.rotation)}` : null,
    ].filter(Boolean).join(', ');
    systemPrompt += `\n\nThe user has selected layer: "${lc.name}" (type: ${lc.type}, index: ${lc.index}). Properties: ${props}. When they refer to "this", "it", or make unqualified requests, apply changes to this layer.`;
  }

  const styleMatch = message.match(/^\[STYLE:\s*(\w+)\]/);
  if (styleMatch && currentAnimation) {
    systemPrompt += `\n\nIMPORTANT STYLE INSTRUCTION: The user is applying a visual style preset. You MUST preserve ALL existing motion, keyframes, timing, easing, and animation structure exactly as-is. Only modify visual properties: colors (fill/stroke), gradients, opacity values, stroke widths, and background. Do NOT add, remove, or reorder layers. Do NOT change any position/rotation/scale keyframes or timing.`;
  }

  const styleCustomMatch = message.match(/^\[STYLE_CUSTOM:\s*(.+?)\]/);
  if (styleCustomMatch && currentAnimation) {
    systemPrompt += `\n\nIMPORTANT STYLE INSTRUCTION: The user is applying a custom visual style. You MUST preserve ALL existing motion, keyframes, timing, easing, and animation structure exactly as-is. Only modify visual properties: colors (fill/stroke), gradients, opacity values, stroke widths, and background. Do NOT add, remove, or reorder layers. Do NOT change any position/rotation/scale keyframes or timing.`;
  }

  const animateMatch = message.match(/^\[ANIMATE:\s*([\w-]+)\]/);
  if (animateMatch && currentAnimation) {
    systemPrompt += `\n\nIMPORTANT MOTION INSTRUCTION: The user is applying a motion preset. You MUST preserve ALL existing visual properties (colors, fills, strokes, gradients, opacity). Only modify or add keyframes, timing, and easing. You may add new layers if the effect requires it (e.g., confetti overlay).`;
  }

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

  const capturedAnimationId = animationId;
  const capturedIsNew = isNewAnimation;

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

        const parsed = parseResponse(accumulated);
        const { command } = parsed;
        let { reply, lottieJson, parseError, suggestions } = parsed;

        const shouldRetryNoJson =
          parseError === "no_json" &&
          (/"v"\s*:/.test(accumulated) || /"layers"\s*:/.test(accumulated));

        if (
          !lottieJson &&
          !command &&
          parseError &&
          (parseError === "invalid_json" || parseError === "invalid_lottie" || shouldRetryNoJson)
        ) {
          controller.enqueue(encodeSSE(JSON.stringify({ type: "repairing" })));

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
                      controller.enqueue(encodeSSE(JSON.stringify({ type: "repair_token", text: repairContent })));
                    }
                  } catch {}
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
          } catch {}
        }

        let warning: string | undefined;
        if (!lottieJson && !command && parseError) {
          switch (parseError) {
            case "invalid_json":
              warning = "The generated animation code was malformed. Try rephrasing your request.";
              break;
            case "invalid_lottie":
              warning = "The response contained JSON but it wasn’t a valid Lottie animation. Try describing your animation more specifically.";
              break;
            case "no_json":
              warning = "Could not generate animation from the response. Try describing your animation more specifically.";
              break;
          }
        }

        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content, image_url) VALUES (?, ?, 'user', ?, ?)"
        ).run(randomUUID(), capturedAnimationId, message, image || null);

        db.prepare(
          "INSERT INTO messages (id, animation_id, role, content, lottie_json, previous_lottie_json) VALUES (?, ?, 'assistant', ?, ?, ?)"
        ).run(randomUUID(), capturedAnimationId, reply, lottieJson ? JSON.stringify(lottieJson) : null, lottieJson && currentAnimation ? JSON.stringify(currentAnimation) : null);

        if (lottieJson) {
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

          const structuralValidation = validateStructure(lottieJson as Record<string, unknown>);
          if (structuralValidation.issues.length > 0) {
            const structWarning = '⚠️ Animation has structural issues: ' +
              structuralValidation.issues.map((i) => i.message).join('; ');
            warning = warning ? `${warning} ${structWarning}` : structWarning;
          }

          fs.writeFileSync(animationFile, JSON.stringify(lottieJson));

          const lottie = lottieJson as Record<string, unknown>;
          const frameCount = (lottie.op as number) ?? null;
          const frameRate = (lottie.fr as number) ?? 30;
          const durationSeconds = frameCount != null ? frameCount / frameRate : null;

          db.prepare(
            "UPDATE animations SET frame_count = ?, duration_seconds = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(frameCount, durationSeconds, capturedAnimationId);

          const tags = inferTags(message);
          if (tags.length > 0) {
            db.prepare(
              "UPDATE animations SET tags = ? WHERE id = ?"
            ).run(serializeTags(tags), capturedAnimationId);
          }

          const description = extractDescription(reply);
          if (description) {
            db.prepare(
              "UPDATE animations SET description = ? WHERE id = ?"
            ).run(description, capturedAnimationId);
          }

          const lastVersion = db.prepare(
            "SELECT MAX(version_num) as max_num FROM versions WHERE animation_id = ?"
          ).get(capturedAnimationId) as { max_num: number | null } | undefined;
          const nextVersion = (lastVersion?.max_num ?? 0) + 1;
          db.prepare(
            "INSERT INTO versions (animation_id, version_num, lottie_json, trigger_message) VALUES (?, ?, ?, ?)"
          ).run(capturedAnimationId, nextVersion, JSON.stringify(lottieJson), message);

          animationEvents.emit("updated", { animationId: capturedAnimationId });
        }

        if (!lottieJson && capturedIsNew) {
          db.prepare("DELETE FROM messages WHERE animation_id = ?").run(capturedAnimationId);
          db.prepare("DELETE FROM animations WHERE id = ?").run(capturedAnimationId);
        }

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
        controller.enqueue(encodeSSE(doneEvent));

        if (lottieJson) {
          const jsonStr = JSON.stringify(lottieJson);
          const quality = analyzeQuality(lottieJson as Record<string, unknown>, jsonStr);
          const actionableHints = quality.checks.filter(
            (c) => (c.status === "warn" || c.status === "fail") && c.suggestion
          );
          if (actionableHints.length > 0) {
            controller.enqueue(encodeSSE(JSON.stringify({
              type: "quality_hints",
              hints: actionableHints.map((c) => ({
                id: c.id,
                label: c.label,
                status: c.status,
                detail: c.detail,
                suggestion: c.suggestion,
              })),
            })));
          }

          if (currentAnimation) {
            const diffSummary = summarizeChanges(
              currentAnimation as Record<string, unknown>,
              lottieJson as Record<string, unknown>,
            );
            if (diffSummary) {
              controller.enqueue(encodeSSE(JSON.stringify({
                type: "modification_summary",
                summary: diffSummary,
              })));
            }
          }
        }
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
