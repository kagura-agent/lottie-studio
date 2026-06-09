"use client";

import { useState, useEffect, useRef } from "react";
import type { LoopConfig, LoopMode } from "@/types/loopConfig";

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  loopConfig: LoopConfig;
  onLoopConfigChange: (config: LoopConfig) => void;
  currentFrame: number;
  totalFrames: number;
  onSeek: (frame: number) => void;
  frameRate?: number;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

const LOOP_OPTIONS: { mode: LoopMode; label: string; icon: string }[] = [
  { mode: "loop", label: "Loop", icon: "∞" },
  { mode: "once", label: "Once", icon: "1" },
  { mode: "bounce", label: "Bounce", icon: "↔" },
  { mode: "count", label: "Count", icon: "#" },
];

function getLoopIcon(config: LoopConfig): string {
  if (config.mode === "count") return String(config.count ?? 3);
  return LOOP_OPTIONS.find((o) => o.mode === config.mode)?.icon ?? "∞";
}

export default function Controls({
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  loopConfig,
  onLoopConfigChange,
  currentFrame,
  totalFrames,
  onSeek,
  frameRate = 30,
}: ControlsProps) {
  const speeds = [0.5, 1, 2];
  const currentTime = currentFrame / frameRate;
  const totalDuration = totalFrames / frameRate;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  const selectMode = (mode: LoopMode) => {
    if (mode === "count") {
      onLoopConfigChange({ mode: "count", count: loopConfig.count ?? 3 });
    } else {
      onLoopConfigChange({ mode });
    }
    if (mode !== "count") setPopoverOpen(false);
  };

  return (
    <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 bg-zinc-900 flex-1">
      <button
        onClick={onTogglePlay}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="flex gap-1">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 px-2 py-1 rounded text-xs transition-colors flex items-center justify-center ${
              speed === s
                ? "bg-zinc-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setPopoverOpen((v) => !v)}
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-3 py-1.5 rounded text-sm transition-colors flex items-center justify-center ${
            loopConfig.mode !== "once"
              ? "bg-zinc-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {getLoopIcon(loopConfig)}
        </button>

        {popoverOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
            {LOOP_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => selectMode(opt.mode)}
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                  loopConfig.mode === opt.mode
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <span className="w-5 text-center font-mono">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
            {loopConfig.mode === "count" && (
              <div className="px-4 py-2 border-t border-zinc-700 flex items-center gap-2">
                <label className="text-xs text-zinc-400">Count:</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={loopConfig.count ?? 3}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                    onLoopConfigChange({ mode: "count", count: val });
                  }}
                  className="w-14 px-2 py-1 rounded bg-zinc-900 border border-zinc-600 text-zinc-200 text-sm text-center focus:outline-none focus:border-zinc-400"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(totalFrames - 1, 0)}
        value={currentFrame}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 accent-zinc-400 h-2 touch-pan-x"
      />

      <span
        className="text-xs text-zinc-400 font-mono whitespace-nowrap"
        title={`${currentFrame} / ${totalFrames} frames`}
      >
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
    </div>
  );
}
