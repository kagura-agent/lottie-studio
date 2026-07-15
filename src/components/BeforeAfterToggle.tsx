"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import LottiePreview from "./LottiePreview";
import type { CanvasBackground } from "./BackgroundPicker";
import type { LoopConfig } from "@/types/loopConfig";
import type { CompareMode } from "@/hooks/useBeforeAfter";

interface BeforeAfterToggleProps {
  beforeJson: object;
  afterJson: object;
  mode: CompareMode;
  onModeChange: (mode: CompareMode) => void;
  onClose: () => void;
  isPlaying: boolean;
  speed: number;
  loopConfig: LoopConfig;
  seekToFrame?: number;
  background?: CanvasBackground;
}

export default function BeforeAfterToggle({
  beforeJson,
  afterJson,
  mode,
  onModeChange,
  onClose,
  isPlaying,
  speed,
  loopConfig,
  seekToFrame,
  background = "checkered",
}: BeforeAfterToggleProps) {
  const t = useTranslations("beforeAfter");
  const [showingBefore, setShowingBefore] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleSliderMove = useCallback((clientX: number) => {
    const container = sliderContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSliderMove(e.clientX);
  }, [handleSliderMove]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    handleSliderMove(e.clientX);
  }, [handleSliderMove]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const modes: CompareMode[] = ["toggle", "split", "slider"];

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-lg bg-zinc-800/90 backdrop-blur-sm px-2 py-1 shadow-lg border border-zinc-700/50">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === m
                ? "bg-zinc-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t(m)}
          </button>
        ))}
        <div className="w-px h-4 bg-zinc-600 mx-1" />
        <button
          onClick={onClose}
          className="px-2 py-1 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label={t("close")}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      {mode === "toggle" && (
        <div className="flex-1 relative">
          <LottiePreview
            animationData={showingBefore ? beforeJson : afterJson}
            isPlaying={isPlaying}
            speed={speed}
            loopConfig={loopConfig}
            seekToFrame={seekToFrame}
            background={background}
          />
          <button
            onClick={() => setShowingBefore((v) => !v)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/90 backdrop-blur-sm text-sm font-medium shadow-lg border border-zinc-700/50 text-zinc-200 hover:bg-zinc-700/90 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${showingBefore ? "bg-amber-400" : "bg-emerald-400"}`} />
            {showingBefore ? t("before") : t("after")}
          </button>
        </div>
      )}

      {mode === "split" && (
        <div className="flex-1 flex gap-px bg-zinc-700">
          <div className="flex-1 relative">
            <LottiePreview
              animationData={beforeJson}
              isPlaying={isPlaying}
              speed={speed}
              loopConfig={loopConfig}
              seekToFrame={seekToFrame}
              background={background}
            />
            <span className="absolute bottom-2 left-2 z-30 px-2 py-0.5 rounded bg-zinc-800/80 text-xs text-amber-400 font-medium backdrop-blur-sm">
              {t("before")}
            </span>
          </div>
          <div className="flex-1 relative">
            <LottiePreview
              animationData={afterJson}
              isPlaying={isPlaying}
              speed={speed}
              loopConfig={loopConfig}
              seekToFrame={seekToFrame}
              background={background}
            />
            <span className="absolute bottom-2 right-2 z-30 px-2 py-0.5 rounded bg-zinc-800/80 text-xs text-emerald-400 font-medium backdrop-blur-sm">
              {t("after")}
            </span>
          </div>
        </div>
      )}

      {mode === "slider" && (
        <div
          ref={sliderContainerRef}
          className="flex-1 relative overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* After (full width, behind) */}
          <div className="absolute inset-0">
            <LottiePreview
              animationData={afterJson}
              isPlaying={isPlaying}
              speed={speed}
              loopConfig={loopConfig}
              seekToFrame={seekToFrame}
              background={background}
            />
          </div>
          {/* Before (clipped) */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <LottiePreview
              animationData={beforeJson}
              isPlaying={isPlaying}
              speed={speed}
              loopConfig={loopConfig}
              seekToFrame={seekToFrame}
              background={background}
            />
          </div>
          {/* Divider line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-30 pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3l-5 9 5 9M16 3l5 9-5 9" />
              </svg>
            </div>
          </div>
          {/* Labels */}
          <span className="absolute bottom-2 left-2 z-30 px-2 py-0.5 rounded bg-zinc-800/80 text-xs text-amber-400 font-medium backdrop-blur-sm">
            {t("before")}
          </span>
          <span className="absolute bottom-2 right-2 z-30 px-2 py-0.5 rounded bg-zinc-800/80 text-xs text-emerald-400 font-medium backdrop-blur-sm">
            {t("after")}
          </span>
        </div>
      )}
    </div>
  );
}
