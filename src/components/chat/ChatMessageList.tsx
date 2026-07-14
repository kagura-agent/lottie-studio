"use client";

import { useTranslations } from "next-intl";
import ChatMessage from "./ChatMessage";
import PromptSuggestions from "@/components/PromptSuggestions";
import type { Message, Variation } from "@/lib/chat-types";
import type { PromptSuggestion } from "@/data/prompt-suggestions";
import type React from "react";

interface ChatMessageListProps {
  messages: Message[];
  isThinking: boolean;
  isStreaming: boolean;
  isRepairing: boolean;
  retryingMsgId: string | null;
  editingMsgId: string | null;
  editText: string;
  onEditTextChange: (text: string) => void;
  onEditStart: (msgId: string, content: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onRetry: (msgId: string) => void;
  lastAssistantMsgId: string | null;
  lastSuggestionMsgId: string | null;
  onVariationSelect: (msgId: string, variation: Variation) => void;
  currentAnimationId: string | undefined;
  dismissedWarnings: Set<string>;
  onDismissWarning: (msgId: string) => void;
  onSuggestionClick: (chip: string) => void;
  onPromptSelect: (prompt: string) => void;
  hasDesignTokens: boolean;
  dynamicSuggestions: PromptSuggestion[] | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  t: (key: string, values?: Record<string, string>) => string;
}

export default function ChatMessageList({
  messages, isThinking, isStreaming, isRepairing, retryingMsgId,
  editingMsgId, editText, onEditTextChange, onEditStart, onEditCancel, onEditSave,
  onRetry, lastAssistantMsgId, lastSuggestionMsgId,
  onVariationSelect, currentAnimationId, dismissedWarnings, onDismissWarning,
  onSuggestionClick, onPromptSelect, hasDesignTokens, dynamicSuggestions,
  messagesEndRef, t,
}: ChatMessageListProps) {
  const tChat = useTranslations("chat");

  return (
    <div role="log" aria-live="polite" aria-label="Chat messages" className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <PromptSuggestions
            onSelect={onPromptSelect}
            hasDesignTokens={hasDesignTokens}
            dynamicSuggestions={dynamicSuggestions}
          />
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          msg={msg}
          isEditing={editingMsgId === msg.id}
          editText={editText}
          onEditTextChange={onEditTextChange}
          onEditStart={() => onEditStart(msg.id, msg.content)}
          onEditCancel={onEditCancel}
          onEditSave={onEditSave}
          onRetry={() => onRetry(msg.id)}
          isRetrying={retryingMsgId === msg.id}
          isLastAssistant={msg.id === lastAssistantMsgId}
          isThinking={isThinking}
          isStreaming={isStreaming}
          onVariationSelect={(v) => onVariationSelect(msg.id, v)}
          currentAnimationId={currentAnimationId}
          warningDismissed={dismissedWarnings.has(msg.id)}
          onDismissWarning={() => onDismissWarning(msg.id)}
          isLastSuggestion={msg.id === lastSuggestionMsgId}
          onSuggestionClick={onSuggestionClick}
          t={t}
        />
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
                {tChat("repairing")}
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
  );
}
