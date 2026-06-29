"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechRecognitionStatus = "idle" | "listening" | "error";

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseSpeechRecognitionReturn {
  /** Whether the browser supports Web Speech API */
  supported: boolean;
  /** Current recognition status */
  status: SpeechRecognitionStatus;
  /** Whether currently listening */
  isListening: boolean;
  /** Interim transcript (updates as user speaks) */
  transcript: string;
  /** Final transcript from the last recognition result */
  finalTranscript: string;
  /** Start speech recognition */
  start: () => void;
  /** Stop speech recognition */
  stop: () => void;
}

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang, continuous = false, interimResults = true } = options;

  const [supported] = useState(() => getSpeechRecognitionClass() !== null);
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const start = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang || document.documentElement.lang || navigator.language || "en-US";

    recognition.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setFinalTranscript("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setFinalTranscript(final);
        setTranscript(final);
      } else {
        setTranscript(interim);
      }
    };

    recognition.onerror = () => {
      setStatus("error");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setStatus("idle");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, continuous, interimResults]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    supported,
    status,
    isListening: status === "listening",
    transcript,
    finalTranscript,
    start,
    stop,
  };
}
