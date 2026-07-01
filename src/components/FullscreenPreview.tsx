"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from 'next-intl';
import LottiePreview from "./LottiePreview";
import type { LoopConfig } from "@/types/loopConfig";

interface FullscreenPreviewProps {
  animationData: object | null;
  isPlaying: boolean;
  speed: number;
  currentFrame: number;
  totalFrames: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (frame: number) => void;
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 2];
const HIDE_DELAY = 3000;

export default function FullscreenPreview({
  animationData,
  isPlaying,
  speed,
  currentFrame,
  totalFrames,
  onTogglePlay,
  onSpeedChange,
  onSeek,
  onClose,
}: FullscreenPreviewProps) {
  const t = useTranslations('controls');
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loopConfig] = useState<LoopConfig>({ mode: "loop" });

  // Request fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.requestFullscreen?.().catch(() => {
      // Fullscreen not supported or denied — close immediately
      onClose();
    });
  }, [onClose]);

  // Listen for fullscreenchange to detect Escape key exits
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onClose();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onClose]);

  // Auto-hide controls after inactivity
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    // Start auto-hide timer on mount
    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_DELAY);
    return () => {
      clearTimeout(timer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      onClose();
    }
  }, [onClose]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSeek(Number(e.target.value));
    },
    [onSeek]
  );

  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen animation preview"
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onTouchStart={resetHideTimer}
    >
      {/* Lottie animation centered */}
      <div className="w-full h-full max-w-[80vw] max-h-[80vh] flex items-center justify-center">
        <LottiePreview
          animationData={animationData}
          isPlaying={isPlaying}
          speed={speed}
          loopConfig={loopConfig}
          onFrameChange={() => {}}
          background="black"
        />
      </div>

      {/* Floating controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-4 mb-6 md:mx-8 md:mb-8 rounded-xl bg-zinc-900/70 backdrop-blur-xl border border-zinc-700/50 px-4 py-3 md:px-6 md:py-4 shadow-2xl">
          {/* Progress bar */}
          <div className="relative w-full h-1.5 bg-zinc-700 rounded-full mb-3 group cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-zinc-300 rounded-full transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(0, totalFrames - 1)}
              value={currentFrame}
              onChange={handleScrub}
              aria-label="Animation timeline scrubber"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-100 transition-colors"
              title={isPlaying ? t('pause') : t('play')}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              )}
            </button>

            {/* Frame counter */}
            <span className="text-zinc-400 text-xs font-mono hidden md:block">
              {currentFrame} / {totalFrames > 0 ? totalFrames - 1 : 0}
            </span>

            <div className="flex-1" />

            {/* Speed controls */}
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    speed === s
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                  }`}
                  aria-label={`Set playback speed to ${s}x`}
                  aria-pressed={speed === s}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Exit button */}
            <button
              onClick={handleExitFullscreen}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 hover:text-zinc-100 transition-colors"
              title={"Exit fullscreen"}
              aria-label="Exit fullscreen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Top-right close button (always visible briefly) */}
      <button
        onClick={handleExitFullscreen}
        className={`absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-all ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        title={"Exit fullscreen (Esc)"}
        aria-label="Exit fullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
