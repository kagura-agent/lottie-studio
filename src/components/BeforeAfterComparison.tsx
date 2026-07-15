"use client";

import { useState, useCallback, useRef } from "react";
import LottiePreview from "./LottiePreview";
import type { ComparisonMode } from "@/hooks/useBeforeAfter";
import type { CanvasBackground } from "./BackgroundPicker";
import type { LoopConfig } from "@/types/loopConfig";

interface BeforeAfterComparisonProps {
  beforeData: object;
  afterData: object;
  comparisonMode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
  onAccept: () => void;
  onRevert: () => void;
  isPlaying: boolean;
  speed: number;
  loopConfig: LoopConfig;
  seekToFrame?: number;
  background?: CanvasBackground;
}

export default function BeforeAfterComparison({
  beforeData,
  afterData,
  comparisonMode,
  onModeChange,
  onAccept,
  onRevert,
  isPlaying,
  speed,
  loopConfig,
  seekToFrame,
  background = "checkered",
}: BeforeAfterComparisonProps) {
  const [showingAfter, setShowingAfter] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleSliderMove = useCallback((e: React.PointerEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, []);

  const [dragging, setDragging] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSliderMove(e);
  }, [handleSliderMove]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    handleSliderMove(e);
  }, [dragging, handleSliderMove]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-lg overflow-hidden bg-zinc-900">
      {/* Mode switcher + actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onModeChange("toggle")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              comparisonMode === "toggle" ? "bg-zinc-600 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle mode"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
          </button>
          <button
            onClick={() => onModeChange("split")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              comparisonMode === "split" ? "bg-zinc-600 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Split mode"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
          <button
            onClick={() => onModeChange("slider")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              comparisonMode === "slider" ? "bg-zinc-600 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Slider mode"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="6 12 9 9 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRevert}
            className="px-3 py-1 rounded text-xs font-medium bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
          >
            Revert
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1 rounded text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>

      {/* Comparison view */}
      <div className="flex-1 min-h-0 relative">
        {comparisonMode === "toggle" && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <LottiePreview
                animationData={showingAfter ? afterData : beforeData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                seekToFrame={seekToFrame}
                background={background}
                ariaLabel={showingAfter ? "After modification" : "Before modification"}
              />
            </div>
            <div className="flex items-center justify-center gap-2 py-2 bg-zinc-800/80">
              <button
                onClick={() => setShowingAfter(false)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  !showingAfter ? "bg-zinc-600 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Before
              </button>
              <button
                onClick={() => setShowingAfter(true)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  showingAfter ? "bg-zinc-600 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                After
              </button>
            </div>
          </div>
        )}

        {comparisonMode === "split" && (
          <div className="absolute inset-0 flex">
            <div className="flex-1 min-w-0 border-r border-zinc-700 relative">
              <LottiePreview
                animationData={beforeData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                seekToFrame={seekToFrame}
                background={background}
                ariaLabel="Before modification"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-xs">Before</span>
            </div>
            <div className="flex-1 min-w-0 relative">
              <LottiePreview
                animationData={afterData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                seekToFrame={seekToFrame}
                background={background}
                ariaLabel="After modification"
              />
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-xs">After</span>
            </div>
          </div>
        )}

        {comparisonMode === "slider" && (
          <div
            ref={sliderRef}
            className="absolute inset-0"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="absolute inset-0">
              <LottiePreview
                animationData={beforeData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                seekToFrame={seekToFrame}
                background={background}
                ariaLabel="Before modification"
              />
            </div>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <LottiePreview
                animationData={afterData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                seekToFrame={seekToFrame}
                background={background}
                ariaLabel="After modification"
              />
            </div>
            {/* Slider handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="8 4 4 12 8 20" />
                  <polyline points="16 4 20 12 16 20" />
                </svg>
              </div>
            </div>
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-xs pointer-events-none">Before</span>
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-xs pointer-events-none">After</span>
          </div>
        )}
      </div>
    </div>
  );
}
