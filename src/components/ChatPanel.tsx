"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  animationId?: string;
}

export default function ChatPanel({ animationId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnimationId, setCurrentAnimationId] = useState<string | undefined>(animationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyLoadedRef = useRef<string | undefined>(undefined);

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

  const handleSend = useCallback(async () => {
    const text = input.trim();
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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animationId: currentAnimationId,
          message: text,
        }),
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
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsThinking(false);
        return;
      }

      // SSE streaming path
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let sseBuffer = "";
      let assistantMsgId: string | null = null;

      setIsThinking(false);
      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // Split on double newlines to get complete SSE events
        const parts = sseBuffer.split("\n\n");
        // Keep the last potentially incomplete part
        sseBuffer = parts.pop() || "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          let parsed: { type: string; text?: string; reply?: string; lottieJson?: unknown; animationId?: string; error?: string };
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (parsed.type === "token") {
            if (!assistantMsgId) {
              // Create the assistant message on first token
              assistantMsgId = crypto.randomUUID();
              const newMsg: Message = {
                id: assistantMsgId,
                role: "assistant",
                content: parsed.text || "",
              };
              setMessages((prev) => [...prev, newMsg]);
            } else {
              // Append to existing assistant message
              const msgId = assistantMsgId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: m.content + (parsed.text || "") } : m
                )
              );
            }
          } else if (parsed.type === "done") {
            if (!currentAnimationId && parsed.animationId) {
              setCurrentAnimationId(parsed.animationId);
            }
            // Replace streaming content with final reply for accuracy
            if (assistantMsgId && parsed.reply) {
              const msgId = assistantMsgId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: parsed.reply! } : m
                )
              );
            }
          } else if (parsed.type === "error") {
            setError(parsed.error || "An unexpected error occurred");
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errMsg);
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
    }
  }, [input, isThinking, isStreaming, currentAnimationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const dismissError = useCallback(() => setError(null), []);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Describe an animation to get started
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-700 text-zinc-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-zinc-700 px-3 py-2 rounded-lg">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
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
      <div className="shrink-0 border-t border-zinc-800 p-3 bg-zinc-900">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your animation..."
            disabled={isThinking || isStreaming}
            className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking || isStreaming}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
