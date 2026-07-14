"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatMessages } from "@/hooks/chat/useChatMessages";
import { useChatSend } from "@/hooks/chat/useChatSend";
import { useChatInput } from "@/hooks/chat/useChatInput";
import ChatMessageList from "@/components/chat/ChatMessageList";
import ChatInputBar from "@/components/chat/ChatInputBar";
import type { ChatPanelProps } from "@/lib/chat-types";

export type { ChatPanelProps };

export default function ChatPanel({
  animationId,
  insertText,
  onAnimationCreated,
  onAnimationUpdated,
  onCommand,
  initialPrompt,
  selectedLayerIndex,
  animationData: animationDataProp,
  onLayerContextConsumed,
}: ChatPanelProps) {
  const [currentAnimationId, setCurrentAnimationId] = useState<string | undefined>(animationId);
  const [prevAnimationId, setPrevAnimationId] = useState<string | undefined>(animationId);

  if (animationId !== prevAnimationId) {
    setPrevAnimationId(animationId);
    setCurrentAnimationId(animationId);
  }

  const handleSendRef = useRef<((prompt?: string) => Promise<void>) | undefined>(undefined);

  const {
    messages, setMessages, pendingCount, setPendingCount,
    dismissedWarnings, dismissWarning, dynamicSuggestions,
    messagesEndRef, scrollToBottom, handleClearChat,
    lastAssistantMsgId, lastSuggestionMsgId, isOnline,
  } = useChatMessages(animationId, animationDataProp, selectedLayerIndex, handleSendRef);

  const {
    input, setInput,
    isThinking, isStreaming, isRepairing,
    retryingMsgId,
    editingMsgId, setEditingMsgId, editText, setEditText,
    error, setError,
    pendingImage, setPendingImage,
    handleSend, handleRetry, handleEditSave, handleStop,
    dismissError, handleVariationSelect,
    t, hasDesignTokens,
  } = useChatSend({
    messages, setMessages, setPendingCount,
    currentAnimationId, setCurrentAnimationId,
    onAnimationCreated, onAnimationUpdated, onCommand,
    animationDataProp, selectedLayerIndex, onLayerContextConsumed,
    isOnline,
  });

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, isStreaming, scrollToBottom]);

  // Set initial prompt once
  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isDragOver,
    showAutocomplete, autocompleteQuery,
    handleAutocompleteSelect, handleAutocompleteDismiss,
    handleKeyDown, handlePaste,
    handleDrop, handleDragOver, handleDragLeave,
    handleFileInputChange,
    inputRef, inputAreaRef, fileInputRef,
  } = useChatInput({
    input, setInput, pendingImage, setPendingImage,
    setError, setMessages, setCurrentAnimationId, onAnimationCreated,
    handleSend, insertText, t,
  });

  const onClearChat = useCallback(async () => {
    try {
      await handleClearChat(currentAnimationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear chat history");
    }
  }, [handleClearChat, currentAnimationId, setError]);

  const onEditStart = useCallback((msgId: string, content: string) => {
    setEditingMsgId(msgId);
    setEditText(content);
  }, [setEditingMsgId, setEditText]);

  const onEditCancel = useCallback(() => {
    setEditingMsgId(null);
    setEditText("");
  }, [setEditingMsgId, setEditText]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {messages.length > 0 && (
        <div className="shrink-0 flex items-center justify-end px-3 pt-2">
          <button
            onClick={onClearChat}
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

      <ChatMessageList
        messages={messages}
        isThinking={isThinking}
        isStreaming={isStreaming}
        isRepairing={isRepairing}
        retryingMsgId={retryingMsgId}
        editingMsgId={editingMsgId}
        editText={editText}
        onEditTextChange={setEditText}
        onEditStart={onEditStart}
        onEditCancel={onEditCancel}
        onEditSave={handleEditSave}
        onRetry={handleRetry}
        lastAssistantMsgId={lastAssistantMsgId}
        lastSuggestionMsgId={lastSuggestionMsgId}
        onVariationSelect={handleVariationSelect}
        currentAnimationId={currentAnimationId}
        dismissedWarnings={dismissedWarnings}
        onDismissWarning={dismissWarning}
        onSuggestionClick={handleSend}
        onPromptSelect={(prompt) => setInput(prompt)}
        hasDesignTokens={hasDesignTokens}
        dynamicSuggestions={dynamicSuggestions}
        messagesEndRef={messagesEndRef}
        t={t}
      />

      {pendingCount > 0 && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-1.5 rounded-lg bg-amber-900/40 border border-amber-700/40 text-amber-200 text-xs flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{pendingCount} message{pendingCount > 1 ? "s" : ""} queued — will send when online</span>
        </div>
      )}

      {error && (
        <div role="alert" className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-lg bg-red-900/60 border border-red-700 text-red-200 text-sm flex items-start gap-2">
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

      <ChatInputBar
        input={input}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSend={() => handleSend()}
        onStop={handleStop}
        isThinking={isThinking}
        isStreaming={isStreaming}
        pendingImage={pendingImage}
        onRemoveImage={() => setPendingImage(null)}
        isDragOver={isDragOver}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        showAutocomplete={showAutocomplete}
        autocompleteQuery={autocompleteQuery}
        onAutocompleteSelect={handleAutocompleteSelect}
        onAutocompleteDismiss={handleAutocompleteDismiss}
        onFileClick={() => fileInputRef.current?.click()}
        onFileChange={handleFileInputChange}
        currentAnimationId={currentAnimationId}
        selectedLayerIndex={selectedLayerIndex}
        animationDataProp={animationDataProp}
        onLayerContextConsumed={onLayerContextConsumed}
        inputRef={inputRef}
        inputAreaRef={inputAreaRef}
        fileInputRef={fileInputRef}
        t={t}
      />
    </div>
  );
}
