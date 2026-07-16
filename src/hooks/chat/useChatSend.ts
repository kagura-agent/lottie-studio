"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Message } from "@/lib/chat-types";
import { extractLayerContext } from "@/lib/chat-types";
import { parseCommand, type Command, type StyleName, type AnimationPreset, VALID_STYLES, STYLE_DESCRIPTIONS } from "@/lib/commands";
import { getRandomPrompt } from "@/data/randomPrompts";
import { apiFetch } from "@/lib/apiFetch";
import { useDesignTokens } from "@/contexts/DesignTokensContext";
import { enqueueMessage } from "@/lib/messageQueue";
import { extractPartialLottie } from "@/lib/partial-lottie";
import type { Variation } from "@/components/VariationGrid";

const STYLE_INSTRUCTIONS: Record<StyleName, string> = {
  neon: "Apply the neon visual style to the current animation. Keep all motion/keyframes intact but change colors, strokes, fills to match the neon aesthetic (glowing edges, electric colors like cyan/magenta/purple, dark background).",
  pastel: "Apply the pastel visual style to the current animation. Keep all motion/keyframes intact but change colors to soft muted pastels (light pink, baby blue, lavender, mint), gentle fills, low saturation.",
  monochrome: "Apply the monochrome visual style to the current animation. Keep all motion/keyframes intact but change to a single-color palette with varying shades and opacities for depth.",
  gradient: "Apply the gradient visual style to the current animation. Keep all motion/keyframes intact but add gradient fills where possible, using smooth color transitions.",
  retro: "Apply the retro visual style to the current animation. Keep all motion/keyframes intact but change to warm tones (amber, burnt orange, mustard), slightly rounded shapes, vintage feel.",
  minimal: "Apply the minimal visual style to the current animation. Keep all motion/keyframes intact but reduce to essential shapes, thin strokes, ample white space, muted colors.",
  bold: "Apply the bold visual style to the current animation. Keep all motion/keyframes intact but use thick strokes, highly saturated colors, high contrast between elements.",
  nature: "Apply the nature visual style to the current animation. Keep all motion/keyframes intact but change to earth tones (forest green, sky blue, terracotta, sand), organic curves feel.",
};

const ANIMATE_INSTRUCTIONS: Record<AnimationPreset, string> = {
  bounce: "Apply a bounce entrance effect. Add scale keyframes: start at [0,0], overshoot to [110,110] at 60% duration, settle back to [100,100]. Use ease-out back easing.",
  pulse: "Apply a pulse/heartbeat effect. Add looping scale keyframes: [100,100] → [115,115] → [95,95] → [100,100]. Use smooth ease-in-out. Make it loop seamlessly.",
  shake: "Apply a horizontal shake effect. Add rapid position x-offset keyframes: 0 → +8 → -8 → +4 → -4 → 0 over ~10 frames. Use linear easing for snappy feel.",
  float: "Apply a floating/hovering effect. Add gentle vertical position oscillation: y offset -10px to +10px with smooth sine-like easing, looping seamlessly.",
  spin: "Apply a continuous rotation. Add rotation keyframes from 0° to 360° over the full duration with linear easing for constant speed. Loop seamlessly.",
  "slide-in": "Apply a slide-in from left entrance. Start position x far off-screen to the left, animate to final position with ease-out easing over first 30% of duration.",
  "fade-in": "Apply a fade-in entrance. Start opacity at 0, animate to 100 with ease-in-out over the first 40% of duration.",
  elastic: "Apply an elastic/spring entrance. Start scale at [0,0], overshoot to [120,120], undershoot to [90,90], overshoot to [105,105], settle at [100,100]. Use spring-like easing.",
  wiggle: "Apply a subtle wiggle. Add small random-feeling rotation keyframes oscillating between -5° and +5° with varied timing, looping seamlessly.",
  typewriter: "Apply a typewriter reveal effect. If there are text layers, reveal characters one by one using trim paths or opacity per character. If no text layers, apply a left-to-right reveal using a rectangular mask with animated position.",
};

