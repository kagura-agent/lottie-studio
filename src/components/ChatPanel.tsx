"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
  isRepair?: boolean;
  suggestions?: string[];
}

interface ChatPanelProps {
  animationId?: string;
  insertText?: string;
}

export default function ChatPanel({ animationId, insertText }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [retryingMsgId, setRetryingMsgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAnimationId, setCurrentAnimationId] = useState<string | undefined>(animationId);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep currentAnimationId in sync when prop changes
  useEffect(() => {
    setCurrentAnimationId(animationId);
  }, [animationId]);

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
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
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

  // Append text from layer panel selection
  useEffect(() => {
    if (!insertText) return;
    setInput((prev) => prev + insertText);
    inputRef.current?.focus();
  }, [insertText]);

  // Shared streaming fetch logic. `existingAssistantMsgId` is set during retry
  // to update an existing message in-place instead of appending a new one.
  const streamResponse = useCallback(async (text: string, existingAssistantMsgId?: string, signal?: AbortSignal) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animationId: currentAnimationId,
        message: text,
      }),
      signal,
    });

    // Fallback: if not SSE (e.g. error JSON response), handle like old path
    const contentType = res.headers.get("Content-Type") || "";
    if (!contentType.includes("text/event-stream")) {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Request failed (${res.status})`;
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (!currentAnimationId && data.animationId) {
        setCurrentAnimationId(data.animationId);
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
    let fullContent = "";
    let visibleContent = "";
    let insideJsonBlock = false;
    let fenceBuffer = "";
    let repairContent = "";
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
        let parsed: { type: string; text?: string; reply?: string; lottieJson?: unknown; animationId?: string; error?: string; warning?: string; suggestions?: string[] };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (parsed.type === "token") {
          const tokenText = parsed.text || "";
          fullContent += tokenText;

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
          repairContent += tokenText;

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
          if (!currentAnimationId && parsed.animationId) {
            setCurrentAnimationId(parsed.animationId);
          }
          if (assistantMsgId && parsed.reply) {
            const msgId = assistantMsgId;
            const warningText = parsed.warning as string | undefined;
            const suggestionsList = parsed.suggestions;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: parsed.reply!, warning: warningText, isRepair: undefined, suggestions: suggestionsList } : m
              )
            );
          }
        } else if (parsed.type === "error") {
          setError(parsed.error || "An unexpected error occurred");
        }
      }
    }
  }, [currentAnimationId]);

  const handleSend = useCallback(async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || isThinking || isStreaming) return;

    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
  }, [input, isThinking, isStreaming, streamResponse]);

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
      await streamResponse(userText, assistantMsgId, controller.signal);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const starterChips = useMemo(() => {
    const allPrompts = [
      "\uD83C\uDF88 A bouncing red ball with a shadow",
      "\uD83C\uDF38 Sakura petals falling and spinning",
      "\u2B50 A pulsing loading spinner",
      "\uD83C\uDFA8 A colorful rotating pinwheel",
      "\uD83D\uDCAB Stars twinkling in the night sky",
      "\uD83D\uDD04 A smooth progress circle animation",
      "\uD83D\uDE80 A rocket launching with flame particles",
      "\uD83C\uDF0A An ocean wave rolling across the screen",
      "\u2764\uFE0F A heartbeat pulse animation",
      "\uD83C\uDF19 A day-to-night sky transition",
    ];
    const shuffled = [...allPrompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, []);

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
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <h2 className="text-zinc-300 text-base font-medium">
              What would you like to create?
            </h2>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {starterChips.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isThinking || isStreaming}
                  className="px-3 py-1.5 rounded-full text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white active:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`group relative max-w-[80%] ${msg.role === "assistant" ? "pr-7" : ""}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-700 text-zinc-100"
                  }`}
                >
                  {retryingMsgId === msg.id && !msg.content ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : msg.isRepair ? (
                    <span className="text-amber-300">{msg.content}</span>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && !isThinking && !isStreaming && (
                  <button
                    onClick={() => handleRetry(msg.id)}
                    className="absolute top-1.5 -right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600"
                    aria-label="Retry this response"
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
                  Auto-repairing...
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
      <div ref={inputAreaRef} className="shrink-0 border-t border-zinc-800 p-3 bg-zinc-900">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your animation..."
            disabled={isThinking || isStreaming}
            enterKeyHint="send"
            className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50"
          />
          {isThinking || isStreaming ? (
            <button
              onClick={handleStop}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center justify-center"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <span className="inline-block w-3 h-3 bg-white rounded-sm" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
