"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from 'next-intl';
import MarkdownMessage from "./MarkdownMessage";
import InlineLottiePreview from "./InlineLottiePreview";
import CommandAutocomplete, { type CommandDef } from "./CommandAutocomplete";
import VoiceInput from "./VoiceInput";
import { parseCommand, type Command, VALID_STYLES, type StyleName, type AnimationPreset } from "@/lib/commands";
import { parseLottieFile } from "@/lib/importLottie";
import { apiFetch } from "@/lib/apiFetch";
import { useDesignTokens } from "@/contexts/DesignTokensContext";
import PromptSuggestions from "./PromptSuggestions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
  isRepair?: boolean;
  suggestions?: string[];
  imageUrl?: string;
  lottieJson?: object;
  previousLottieJson?: object;
}

interface ChatPanelProps {
  animationId?: string;
  insertText?: string;
  onAnimationCreated?: (id: string, data?: object) => void;
  onAnimationUpdated?: (id: string, data: object) => void;
  onCommand?: (command: Command) => void;
  initialPrompt?: string;
}

// Image upload constraints (module-level to avoid recreating on each render)
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_ANIMATION_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ANIMATION_EXTENSIONS = [".json", ".svg", ".lottie"];
const LOTTIE_REQUIRED_FIELDS = ["v", "fr", "ip", "op", "w", "h", "layers"] as const;

// Style command descriptions for LLM instructions
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

// Animation preset descriptions for LLM instructions
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

