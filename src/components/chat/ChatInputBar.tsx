"use client";

import CommandAutocomplete from "@/components/CommandAutocomplete";
import VoiceInput from "@/components/VoiceInput";
import type { CommandDef } from "@/components/CommandAutocomplete";

interface ChatInputBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onSend: () => void;
  onStop: () => void;
  isThinking: boolean;
  isStreaming: boolean;
  pendingImage: string | null;
  onRemoveImage: () => void;
  isDragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  showAutocomplete: boolean;
  autocompleteQuery: string;
  onAutocompleteSelect: (cmd: CommandDef) => void;
  onAutocompleteDismiss: () => void;
  onFileClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentAnimationId: string | undefined;
  selectedLayerIndex: number | null | undefined;
  animationDataProp: object | null | undefined;
  onLayerContextConsumed?: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  inputAreaRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  t: (key: string, values?: Record<string, string>) => string;
}

export default function ChatInputBar({
  input, onInputChange, onKeyDown, onPaste, onSend, onStop,
  isThinking, isStreaming, pendingImage, onRemoveImage,
  isDragOver, onDrop, onDragOver, onDragLeave,
  showAutocomplete, autocompleteQuery, onAutocompleteSelect, onAutocompleteDismiss,
  onFileClick, onFileChange,
  currentAnimationId, selectedLayerIndex, animationDataProp, onLayerContextConsumed,
  inputRef, inputAreaRef, fileInputRef, t,
}: ChatInputBarProps) {
  return (
    <div ref={inputAreaRef} className={`shrink-0 border-t p-3 bg-zinc-900 relative transition-colors ${isDragOver ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800"}`} style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }} onPaste={onPaste} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-500/10 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none">
          <span className="text-indigo-300 text-sm font-medium">{t("dropFileHere")}</span>
        </div>
      )}
      <CommandAutocomplete
        query={autocompleteQuery}
        visible={showAutocomplete}
        onSelect={onAutocompleteSelect}
        onDismiss={onAutocompleteDismiss}
      />
      {selectedLayerIndex != null && animationDataProp && (() => {
        const layers = (animationDataProp as Record<string, unknown>).layers as Array<Record<string, unknown>> | undefined;
        const layer = layers?.[selectedLayerIndex];
        const layerName = layer?.nm as string || `Layer ${selectedLayerIndex}`;
        return (
          <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-xs text-indigo-300">
            <span>Editing: {layerName}</span>
            <button
              onClick={() => onLayerContextConsumed?.()}
              className="text-indigo-400 hover:text-indigo-200 font-bold leading-none"
              aria-label="Dismiss layer selection"
            >
              ×
            </button>
          </div>
        );
      })()}
      {pendingImage && (
        <div className="mb-2 inline-flex relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingImage}
            alt="Attachment preview"
            className="max-h-[120px] rounded border border-zinc-600 object-contain"
          />
          <button
            onClick={onRemoveImage}
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
          onChange={onFileChange}
        />
        <button
          onClick={onFileClick}
          disabled={isThinking || isStreaming}
          className="shrink-0 px-2 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t("attachImage")}
          title={t("attachTooltip")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
          </svg>
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={currentAnimationId ? t("placeholderWithAnimation") : t("placeholder")}
          disabled={isThinking || isStreaming}
          enterKeyHint="send"
          className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50 resize-none overflow-y-auto"
        />
        {!(isThinking || isStreaming) && (
          <VoiceInput
            onTranscript={(text) => onInputChange(text)}
            onFinalTranscript={(text) => onInputChange(text)}
            disabled={isThinking || isStreaming}
          />
        )}
        {isThinking || isStreaming ? (
          <button
            onClick={onStop}
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center justify-center"
            aria-label={t("stop")}
            title={t("stop")}
          >
            <span className="inline-block w-3 h-3 bg-white rounded-sm" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!input.trim()}
            aria-label="Send message"
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("send")}
          </button>
        )}
      </div>
    </div>
  );
}
