"use client";

import { useState } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";
import InlineLottiePreview from "@/components/InlineLottiePreview";
import VariationGrid from "@/components/VariationGrid";
import SequencePlayer from "@/components/SequencePlayer";
import FeedbackButtons from "@/components/FeedbackButtons";
import VersionBadge from "@/components/chat/VersionBadge";
import type { Message, Variation, QualityHint } from "@/lib/chat-types";

interface ChatMessageProps {
  msg: Message;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  isLastAssistant: boolean;
  isThinking: boolean;
  isStreaming: boolean;
  onVariationSelect: (variation: Variation) => void;
  currentAnimationId: string | undefined;
  warningDismissed: boolean;
  onDismissWarning: () => void;
  qualityHintsDismissed: boolean;
  onDismissQualityHints: () => void;
  isLastSuggestion: boolean;
  onSuggestionClick: (chip: string) => void;
  onVersionRestore?: (versionNum: number) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

export default function ChatMessage({
  msg, isEditing, editText, onEditTextChange, onEditStart, onEditCancel, onEditSave,
  onRetry, isRetrying, isLastAssistant, isThinking, isStreaming,
  onVariationSelect, currentAnimationId, warningDismissed, onDismissWarning,
  qualityHintsDismissed, onDismissQualityHints,
  isLastSuggestion, onSuggestionClick, onVersionRestore, t,
}: ChatMessageProps) {
  const [hintsExpanded, setHintsExpanded] = useState(false);
  return (
    <div>
      <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={`group relative max-w-[80%] ${msg.role === "assistant" ? "pr-7" : "pl-7"}`}>
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-[200px]">
              <textarea
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value)}
                className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-indigo-500 focus:outline-none resize-none overflow-y-auto"
                rows={3}
                autoFocus
              />
              <p className="text-xs text-amber-400/80">{t("editWarning")}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onEditCancel}
                  className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={onEditSave}
                  disabled={!editText.trim()}
                  className="px-2.5 py-1 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("saveAndRegenerate")}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                msg.role === "user" ? "bg-indigo-600 text-white" : "bg-zinc-700 text-zinc-100"
              }`}
            >
              {msg.role === "assistant" && msg.lottieJson && (
                <InlineLottiePreview lottieJson={msg.lottieJson} previousLottieJson={msg.previousLottieJson} />
              )}
              {msg.role === "assistant" && msg.lottieJson && msg.versionNum && (
                <VersionBadge
                  versionNum={msg.versionNum}
                  animationId={currentAnimationId || ""}
                  onRestore={onVersionRestore}
                />
              )}
              {msg.role === "assistant" && (msg.variations?.length || msg.variationsLoading) && (
                <div className="mt-2">
                  <VariationGrid
                    variations={msg.variations || []}
                    loading={msg.variationsLoading}
                    onSelect={onVariationSelect}
                  />
                </div>
              )}
              {msg.role === "assistant" && msg.sequenceId && (
                <div className="mt-2">
                  <SequencePlayer sequenceId={msg.sequenceId} />
                </div>
              )}
              {isRetrying && !msg.content ? (
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
                    // eslint-disable-next-line @next/next/no-img-element
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
          {msg.role === "user" && !isThinking && !isStreaming && !isEditing && (
            <button
              onClick={onEditStart}
              className="absolute top-1.5 -left-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600"
              aria-label={t("edit")}
              title={t("edit")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
              </svg>
            </button>
          )}
          {msg.role === "assistant" && isLastAssistant && !isThinking && !isStreaming && (
            <button
              onClick={onRetry}
              className="absolute top-1.5 -right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-600"
              aria-label={t("retry")}
              title="Regenerate response"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.342a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.84a4.5 4.5 0 0 0 7.08-.68.75.75 0 0 1 1.274.724Z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {msg.role === "assistant" && msg.lottieJson && !isThinking && !isStreaming && (
        <div className="flex justify-start mt-1 ml-0">
          <FeedbackButtons
            messageId={msg.id}
            animationId={currentAnimationId || ""}
          />
        </div>
      )}
      {msg.warning && !warningDismissed && (
        <div className="flex justify-start mt-1">
          <div className="max-w-[80%] px-3 py-1.5 rounded-md bg-amber-900/30 border border-amber-700/40 text-amber-200/80 text-xs flex items-start gap-1.5">
            <span className="shrink-0">⚠️</span>
            <span className="flex-1">{msg.warning}</span>
            <button
              onClick={onDismissWarning}
              className="text-amber-400/60 hover:text-amber-200 font-bold leading-none ml-1"
              aria-label="Dismiss warning"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {msg.qualityHints && msg.qualityHints.length > 0 && !qualityHintsDismissed && (
        <div className="flex justify-start mt-1.5">
          <div className="max-w-[80%] rounded-md bg-zinc-800/60 border border-zinc-700/50 text-xs overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <button
                onClick={() => setHintsExpanded(!hintsExpanded)}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={`w-3 h-3 transition-transform ${hintsExpanded ? "rotate-90" : ""}`}
                >
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
                <span>Quality Tips</span>
                <span className="text-zinc-500">({msg.qualityHints.length})</span>
              </button>
              <button
                onClick={onDismissQualityHints}
                className="text-zinc-500 hover:text-zinc-300 font-bold leading-none px-1"
                aria-label="Dismiss quality tips"
              >
                ×
              </button>
            </div>
            {hintsExpanded && (
              <div className="px-2.5 pb-2 space-y-1.5">
                {msg.qualityHints.map((hint) => (
                  <div key={hint.id} className="flex gap-2 text-zinc-400">
                    <span className={`shrink-0 ${hint.status === "fail" ? "text-red-400" : "text-amber-400"}`}>
                      {hint.status === "fail" ? "●" : "○"}
                    </span>
                    <div>
                      <span className="text-zinc-300">{hint.label}:</span>{" "}
                      <span>{hint.detail}</span>
                      <p className="text-zinc-500 mt-0.5">{hint.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {isLastSuggestion && !isThinking && !isStreaming && msg.suggestions && (
        <div className="flex justify-start mt-2 animate-[fadeIn_0.3s_ease-in] -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 overflow-x-auto md:flex-wrap scrollbar-hide pb-1">
            {msg.suggestions.map((chip) => (
              <button
                key={chip}
                onClick={() => onSuggestionClick(chip)}
                className="px-3 py-1.5 rounded-full text-xs text-zinc-300 bg-zinc-800/60 border border-zinc-600 border-l-indigo-500 border-l-2 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white active:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="mr-1 opacity-60">{"→"}</span>
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
