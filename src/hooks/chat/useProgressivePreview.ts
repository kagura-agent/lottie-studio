"use client";

import { useState, useRef, useCallback } from "react";
import type { PartialLottie } from "@/lib/partial-lottie";

const DEBOUNCE_MS = 500;

export function useProgressivePreview() {
  const [previewData, setPreviewData] = useState<PartialLottie | null>(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const lastUpdateRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePreview = useCallback((data: PartialLottie | null) => {
    if (!data) return;

    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    if (elapsed >= DEBOUNCE_MS) {
      lastUpdateRef.current = now;
      setPreviewData(data);
      setIsPreviewActive(true);
    } else {
      pendingTimerRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setPreviewData(data);
        setIsPreviewActive(true);
        pendingTimerRef.current = null;
      }, DEBOUNCE_MS - elapsed);
    }
  }, []);

  const clearPreview = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    setPreviewData(null);
    setIsPreviewActive(false);
    lastUpdateRef.current = 0;
  }, []);

  return { previewData, isPreviewActive, updatePreview, clearPreview };
}