export default function ChatPanel({ animationId, insertText, onAnimationCreated, onAnimationUpdated, onCommand, initialPrompt }: ChatPanelProps) {
  const t = useTranslations('chat');
  const { tokens: designTokens, setToken: setDesignToken, clearTokens: clearDesignTokens, hasTokens: hasDesignTokens } = useDesignTokens();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [retryingMsgId, setRetryingMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentAnimationId, setCurrentAnimationId] = useState<string | undefined>(animationId);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef<string | undefined>(undefined);
  const autoDescribeTriggeredRef = useRef<string | undefined>(undefined);
  const handleSendRef = useRef<((prompt?: string) => Promise<void>) | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [prevAnimationId, setPrevAnimationId] = useState<string | undefined>(animationId);
  const [prevInsertText, setPrevInsertText] = useState<string | undefined>(insertText);

  // Keep currentAnimationId in sync when prop changes (derived state pattern)
  if (animationId !== prevAnimationId) {
    setPrevAnimationId(animationId);
    setCurrentAnimationId(animationId);
  }

  // Append text from layer panel selection (derived state pattern)
  if (insertText && insertText !== prevInsertText) {
    setPrevInsertText(insertText);
    setInput((prev) => prev + insertText);
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, isStreaming, scrollToBottom]);

  // Load conversation history on mount / when animationId changes
  useEffect(() => {
    if (!animationId) return;
    // Avoid re-loading if we already loaded for this id
    if (historyLoadedRef.current === animationId) return;
    historyLoadedRef.current = animationId;

    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/${animationId}`);
        if (!res.ok) return; // 404 for new animations is fine
        const data = await res.json();
        if (cancelled) return;
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; imageUrl?: string; lottieJson?: object; previousLottieJson?: object }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              imageUrl: m.imageUrl,
              lottieJson: m.lottieJson || undefined,
              previousLottieJson: m.previousLottieJson || undefined,
            }))
          );
        } else if (data.templateSource && autoDescribeTriggeredRef.current !== animationId) {
          // Remix with empty history — auto-trigger describe
          autoDescribeTriggeredRef.current = animationId;
          handleSendRef.current?.("Describe this animation and suggest ways I can modify it");
        }
      } catch {
        // Silently ignore history load errors — user can still chat
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [animationId]);

  // Keep chat input visible when mobile keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      if (inputAreaRef.current) {
        // When keyboard opens, visualViewport.height shrinks.
        // Scroll the input into view so it stays accessible.
        inputAreaRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Auto-resize textarea to fit content (max ~5 rows)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // Focus input when insertText changes
  useEffect(() => {
    if (!insertText) return;
    inputRef.current?.focus();
  }, [insertText]);

  // Shared streaming fetch logic. `existingAssistantMsgId` is set during retry
  // to update an existing message in-place instead of appending a new one.
  const streamResponse = useCallback(async (text: string, existingAssistantMsgId?: string, signal?: AbortSignal, imageDataUrl?: string, regenerate?: boolean) => {
    const res = await apiFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animationId: currentAnimationId,
        message: text,
        ...(imageDataUrl ? { image: imageDataUrl } : {}),
        ...(regenerate ? { regenerate: true } : {}),
        ...(hasDesignTokens ? { designTokens } : {}),
      }),
      signal,
    });

    // Fallback: if not SSE (e.g. error JSON response), handle like old path
    const contentType = res.headers.get("Content-Type") || "";
    if (!contentType.includes("text/event-stream")) {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const sec = errData.retryAfterSec;
          throw new Error(sec ? `You're going fast — try again in ${sec} seconds 🌸` : "You're going fast — slow down 🌸");
        }
        const errMsg = errData.error || `Request failed (${res.status})`;
        throw new Error(errMsg);
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
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
      setIsThinking(false);
      return;
    }

    // SSE streaming path
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let sseBuffer = "";
    let assistantMsgId: string | null = existingAssistantMsgId ?? null;
    let visibleContent = "";
    let insideJsonBlock = false;
    let fenceBuffer = "";
    let repairVisibleContent = "";
    let repairInsideJsonBlock = false;
    let repairFenceBuffer = "";

    setIsThinking(false);
    setIsStreaming(true);

    // For retry, clear the old content immediately so it streams fresh
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

        const data = trimmed.slice(6);
        let parsed: { type: string; text?: string; reply?: string; lottieJson?: unknown; previousLottieJson?: unknown; animationId?: string; error?: string; warning?: string; suggestions?: string[]; command?: unknown };
        try {
          parsed = JSON.parse(data);
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
                // Potential partial match — hold in buffer
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
              } else if ("```".startsWith(fenceBuffer)) {
                // Potential partial closing fence
              } else {
                fenceBuffer = fenceBuffer.slice(1);
                while (fenceBuffer.length > 0 && !"```".startsWith(fenceBuffer)) {
                  fenceBuffer = fenceBuffer.slice(1);
                }
              }
            }
          }

          visibleContent += visibleChunk;

          if (!assistantMsgId) {
            assistantMsgId = crypto.randomUUID();
            const newMsg: Message = {
              id: assistantMsgId,
              role: "assistant",
              content: visibleContent,
            };
            setMessages((prev) => [...prev, newMsg]);
          } else {
            const msgId = assistantMsgId;
            const currentVisible = visibleContent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: currentVisible } : m
              )
            );
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
                // Potential partial match — hold in buffer
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
                // Potential partial closing fence
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
            const newMsg: Message = {
              id: assistantMsgId,
              role: "assistant",
              content: repairVisibleContent,
              isRepair: true,
            };
            setMessages((prev) => [...prev, newMsg]);
          } else {
            const msgId = assistantMsgId;
            const currentVisible = repairVisibleContent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: currentVisible, isRepair: true } : m
              )
            );
          }
        } else if (parsed.type === "done") {
          setIsRepairing(false);
          const doneLottieJson = parsed.lottieJson as object | undefined;
          const donePreviousLottieJson = parsed.previousLottieJson as object | undefined;
          if (!currentAnimationId && parsed.animationId) {
            setCurrentAnimationId(parsed.animationId);
            onAnimationCreated?.(parsed.animationId, doneLottieJson);
            // Trigger thumbnail capture for new animations
            if (doneLottieJson) {
              onAnimationUpdated?.(parsed.animationId, doneLottieJson);
            }
          } else if (doneLottieJson) {
            // Existing animation was updated — trigger thumbnail capture
            const captureId = currentAnimationId || parsed.animationId;
            if (captureId) {
              onAnimationUpdated?.(captureId, doneLottieJson);
            }
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
          // Execute command if present in the response
          if (parsed.command && typeof parsed.command === "object" && (parsed.command as Record<string, unknown>).type) {
            onCommand?.(parsed.command as Command);
          }
        } else if (parsed.type === "error") {
          setError(parsed.error || "An unexpected error occurred");
        }
      }
    }
  }, [currentAnimationId, onAnimationCreated, onAnimationUpdated, onCommand, designTokens, hasDesignTokens]);

  const handleSend = useCallback(async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || isThinking || isStreaming) return;

    // Slash command handling — intercept before API call
    const command = parseCommand(text);
    if (command) {
      // Style command is special: it sends a message to the LLM for processing
      if (command.type === "style") {
        const styleMessage = `[STYLE: ${command.style}] ${STYLE_INSTRUCTIONS[command.style]}`;

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError(null);
        setIsThinking(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await streamResponse(styleMessage, undefined, controller.signal);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // User cancelled — not an error
          } else {
            const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(errMsg);
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      // Animate command is special: it sends a message to the LLM for processing
      if (command.type === "animate") {
        const animateMessage = `[ANIMATE: ${command.animation}] ${ANIMATE_INSTRUCTIONS[command.animation]}`;

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError(null);
        setIsThinking(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await streamResponse(animateMessage, undefined, controller.signal);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // User cancelled — not an error
          } else {
            const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(errMsg);
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      // Import command: fetch animation from URL
      if (command.type === "import") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError(null);
        setIsThinking(true);

        try {
          const response = await fetch('/api/animations/import-url', {
            method: 'POST',
            body: JSON.stringify({ url: command.url }),
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await response.json();

          if (response.ok) {
            onAnimationCreated?.(data.id);
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `📥 Imported "${data.name}" from URL. You can now modify it — try describing what you want to change!`,
            };
            setMessages((prev) => [...prev, assistantMessage]);
          } else {
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `⚠️ Import failed: ${data.error || 'Unknown error'}`,
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ Import failed: ${errMsg}`,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      // Compose command: send to server for layer composition
      if (command.type === "compose") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError(null);
        setIsThinking(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await streamResponse(text, undefined, controller.signal);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // User cancelled — not an error
          } else {
            const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(errMsg);
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      // Sequence command: send to server for temporal composition
      if (command.type === "sequence") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setError(null);
        setIsThinking(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          await streamResponse(text, undefined, controller.signal);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // User cancelled — not an error
          } else {
            const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(errMsg);
          }
        } finally {
          abortControllerRef.current = null;
          setIsRepairing(false);
          setIsThinking(false);
          setIsStreaming(false);
        }
        return;
      }

      // Theme command: handle design token management locally
      if (command.type === "theme") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
        };
        setMessages((prev) => [...prev, userMessage]);
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
          // show
          const entries = Object.entries(designTokens).filter(([, v]) => v);
          if (entries.length === 0) {
            feedback = "No design tokens set. Use `/theme set <key> <value>` to set one.";
          } else {
            feedback = "**Current design tokens:**\n" + entries.map(([k, v]) => `- **${k}**: ${v}`).join("\n");
          }
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: feedback,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Build feedback message based on command type
      let feedback: string;
      switch (command.type) {
        case "play": feedback = "\u25b6\ufe0f Playing"; break;
        case "pause": feedback = "\u23f8\ufe0f Paused"; break;
        case "speed": feedback = `\u26a1 Speed set to ${command.speed}x`; break;
        case "loop": feedback = "\ud83d\udd01 Loop mode"; break;
        case "once": feedback = "1\ufe0f\u20e3 Play once"; break;
        case "export_gif": feedback = "\ud83d\udce6 Exporting GIF..."; break;
        case "export_apng": feedback = "\ud83d\udce6 Exporting APNG..."; break;
        case "export_video": feedback = "\ud83d\udce6 Exporting video..."; break;
        case "export_json": feedback = "\ud83d\udce6 Exporting JSON..."; break;
        case "export_dotlottie": feedback = "\ud83d\udce6 Exporting dotLottie..."; break;
        case "undo": feedback = "\u21a9\ufe0f Undo"; break;
        case "redo": feedback = "\u21aa\ufe0f Redo"; break;
        case "resize": feedback = `\ud83d\udd32 Resized to ${command.width}x${command.height}`; break;
        case "background": feedback = `\ud83c\udfa8 Background set to ${command.color}`; break;
        case "fullscreen": feedback = "\u26f6 Fullscreen toggled"; break;
        case "optimize": feedback = "\u2728 Optimizing..."; break;
        case "duration": feedback = `\u23f1\ufe0f ${t('durationSet', { duration: (command.durationMs / 1000).toFixed(1) })}`; break;
        case "goto": {
          const { value, unit } = command.target;
          const label = unit === "frame" ? `frame ${value}` : unit === "seconds" ? `${value}s` : unit === "ms" ? `${value}ms` : `${value}%`;
          feedback = `\u23ed\ufe0f ${t('gotoFrame', { target: label })}`;
          break;
        }
        case "marker_add":
          feedback = `🏷️ Marker "${command.name}" added (frames ${command.startFrame}-${command.endFrame})`;
          break;
        case "marker_remove":
          feedback = `🗑️ Marker "${command.name}" removed`;
          break;
        case "marker_list": {
          feedback = `🏷️ Use the timeline to view markers, or check the JSON editor for the "markers" array.`;
          break;
        }
        case "marker_clear":
          feedback = `🧹 All markers cleared`;
          break;
        case "help": {
          feedback = `**${t('helpTitle')}**\n\n`
            + `**${t('helpPlayback')}**\n`
            + `\`/play\` — ${t('helpPlay')}\n`
            + `\`/pause\` — ${t('helpPause')}\n`
            + `\`/speed <n>\` — ${t('helpSpeed')}\n`
            + `\`/duration <time>\` — ${t('helpDuration')}\n`
            + `\`/goto <target>\` — ${t('helpGoto')}\n`
            + `\`/loop\` — ${t('helpLoop')}\n`
            + `\`/once\` — ${t('helpOnce')}\n\n`
            + `**${t('helpExport')}**\n`
            + `\`/export gif\` — ${t('helpExportGif')}\n`
            + `\`/export apng\` — ${t('helpExportApng')}\n`
            + `\`/export video\` — ${t('helpExportVideo')}\n`
            + `\`/export json\` — ${t('helpExportJson')}\n`
            + `\`/export dotlottie\` — ${t('helpExportDotlottie')}\n\n`
            + `**${t('helpCanvas')}**\n`
            + `\`/resize <w>x<h>\` — ${t('helpResize')}\n`
            + `\`/bg <color>\` — ${t('helpBg')}\n`
            + `\`/fullscreen\` — ${t('helpFullscreen')}\n\n`
            + `**${t('helpEdit')}**\n`
            + `\`/undo\` — ${t('helpUndo')}\n`
            + `\`/redo\` — ${t('helpRedo')}\n`
            + `\`/optimize\` — ${t('helpOptimize')}\n\n`
            + `**${t('helpStyle')}**\n`
            + `\`/style <name>\` — ${t('helpStyleCmd')}\n\n`
            + `**${t('helpAnimate')}**\n`
            + `\`/animate <preset>\` — ${t('helpAnimateCmd')}\n\n`
            + `**Markers**\n`
            + `\`/marker add <name> <start>-<end>\` — Add a named segment\n`
            + `\`/marker remove <name>\` — Remove a marker\n`
            + `\`/marker list\` — List all markers\n`
            + `\`/marker clear\` — Remove all markers\n\n`
            + `**Import**\n`
            + `\`/import <url>\` — Import a Lottie animation from URL for remixing\n\n`
            + `**Compose**\n`
            + `\`/compose <id>\` — Compose layers from another animation into this one\n\n`
            + `**${t('helpHelpSection')}**\n`
            + `\`/help\` — ${t('helpHelp')}`;
          break;
        }
        case "error": feedback = `\u26a0\ufe0f ${command.message}`; break;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: feedback,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (command.type !== "error" && command.type !== "help") {
        onCommand?.(command);
      }
      return;
    }

    setError(null);

    const imageDataUrl = pendingImage;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      imageUrl: imageDataUrl || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPendingImage(null);
    setIsThinking(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamResponse(text, undefined, controller.signal, imageDataUrl || undefined);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — not an error
      } else {
        const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errMsg);
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [input, isThinking, isStreaming, pendingImage, streamResponse, onCommand, designTokens, setDesignToken, clearDesignTokens]);

  // Keep handleSendRef in sync for use in async callbacks (e.g. auto-describe)
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const handleRetry = useCallback(async (assistantMsgId: string) => {
    if (isThinking || isStreaming) return;

    // Find the user message that precedes this assistant message
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex < 1) return;

    let userMsgIndex = msgIndex - 1;
    while (userMsgIndex >= 0 && messages[userMsgIndex].role !== "user") {
      userMsgIndex--;
    }
    if (userMsgIndex < 0) return;

    const userText = messages[userMsgIndex].content;

    // Remove any messages after the target assistant message, keep it for in-place update
    setMessages((prev) => prev.slice(0, msgIndex + 1));

    setError(null);
    setRetryingMsgId(assistantMsgId);
    setIsThinking(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamResponse(userText, assistantMsgId, controller.signal, undefined, true);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — not an error
      } else {
        const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errMsg);
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
      setRetryingMsgId(null);
    }
  }, [isThinking, isStreaming, messages, streamResponse]);

  const handleEditSave = useCallback(async () => {
    if (!editingMsgId || !editText.trim() || !currentAnimationId || isThinking || isStreaming) return;

    const msgIndex = messages.findIndex((m) => m.id === editingMsgId);
    if (msgIndex < 0) return;

    // Call PATCH to truncate and update
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

    // Truncate local messages: keep up to and including the edited message
    const updatedMessages = messages.slice(0, msgIndex + 1).map((m) =>
      m.id === editingMsgId ? { ...m, content: editText.trim() } : m
    );
    setMessages(updatedMessages);

    const savedText = editText.trim();
    setEditingMsgId(null);
    setEditText("");
    setError(null);
    setIsThinking(true);

    // Re-send with edited text
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamResponse(savedText, undefined, controller.signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled
      } else {
        const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errMsg);
      }
    } finally {
      abortControllerRef.current = null;
      setIsRepairing(false);
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [editingMsgId, editText, currentAnimationId, isThinking, isStreaming, messages, streamResponse]);

  // --- Autocomplete state (adjust during render when input changes) ---
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [prevInput, setPrevInput] = useState(input);
  if (input !== prevInput) {
    setPrevInput(input);
    const trimmed = input.trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      setShowAutocomplete(true);
      setAutocompleteQuery(trimmed);
    } else {
      setShowAutocomplete(false);
      setAutocompleteQuery("");
    }
  }

  const handleAutocompleteSelect = useCallback((cmd: CommandDef) => {
    if (cmd.hasParams) {
      setInput(cmd.command + " ");
    } else {
      setInput(cmd.command);
    }
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }, []);

  const handleAutocompleteDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let the autocomplete handle navigation keys when visible
    if (showAutocomplete && ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) {
      // The CommandAutocomplete component handles these via document-level listener
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsThinking(false);
    setIsStreaming(false);
    setIsRepairing(false);
  }, []);

  const dismissError = useCallback(() => setError(null), []);
  const dismissWarning = useCallback((msgId: string) => {
    setDismissedWarnings((prev) => new Set(prev).add(msgId));
  }, []);

  const processImageFile = useCallback((file: File) => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError(t('unsupportedType'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(t('imageTooBig'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return;
      }
    }
  }, [processImageFile]);

  const processAnimationFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().replace(/^.*\./, '.');

    if (file.size > MAX_ANIMATION_FILE_SIZE) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t('fileTooLarge'),
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    const isSvg = ext === '.svg';
    const isJson = ext === '.json';
    const isDotLottie = ext === '.lottie';

    if (!isJson && !isSvg && !isDotLottie) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t('invalidFileType'),
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    try {
      if (isSvg) {
        // SVG: send to conversion endpoint
        const formData = new FormData();
        formData.append("file", file);

        const res = await apiFetch("/api/import-svg", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errorMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: t('importFailed', { error: errData.error || 'SVG conversion failed' }),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const result = await res.json();
        setCurrentAnimationId(result.id);
        onAnimationCreated?.(result.id, result.data);
        const successMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t('importSuccess'),
        };
        setMessages((prev) => [...prev, successMsg]);
        return;
      }

      // JSON or .lottie
      let lottieData: Record<string, unknown>;
      let name: string;

      if (isDotLottie) {
        const parsed = await parseLottieFile(file);
        lottieData = parsed.data as Record<string, unknown>;
        name = parsed.name;
      } else {
        // JSON file
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          const errorMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: t('invalidJsonParse'),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        // Validate Lottie structure
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          const errorMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: t('invalidLottieJson'),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }
        const obj = parsed as Record<string, unknown>;
        for (const field of LOTTIE_REQUIRED_FIELDS) {
          if (!(field in obj)) {
            const errorMsg: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: t('invalidLottieJson'),
            };
            setMessages((prev) => [...prev, errorMsg]);
            return;
          }
        }

        lottieData = obj;
        name = (lottieData.nm as string) || file.name.replace(/\.json$/i, "") || "Imported Animation";
      }

      // Save via API
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: lottieData }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t('importFailed', { error: errData.error || 'Failed to save animation' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const result = await res.json();
      setCurrentAnimationId(result.id);
      onAnimationCreated?.(result.id, lottieData as object);
      const successMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t('importSuccess'),
      };
      setMessages((prev) => [...prev, successMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t('importFailed', { error: err instanceof Error ? err.message : 'Unknown error' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [t, onAnimationCreated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files?.length) return;

    // Check for animation files first (by extension)
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.toLowerCase().replace(/^.*\./, '.');
      if (ANIMATION_EXTENSIONS.includes(ext)) {
        processAnimationFile(files[i]);
        return;
      }
    }

    // Fall back to image handling
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        processImageFile(files[i]);
        return;
      }
    }
  }, [processImageFile, processAnimationFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearChat = useCallback(async () => {
    if (!currentAnimationId || messages.length === 0) return;
    if (!window.confirm("Clear all chat messages? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/chat/${currentAnimationId}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to clear chat history");
        return;
      }
      setMessages([]);
    } catch {
      setError("Failed to clear chat history");
    }
  }, [currentAnimationId, messages.length]);

  // Find the last assistant message id (for showing regenerate button only on the last one)
  const lastAssistantMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  // Find the last assistant message with suggestions (only show chips on the most recent one)
  const lastSuggestionMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].suggestions?.length) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Chat header with clear button */}
      {messages.length > 0 && (
        <div className="shrink-0 flex items-center justify-end px-3 pt-2">
          <button
            onClick={handleClearChat}
            disabled={isThinking || isStreaming}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
            </svg>
            Clear chat
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <PromptSuggestions
              onSelect={(prompt) => setInput(prompt)}
              hasDesignTokens={hasDesignTokens}
            />
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`group relative max-w-[80%] ${msg.role === "assistant" ? "pr-7" : "pl-7"}`}>
                {editingMsgId === msg.id ? (
                  <div className="flex flex-col gap-2 w-full min-w-[200px]">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-indigo-500 focus:outline-none resize-none overflow-y-auto"
                      rows={3}
                      autoFocus
                    />
                    <p className="text-xs text-amber-400/80">{t('editWarning')}</p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditingMsgId(null); setEditText(""); }}
                        className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={handleEditSave}
                        disabled={!editText.trim()}
                        className="px-2.5 py-1 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('saveAndRegenerate')}
                      </button>
                    </div>
                  </div>
                ) : (
                <div
                  className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-700 text-zinc-100"
                  }`}
                >
                  {msg.role === "assistant" && msg.lottieJson && (
                    <InlineLottiePreview lottieJson={msg.lottieJson} previousLottieJson={msg.previousLottieJson} />
                  )}
                  {retryingMsgId === msg.id && !msg.content ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : msg.isRepair ? (
                    <span className="text-amber-300"><MarkdownMessage content={msg.content} /></span>
                  ) : msg.role === "assistant" ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <>
                      {msg.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- data URL from user upload/paste, not supported by next/Image
                        <img
                          src={msg.imageUrl}
                          alt="Attached"
                          className="max-w-[200px] max-h-[200px] rounded mb-1.5 object-contain"
                        />
                      )}
                      {msg.content}
                    </>
                  )}
                </div>
                )}
                {msg.role === "user" && !isThinking && !isStreaming && editingMsgId !== msg.id && (
                  <button
                    onClick={() => { setEditingMsgId(msg.id); setEditText(msg.content); }}
                    className="absolute top-1.5 -left-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600"
                    aria-label={t('edit')}
                    title={t('edit')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                      <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                    </svg>
                  </button>
                )}
                {msg.role === "assistant" && msg.id === lastAssistantMsgId && !isThinking && !isStreaming && (
                  <button
                    onClick={() => handleRetry(msg.id)}
                    className="absolute top-1.5 -right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600"
                    aria-label={t('retry')}
                    title="Regenerate response"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.342a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.84a4.5 4.5 0 0 0 7.08-.68.75.75 0 0 1 1.274.724Z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {msg.warning && !dismissedWarnings.has(msg.id) && (
              <div className="flex justify-start mt-1">
                <div className="max-w-[80%] px-3 py-1.5 rounded-md bg-amber-900/30 border border-amber-700/40 text-amber-200/80 text-xs flex items-start gap-1.5">
                  <span className="shrink-0">⚠️</span>
                  <span className="flex-1">{msg.warning}</span>
                  <button
                    onClick={() => dismissWarning(msg.id)}
                    className="text-amber-400/60 hover:text-amber-200 font-bold leading-none ml-1"
                    aria-label="Dismiss warning"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            {msg.id === lastSuggestionMsgId && !isThinking && !isStreaming && msg.suggestions && (
              <div className="flex justify-start mt-2 animate-[fadeIn_0.3s_ease-in]">
                <div className="flex flex-wrap gap-2">
                  {msg.suggestions.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSend(chip)}
                      className="px-3 py-1.5 rounded-full text-xs text-zinc-300 bg-zinc-800/60 border border-zinc-600 border-l-indigo-500 border-l-2 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white active:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <span className="mr-1 opacity-60">{"\u2192"}</span>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {(isThinking || isRepairing) && !retryingMsgId && (
          <div className="flex justify-start">
            <div className="bg-zinc-700 px-3 py-2 rounded-lg">
              {isRepairing ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                  <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {t('repairing')}
                </span>
              ) : (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-lg bg-red-900/60 border border-red-700 text-red-200 text-sm flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button
            onClick={dismissError}
            className="text-red-400 hover:text-red-200 font-bold leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Input area */}
      <div ref={inputAreaRef} className={`shrink-0 border-t p-3 bg-zinc-900 relative transition-colors ${isDragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800'}`} onPaste={handlePaste} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-500/10 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none">
            <span className="text-indigo-300 text-sm font-medium">{t('dropFileHere')}</span>
          </div>
        )}
        {/* Command autocomplete dropdown */}
        <CommandAutocomplete
          query={autocompleteQuery}
          visible={showAutocomplete}
          onSelect={handleAutocompleteSelect}
          onDismiss={handleAutocompleteDismiss}
        />
        {/* Image preview */}
        {pendingImage && (
          <div className="mb-2 inline-flex relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not supported by next/Image */}
            <img
              src={pendingImage}
              alt="Attachment preview"
              className="max-h-[120px] rounded border border-zinc-600 object-contain"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-700 border border-zinc-500 text-zinc-300 hover:bg-red-600 hover:border-red-500 hover:text-white flex items-center justify-center text-xs font-bold leading-none transition-colors"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.json,.svg,.lottie"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const ext = file.name.toLowerCase().replace(/^.*\./, '.');
                if (ANIMATION_EXTENSIONS.includes(ext)) {
                  processAnimationFile(file);
                } else {
                  processImageFile(file);
                }
              }
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isThinking || isStreaming}
            className="shrink-0 px-2 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('attachImage')}
            title={t('attachTooltip')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentAnimationId ? t('placeholderWithAnimation') : t('placeholder')}
            disabled={isThinking || isStreaming}
            enterKeyHint="send"
            className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 resize-none overflow-y-auto"
          />
          {!(isThinking || isStreaming) && (
            <VoiceInput
              onTranscript={(text) => setInput(text)}
              onFinalTranscript={(text) => setInput(text)}
              disabled={isThinking || isStreaming}
            />
          )}
          {isThinking || isStreaming ? (
            <button
              onClick={handleStop}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center justify-center"
              aria-label={t('stop')}
              title={t('stop')}
            >
              <span className="inline-block w-3 h-3 bg-white rounded-sm" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('send')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
