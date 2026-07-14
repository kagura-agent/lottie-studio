"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Message } from "@/lib/chat-types";
import { getPendingMessages, flushMessages } from "@/lib/messageQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { apiFetch } from "@/lib/apiFetch";
import type { PromptSuggestion } from "@/data/prompt-suggestions";

export function useChatMessages(
  animationId: string | undefined,
  animationDataProp: object | null | undefined,
  selectedLayerIndex: number | null | undefined,
  handleSendRef: React.RefObject<((prompt?: string) => Promise<void>) | undefined>,
) {
  const { isOnline } = useOnlineStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [dynamicSuggestions, setDynamicSuggestions] = useState<PromptSuggestion[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef<string | undefined>(undefined);
  const autoDescribeTriggeredRef = useRef<string | undefined>(undefined);
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevSuggestionsKey, setPrevSuggestionsKey] = useState<string | undefined>(undefined);

  const suggestionsKey = animationDataProp && messages.length > 0
    ? `${JSON.stringify(animationDataProp).length}:${selectedLayerIndex}`
    : undefined;
  if (suggestionsKey !== prevSuggestionsKey) {
    setPrevSuggestionsKey(suggestionsKey);
    if (!suggestionsKey) {
      setDynamicSuggestions(null);
    }
  }

  useEffect(() => {
    if (!animationDataProp || messages.length === 0) return;
    if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    suggestionsTimerRef.current = setTimeout(() => {
      const selectedLayer = selectedLayerIndex != null
        ? ((animationDataProp as Record<string, unknown>).layers as Array<Record<string, unknown>> | undefined)?.[selectedLayerIndex] ?? null
        : null;
      apiFetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animationJson: animationDataProp,
          selectedLayer,
          messageCount: messages.length,
        }),
      })
        .then((res) => res.json())
        .then((data: { suggestions?: PromptSuggestion[] }) => {
          if (data.suggestions?.length) setDynamicSuggestions(data.suggestions);
        })
        .catch(() => {});
    }, 800);
    return () => { if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationDataProp, selectedLayerIndex]);

  // Load conversation history
  useEffect(() => {
    if (!animationId) return;
    if (historyLoadedRef.current === animationId) return;
    historyLoadedRef.current = animationId;

    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/${animationId}`);
        if (!res.ok) return;
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
          autoDescribeTriggeredRef.current = animationId;
          handleSendRef.current?.("Describe this animation and suggest ways I can modify it");
        }
      } catch {
        // Silently ignore
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [animationId, handleSendRef]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Check pending offline messages count
  useEffect(() => {
    getPendingMessages().then((msgs) => setPendingCount(msgs.length)).catch(() => {});
  }, []);

  // Flush queued messages when coming back online
  useEffect(() => {
    if (!isOnline) return;
    flushMessages(async (msg) => {
      try {
        await handleSendRef.current?.(msg.content);
        return true;
      } catch {
        return false;
      }
    }).then(({ sent }) => {
      if (sent > 0) setPendingCount(0);
    }).catch(() => {});
  }, [isOnline, handleSendRef]);

  const dismissWarning = useCallback((msgId: string) => {
    setDismissedWarnings((prev) => new Set(prev).add(msgId));
  }, []);

  const handleClearChat = useCallback(async (currentAnimationId: string | undefined) => {
    if (!currentAnimationId || messages.length === 0) return;
    if (!window.confirm("Clear all chat messages? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/chat/${currentAnimationId}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to clear chat history");
      }
      setMessages([]);
    } catch {
      throw new Error("Failed to clear chat history");
    }
  }, [messages.length]);

  const lastAssistantMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const lastSuggestionMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].suggestions?.length) return messages[i].id;
    }
    return null;
  }, [messages]);

  return {
    messages,
    setMessages,
    pendingCount,
    setPendingCount,
    dismissedWarnings,
    dismissWarning,
    dynamicSuggestions,
    messagesEndRef,
    scrollToBottom,
    handleClearChat,
    lastAssistantMsgId,
    lastSuggestionMsgId,
    isOnline,
  };
}
