"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, onFinalTranscript, disabled }: VoiceInputProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const lang = locale === "zh" ? "zh-CN" : "en-US";

  const {
    supported,
    isListening,
    transcript,
    finalTranscript,
    start,
    stop,
  } = useSpeechRecognition({ lang, continuous: false, interimResults: true });

  // Track previous transcript/finalTranscript to avoid redundant calls
  const prevTranscriptRef = useRef("");
  const prevFinalRef = useRef("");

  useEffect(() => {
    if (finalTranscript && finalTranscript !== prevFinalRef.current) {
      prevFinalRef.current = finalTranscript;
      onFinalTranscript(finalTranscript);
    } else if (transcript && transcript !== prevTranscriptRef.current && !finalTranscript) {
      prevTranscriptRef.current = transcript;
      onTranscript(transcript);
    }
  }, [transcript, finalTranscript, onTranscript, onFinalTranscript]);

  const handleClick = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      prevTranscriptRef.current = "";
      prevFinalRef.current = "";
      start();
    }
  }, [isListening, start, stop]);

  // Graceful degradation: render nothing if not supported
  if (!supported) return null;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-2 rounded-lg border transition-colors ${
        isListening
          ? "bg-red-600/20 text-red-400 border-red-500 animate-pulse"
          : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:bg-zinc-700"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={isListening ? t("voiceListening") : t("voiceInput")}
      title={isListening ? t("voiceListening") : t("voiceInput")}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-5 h-5"
      >
        <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
        <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
      </svg>
    </button>
  );
}