interface UseChatSendOptions {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setPendingCount: React.Dispatch<React.SetStateAction<number>>;
  currentAnimationId: string | undefined;
  setCurrentAnimationId: React.Dispatch<React.SetStateAction<string | undefined>>;
  onAnimationCreated?: (id: string, data?: object) => void;
  onAnimationUpdated?: (id: string, data: object) => void;
  onCommand?: (command: Command) => void;
  animationDataProp: object | null | undefined;
  selectedLayerIndex: number | null | undefined;
  onLayerContextConsumed?: () => void;
  isOnline: boolean;
  onProgressivePreview?: (data: object | null) => void;
}

export function useChatSend(options: UseChatSendOptions) {
  const {
    messages, setMessages, setPendingCount,
    currentAnimationId, setCurrentAnimationId,
    onAnimationCreated, onAnimationUpdated, onCommand,
    animationDataProp, selectedLayerIndex, onLayerContextConsumed,
    isOnline, onProgressivePreview,
  } = options;

  const t = useTranslations("chat");
  const tSeq = useTranslations("sequencePlayer");
  const { tokens: designTokens, setToken: setDesignToken, clearTokens: clearDesignTokens, hasTokens: hasDesignTokens } = useDesignTokens();

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [retryingMsgId, setRetryingMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleSendRef = useRef<((prompt?: string) => Promise<void>) | undefined>(undefined);

  const streamResponse = useCallback(async (text: string, existingAssistantMsgId?: string, signal?: AbortSignal, imageDataUrl?: string, regenerate?: boolean, layerContext?: object | null) => {
    const res = await apiFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animationId: currentAnimationId,
        message: text,
        ...(imageDataUrl ? { image: imageDataUrl } : {}),
        ...(regenerate ? { regenerate: true } : {}),
        ...(hasDesignTokens ? { designTokens } : {}),
        ...(layerContext ? { layerContext } : {}),
      }),
      signal,
    });

    const contentType = res.headers.get("Content-Type") || "";
    if (!contentType.includes("text/event-stream")) {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const sec = errData.retryAfterSec;
          throw new Error(sec ? `You're going fast — try again in ${sec} seconds 🌸` : "You're going fast — slow down 🌸");
        }
        throw new Error(errData.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (!currentAnimationId && data.animationId) {
        setCurrentAnimationId(data.animationId);
        onAnimationCreated?.(data.animationId, data.lottieJson as object | undefined);
      }
      if (existingAssistantMsgId) {
        const msgId = existingAssistantMsgId;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: data.reply, warning: undefined } : m
          )
        );
      } else {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply }]);
      }
      setIsThinking(false);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let sseBuffer = "";
    let assistantMsgId: string | null = existingAssistantMsgId ?? null;
    let visibleContent = "";
    let insideJsonBlock = false;
    let fenceBuffer = "";
    let jsonBlockContent = "";
    let jsonBlockCharsSinceLastPreview = 0;
    let lastPreviewTime = 0;
    let repairVisibleContent = "";
    let repairInsideJsonBlock = false;
    let repairFenceBuffer = "";

    setIsThinking(false);
    setIsStreaming(true);

    if (existingAssistantMsgId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === existingAssistantMsgId ? { ...m, content: "", warning: undefined } : m
        )
      );
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const parts = sseBuffer.split("\n\n");
      sseBuffer = parts.pop() || "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        let parsed: { type: string; text?: string; reply?: string; lottieJson?: unknown; previousLottieJson?: unknown; animationId?: string; error?: string; warning?: string; suggestions?: string[]; command?: unknown; hints?: unknown[] };
        try {
          parsed = JSON.parse(trimmed.slice(6));
        } catch {
          continue;
        }

        if (parsed.type === "token") {
          const tokenText = parsed.text || "";
          let visibleChunk = "";
          for (const ch of tokenText) {
            fenceBuffer += ch;
            if (!insideJsonBlock) {
              if (fenceBuffer.endsWith("```json")) {
                visibleChunk = visibleChunk.slice(0, -("```json".length - 1));
                insideJsonBlock = true;
                fenceBuffer = "";
              } else if ("```json".startsWith(fenceBuffer)) {
                // hold
              } else {
                visibleChunk += fenceBuffer[0];
                fenceBuffer = fenceBuffer.slice(1);
                while (fenceBuffer.length > 0 && !"```json".startsWith(fenceBuffer)) {
                  visibleChunk += fenceBuffer[0];
                  fenceBuffer = fenceBuffer.slice(1);
                }
              }
            } else {
              if (fenceBuffer.endsWith("```")) {
                insideJsonBlock = false;
                fenceBuffer = "";
                onProgressivePreview?.(null);
              } else if ("```".startsWith(fenceBuffer)) {
                // hold — but accumulate non-fence chars for preview
                jsonBlockContent += fenceBuffer.slice(0, -fenceBuffer.length);
              } else {
                jsonBlockContent += fenceBuffer[0];
                jsonBlockCharsSinceLastPreview++;
                fenceBuffer = fenceBuffer.slice(1);
                while (fenceBuffer.length > 0 && !"```".startsWith(fenceBuffer)) {
                  jsonBlockContent += fenceBuffer[0];
                  jsonBlockCharsSinceLastPreview++;
                  fenceBuffer = fenceBuffer.slice(1);
                }
              }
            }
          }
          visibleContent += visibleChunk;

          // Progressive preview: attempt partial parse periodically
          if (insideJsonBlock && onProgressivePreview && jsonBlockCharsSinceLastPreview >= 200) {
            const now = Date.now();
            if (now - lastPreviewTime >= 500) {
              lastPreviewTime = now;
              jsonBlockCharsSinceLastPreview = 0;
              const partial = extractPartialLottie(jsonBlockContent);
              if (partial) onProgressivePreview(partial);
            }
          }

          if (!assistantMsgId) {
            assistantMsgId = crypto.randomUUID();
            setMessages((prev) => [...prev, { id: assistantMsgId!, role: "assistant", content: visibleContent }]);
          } else {
            const msgId = assistantMsgId;
            const currentVisible = visibleContent;
            setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: currentVisible } : m));
          }
        } else if (parsed.type === "repairing") {
          setIsRepairing(true);
        } else if (parsed.type === "repair_token") {
          const tokenText = parsed.text || "";
          let visibleChunk = "";
          for (const ch of tokenText) {
            repairFenceBuffer += ch;
            if (!repairInsideJsonBlock) {
              if (repairFenceBuffer.endsWith("```json")) {
                visibleChunk = visibleChunk.slice(0, -("```json".length - 1));
                repairInsideJsonBlock = true;
                repairFenceBuffer = "";
              } else if ("```json".startsWith(repairFenceBuffer)) {
                // hold
              } else {
                visibleChunk += repairFenceBuffer[0];
                repairFenceBuffer = repairFenceBuffer.slice(1);
                while (repairFenceBuffer.length > 0 && !"```json".startsWith(repairFenceBuffer)) {
                  visibleChunk += repairFenceBuffer[0];
                  repairFenceBuffer = repairFenceBuffer.slice(1);
                }
              }
            } else {
              if (repairFenceBuffer.endsWith("```")) {
                repairInsideJsonBlock = false;
                repairFenceBuffer = "";
              } else if ("```".startsWith(repairFenceBuffer)) {
                // hold
              } else {
                repairFenceBuffer = repairFenceBuffer.slice(1);
                while (repairFenceBuffer.length > 0 && !"```".startsWith(repairFenceBuffer)) {
                  repairFenceBuffer = repairFenceBuffer.slice(1);
                }
              }
            }
          }
          repairVisibleContent += visibleChunk;

          if (!assistantMsgId) {
            assistantMsgId = crypto.randomUUID();
            setMessages((prev) => [...prev, { id: assistantMsgId!, role: "assistant", content: repairVisibleContent, isRepair: true }]);
          } else {
            const msgId = assistantMsgId;
            const currentVisible = repairVisibleContent;
            setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: currentVisible, isRepair: true } : m));
          }
        } else if (parsed.type === "done") {
          setIsRepairing(false);
          const doneLottieJson = parsed.lottieJson as object | undefined;
          const donePreviousLottieJson = parsed.previousLottieJson as object | undefined;
          if (!currentAnimationId && parsed.animationId) {
            setCurrentAnimationId(parsed.animationId);
            onAnimationCreated?.(parsed.animationId, doneLottieJson);
            if (doneLottieJson) onAnimationUpdated?.(parsed.animationId, doneLottieJson);
          } else if (doneLottieJson) {
            const captureId = currentAnimationId || parsed.animationId;
            if (captureId) onAnimationUpdated?.(captureId, doneLottieJson);
          }
          if (assistantMsgId && parsed.reply) {
            const msgId = assistantMsgId;
            const warningText = parsed.warning as string | undefined;
            const suggestionsList = parsed.suggestions;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: parsed.reply!, warning: warningText, isRepair: undefined, suggestions: suggestionsList, lottieJson: doneLottieJson, previousLottieJson: donePreviousLottieJson } : m
              )
            );
          }
          if (parsed.command && typeof parsed.command === "object" && (parsed.command as Record<string, unknown>).type) {
            onCommand?.(parsed.command as Command);
          }
        } else if (parsed.type === "quality_hints") {
          if (assistantMsgId && Array.isArray(parsed.hints)) {
            const msgId = assistantMsgId;
            const hints = parsed.hints as import("@/lib/chat-types").QualityHint[];
            setMessages((prev) =>
              prev.map((m) => m.id === msgId ? { ...m, qualityHints: hints } : m)
            );
          }
        } else if (parsed.type === "error") {
          setError(parsed.error || "An unexpected error occurred");
        }
      }
    }
  }, [currentAnimationId, setCurrentAnimationId, onAnimationCreated, onAnimationUpdated, onCommand, designTokens, hasDesignTokens, setMessages, onProgressivePreview]);

  const handleSend = useCallback(async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || isThinking || isStreaming) return;

    const command = parseCommand(text);
    if (command) {
      // Commands that stream through the LLM
      const streamCommands = new Set([
        "style", "style_custom", "animate", "compose",
        "sequence_create", "sequence_add", "sequence_list", "sequence_reorder", "sequence_delete",
        "critique", "polish", "layers", "duplicate_layer", "delete_layer", "rename_layer",
      ]);

      if (streamCommands.has(command.type)) {
        let messageText = text;
        if (command.type === "style") {
          messageText = `[STYLE: ${(command as { style: StyleName }).style}] ${STYLE_INSTRUCTIONS[(command as { style: StyleName }).style]}`;
        } else if (command.type === "style_custom") {
          messageText = `[STYLE_CUSTOM: ${(command as { description: string }).description}] Restyle the animation to match this visual style description: ${(command as { description: string }).description}. Preserve all motion/keyframes/timing. Only modify visual properties (colors, fills, strokes, gradients, opacity, stroke widths).`;
        } else if (command.type === "animate") {
          messageText = `[ANIMATE: ${(command as { animation: AnimationPreset }).animation}] ${ANIMATE_INSTRUCTIONS[(command as { animation: AnimationPreset }).animation]}`;
        }

        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        setIsThinking(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await streamResponse(messageText, undefined, controller.signal);
        } catch (err) {
          if (!(err instanceof Error && err.name === "AbortError")) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      if (command.type === "style_list") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        const lines = VALID_STYLES.map((s) => `- **${s}** — ${STYLE_DESCRIPTIONS[s]}`);
        const listing = `**${t("helpStyle")}**\n\n${lines.join("\n")}\n\n${t("styleListHint")}`;
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: listing }]);
        return;
      }

      if (command.type === "import") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        setIsThinking(true);
        try {
          const response = await fetch("/api/animations/import-url", {
            method: "POST",
            body: JSON.stringify({ url: command.url }),
            headers: { "Content-Type": "application/json" },
          });
          const data = await response.json();
          if (response.ok) {
            onAnimationCreated?.(data.id);
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.message || `📥 Imported "${data.name}" from URL. You can now modify it — try describing what you want to change!` }]);
          } else {
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `⚠️ Import failed: ${data.error || "Unknown error"}` }]);
          }
        } catch (err) {
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `⚠️ Import failed: ${err instanceof Error ? err.message : "An unexpected error occurred"}` }]);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (command.type === "sequence_play") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        setIsThinking(true);
        try {
          const res = await fetch(`/api/sequences?name=${encodeURIComponent(command.name)}`);
          const sequences = await res.json();
          if (!res.ok || !sequences.length) {
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: tSeq("sequenceNotFound", { name: command.name }) }]);
          } else {
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `▶ ${sequences[0].name}`, sequenceId: sequences[0].id }]);
          }
        } catch {
          setError("Failed to load sequence");
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (command.type === "sequence_show") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        setIsThinking(true);
        try {
          const res = await fetch(`/api/sequences?name=${encodeURIComponent(command.name)}`);
          const sequences = await res.json();
          if (!res.ok || !sequences.length) {
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: tSeq("sequenceNotFound", { name: command.name }) }]);
          } else {
            const seq = sequences[0];
            const items = seq.items || [];
            const details = `**${seq.name}**${seq.description ? ` — ${seq.description}` : ""}\n\n` +
              (items.length === 0
                ? "No animations in this sequence yet."
                : items.map((item: { animation_name: string | null; position: number; transition_type: string }, i: number) =>
                    `${i + 1}. ${item.animation_name || "Untitled"} _(${item.transition_type})_`
                  ).join("\n"));
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: details, sequenceId: items.length > 0 ? seq.id : undefined }]);
          }
        } catch {
          setError("Failed to load sequence");
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (command.type === "theme") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        let feedback: string;
        const sub = command.subcommand;
        if (sub.action === "set") {
          setDesignToken(sub.key as keyof typeof designTokens, sub.value);
          feedback = `🎨 Design token "${sub.key}" set to ${sub.value}`;
        } else if (sub.action === "clear") {
          clearDesignTokens();
          feedback = "🧹 All design tokens cleared";
        } else {
          const entries = Object.entries(designTokens).filter(([, v]) => v);
          feedback = entries.length === 0
            ? "No design tokens set. Use `/theme set <key> <value>` to set one."
            : "**Current design tokens:**\n" + entries.map(([k, v]) => `- **${k}**: ${v}`).join("\n");
        }
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: feedback }]);
        return;
      }

      if (command.type === "variations") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        const assistantMsgId = crypto.randomUUID();
        setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: t("variationsGenerating"), variationsLoading: true, variations: [] }]);
        setIsThinking(true);
        try {
          const res = await apiFetch("/api/generate/variations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: command.prompt }),
          });
          const data = await res.json();
          if (!res.ok) {
            setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, content: `⚠️ ${data.error || `Request failed (${res.status})`}`, variationsLoading: false, variations: undefined } : m));
          } else {
            setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, content: t("variationsReady"), variationsLoading: false, variations: data.variations } : m));
          }
        } catch (err) {
          setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, content: `⚠️ ${err instanceof Error ? err.message : "An unexpected error occurred"}`, variationsLoading: false, variations: undefined } : m));
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (command.type === "presets") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
        setInput("");
        setError(null);
        setIsThinking(true);
        try {
          if (command.subcommand === "list") {
            const res = await apiFetch("/api/presets");
            const presets = await res.json();
            const listing = presets.length === 0
              ? "No animation style presets saved yet. Use `/presets save <name>` after creating an animation to save its style."
              : `**Animation Style Presets** (${presets.length}):\n\n` + presets.map((p: { name: string; description?: string; is_builtin?: number }) =>
                  `- **${p.name}**${p.description ? ` — ${p.description}` : ""}${p.is_builtin ? " _(built-in)_" : ""}`
                ).join("\n");
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: listing }]);
          } else if (command.subcommand.action === "save") {
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const savePrompt = `Save the current animation style as a preset named "${command.subcommand.name}"${command.subcommand.description ? ` (${command.subcommand.description})` : ""}.`;
            try {
              await streamResponse(savePrompt, undefined, controller.signal);
            } finally {
              abortControllerRef.current = null;
            }
          } else {
            const controller = new AbortController();
            abortControllerRef.current = controller;
            try {
              await streamResponse(text, undefined, controller.signal);
            } finally {
              abortControllerRef.current = null;
            }
          }
        } catch (err) {
          if (!(err instanceof Error && err.name === "AbortError")) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
          }
        } finally {
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      if (command.type === "random") {
        const randomPrompt = getRandomPrompt();
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: `${t("randomSelected", { prompt: randomPrompt })}` }]);
        setInput("");
        setError(null);
        setIsThinking(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          await streamResponse(randomPrompt, undefined, controller.signal);
        } catch (err) {
          if (!(err instanceof Error && err.name === "AbortError")) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      // Remaining local-only commands (play, pause, speed, etc.)
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
      setInput("");

      let feedback: string = "";
      switch (command.type) {
        case "play": feedback = "▶️ Playing"; break;
        case "pause": feedback = "⏸️ Paused"; break;
        case "speed": feedback = `⚡ Speed set to ${command.speed}x`; break;
        case "loop": feedback = "🔁 Loop mode"; break;
        case "once": feedback = "1️⃣ Play once"; break;
        case "export_gif": feedback = "📦 Exporting GIF..."; break;
        case "export_apng": feedback = "📦 Exporting APNG..."; break;
        case "export_video": feedback = "📦 Exporting video..."; break;
        case "export_json": feedback = "📦 Exporting JSON..."; break;
        case "export_dotlottie": feedback = "📦 Exporting dotLottie..."; break;
        case "undo": feedback = "↩️ Undo"; break;
        case "redo": feedback = "↪️ Redo"; break;
        case "resize": feedback = `🔲 Resized to ${command.width}x${command.height}`; break;
        case "background": feedback = `🎨 Background set to ${command.color}`; break;
        case "fullscreen": feedback = "⛶ Fullscreen toggled"; break;
        case "optimize": feedback = "✨ Optimizing..."; break;
        case "duration": feedback = `⏱️ ${t("durationSet", { duration: (command.durationMs / 1000).toFixed(1) })}`; break;
        case "goto": {
          const { value, unit } = command.target;
          const label = unit === "frame" ? `frame ${value}` : unit === "seconds" ? `${value}s` : unit === "ms" ? `${value}ms` : `${value}%`;
          feedback = `⏭️ ${t("gotoFrame", { target: label })}`;
          break;
        }
        case "marker_add":
          feedback = `🏷️ Marker "${command.name}" added (frames ${command.startFrame}-${command.endFrame})`;
          break;
        case "marker_remove":
          feedback = `🗑️ Marker "${command.name}" removed`;
          break;
        case "marker_list":
          feedback = `🏷️ Use the timeline to view markers, or check the JSON editor for the "markers" array.`;
          break;
        case "marker_clear":
          feedback = `🧹 All markers cleared`;
          break;
        case "help": {
          feedback = `**${t("helpTitle")}**\n\n`
            + `**${t("helpPlayback")}**\n`
            + `\`/play\` — ${t("helpPlay")}\n`
            + `\`/pause\` — ${t("helpPause")}\n`
            + `\`/speed <n>\` — ${t("helpSpeed")}\n`
            + `\`/duration <time>\` — ${t("helpDuration")}\n`
            + `\`/goto <target>\` — ${t("helpGoto")}\n`
            + `\`/loop\` — ${t("helpLoop")}\n`
            + `\`/once\` — ${t("helpOnce")}\n\n`
            + `**${t("helpExport")}**\n`
            + `\`/export gif\` — ${t("helpExportGif")}\n`
            + `\`/export apng\` — ${t("helpExportApng")}\n`
            + `\`/export video\` — ${t("helpExportVideo")}\n`
            + `\`/export json\` — ${t("helpExportJson")}\n`
            + `\`/export dotlottie\` — ${t("helpExportDotlottie")}\n\n`
            + `**${t("helpCanvas")}**\n`
            + `\`/resize <w>x<h>\` — ${t("helpResize")}\n`
            + `\`/bg <color>\` — ${t("helpBg")}\n`
            + `\`/fullscreen\` — ${t("helpFullscreen")}\n\n`
            + `**${t("helpEdit")}**\n`
            + `\`/undo\` — ${t("helpUndo")}\n`
            + `\`/redo\` — ${t("helpRedo")}\n`
            + `\`/optimize\` — ${t("helpOptimize")}\n\n`
            + `**${t("helpStyle")}**\n`
            + `\`/style\` — ${t("helpStyleList")}\n`
            + `\`/style <name>\` — ${t("helpStyleCmd")}\n`
            + `\`/style <description>\` — ${t("helpStyleCustom")}\n\n`
            + `**${t("helpAnimate")}**\n`
            + `\`/animate <preset>\` — ${t("helpAnimateCmd")}\n\n`
            + `**Markers**\n`
            + `\`/marker add <name> <start>-<end>\` — Add a named segment\n`
            + `\`/marker remove <name>\` — Remove a marker\n`
            + `\`/marker list\` — List all markers\n`
            + `\`/marker clear\` — Remove all markers\n\n`
            + `**Import**\n`
            + `\`/import <url>\` — Import a Lottie animation from URL for remixing\n\n`
            + `**Compose**\n`
            + `\`/compose <id>\` — Compose layers from another animation into this one\n\n`
            + `**${t("helpRandom")}**\n`
            + `\`/random\` — ${t("helpRandomCmd")}\n\n`
            + `**${t("helpCritique")}**\n`
            + `\`/critique\` — ${t("helpCritiqueCmd")}\n`
            + `\`/polish\` — ${t("helpPolishCmd")}\n\n`
            + `**${t("helpPresets")}**\n`
            + `\`/presets\` — ${t("helpPresetsList")}\n`
            + `\`/presets save <name>\` — ${t("helpPresetsSave")}\n`
            + `\`/presets delete <name>\` — ${t("helpPresetsDelete")}\n`
            + `\`/presets rename <old> <new>\` — ${t("helpPresetsRename")}\n`
            + `\`/presets info <name>\` — ${t("helpPresetsInfo")}\n\n`
            + `**${t("helpTheme")}**\n`
            + `\`/theme\` — ${t("helpThemeShow")}\n`
            + `\`/theme set <key> <value>\` — ${t("helpThemeSet")}\n`
            + `\`/theme clear\` — ${t("helpThemeClear")}\n\n`
            + `**${t("helpVariations")}**\n`
            + `\`/variations <prompt>\` — ${t("helpVariationsCmd")}\n\n`
            + `**${t("helpSequence")}**\n`
            + `\`/sequence <id>\` — ${t("helpSequenceCmd")}\n`
            + `\`/sequence play <name>\` — ${t("helpSequencePlayCmd")}\n\n`
            + `**${t("helpLayers")}**\n`
            + `\`/layers\` — ${t("helpLayersList")}\n`
            + `\`/duplicate-layer <name>\` — ${t("helpDuplicateLayer")}\n`
            + `\`/delete-layer <name>\` — ${t("helpDeleteLayer")}\n`
            + `\`/rename-layer <old> <new>\` — ${t("helpRenameLayer")}\n\n`
            + `**${t("helpHelpSection")}**\n`
            + `\`/help\` — ${t("helpHelp")}`;
          break;
        }
        case "error": feedback = `⚠️ ${command.message}`; break;
      }

      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: feedback }]);
      if (command.type !== "error" && command.type !== "help") onCommand?.(command);
      return;
    }

    // Normal message (not a command)
    setError(null);
    const imageDataUrl = pendingImage;

    if (!isOnline) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text, imageUrl: imageDataUrl || undefined }]);
      setInput("");
      setPendingImage(null);
      enqueueMessage(currentAnimationId || "", text, imageDataUrl || undefined)
        .then(() => setPendingCount((c) => c + 1))
        .catch(() => {});
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Message queued — will be sent when you're back online." }]);
      return;
    }

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text, imageUrl: imageDataUrl || undefined }]);
    setInput("");
    setPendingImage(null);
    setIsThinking(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const layerCtx = extractLayerContext(animationDataProp, selectedLayerIndex);
    if (layerCtx) onLayerContextConsumed?.();

    try {
      await streamResponse(text, undefined, controller.signal, imageDataUrl || undefined, undefined, layerCtx);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [input, isThinking, isStreaming, pendingImage, streamResponse, onCommand, designTokens, setDesignToken, clearDesignTokens, onAnimationCreated, t, animationDataProp, currentAnimationId, isOnline, onLayerContextConsumed, selectedLayerIndex, tSeq, setMessages, setPendingCount]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const handleRetry = useCallback(async (assistantMsgId: string) => {
    if (isThinking || isStreaming) return;
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex < 1) return;
    let userMsgIndex = msgIndex - 1;
    while (userMsgIndex >= 0 && messages[userMsgIndex].role !== "user") userMsgIndex--;
    if (userMsgIndex < 0) return;
    const userText = messages[userMsgIndex].content;
    setMessages((prev) => prev.slice(0, msgIndex + 1));
    setError(null);
    setRetryingMsgId(assistantMsgId);
    setIsThinking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      await streamResponse(userText, assistantMsgId, controller.signal, undefined, true);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
      setRetryingMsgId(null);
    }
  }, [isThinking, isStreaming, messages, streamResponse, setMessages]);

  const handleEditSave = useCallback(async () => {
    if (!editingMsgId || !editText.trim() || !currentAnimationId || isThinking || isStreaming) return;
    const msgIndex = messages.findIndex((m) => m.id === editingMsgId);
    if (msgIndex < 0) return;
    try {
      const res = await fetch(`/api/chat/${currentAnimationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: editingMsgId, newContent: editText.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to edit message");
        return;
      }
    } catch {
      setError("Failed to edit message");
      return;
    }
    const updatedMessages = messages.slice(0, msgIndex + 1).map((m) =>
      m.id === editingMsgId ? { ...m, content: editText.trim() } : m
    );
    setMessages(updatedMessages);
    const savedText = editText.trim();
    setEditingMsgId(null);
    setEditText("");
    setError(null);
    setIsThinking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      await streamResponse(savedText, undefined, controller.signal);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [editingMsgId, editText, currentAnimationId, isThinking, isStreaming, messages, streamResponse, setMessages]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsThinking(false);
    setIsStreaming(false);
    setIsRepairing(false);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const handleVariationSelect = useCallback((msgId: string, variation: Variation) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, content: t("variationSelected", { style: variation.style }), variations: undefined, variationsLoading: false } : m
      )
    );
    if (currentAnimationId) {
      onAnimationUpdated?.(currentAnimationId, variation.animation);
    } else {
      onAnimationCreated?.("variation-" + crypto.randomUUID(), variation.animation);
    }
  }, [currentAnimationId, onAnimationCreated, onAnimationUpdated, t, setMessages]);

  return {
    input, setInput,
    isThinking, isStreaming, isRepairing,
    retryingMsgId,
    editingMsgId, setEditingMsgId, editText, setEditText,
    error, setError,
    pendingImage, setPendingImage,
    handleSend, handleSendRef,
    handleRetry, handleEditSave, handleStop,
    dismissError,
    handleVariationSelect,
    t, tSeq,
    hasDesignTokens,
  };
}
