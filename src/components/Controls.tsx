"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from 'next-intl';
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

const LOOP_OPTIONS: { mode: LoopMode; icon: string }[] = [
  { mode: "loop", icon: "∞" },
  { mode: "once", icon: "1" },
  { mode: "bounce", icon: "↔" },
  { mode: "count", icon: "#" },
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
  const t = useTranslations('controls');
  const speeds = [0.5, 1, 2];
  const currentTime = currentFrame / frameRate;
  const totalDuration = totalFrames / frameRate;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!shortcutsOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShortcutsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shortcutsOpen]);

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
        aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="flex gap-1">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            aria-label={`Set playback speed to ${s}x`}
            aria-pressed={speed === s}
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
          aria-label="Loop mode"
          aria-expanded={popoverOpen}
          aria-haspopup="true"
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
                <span>{t(opt.mode)}</span>
              </button>
            ))}
            {loopConfig.mode === "count" && (
              <div className="px-4 py-2 border-t border-zinc-700 flex items-center gap-2">
                <label className="text-xs text-zinc-400">{t('loopCount')}</label>
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
        aria-label="Animation timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={Math.max(totalFrames - 1, 0)}
        aria-valuenow={currentFrame}
        className="flex-1 accent-zinc-400 h-2 touch-pan-x"
      />

      <span
        className="text-xs text-zinc-400 font-mono whitespace-nowrap"
        title={`Frame ${currentFrame} / ${totalFrames}`}
      >
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>

      <div className="relative" ref={shortcutsRef}>
        <button
          onClick={() => setShortcutsOpen((v) => !v)}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
          title={t('shortcuts')}
          aria-label="Show keyboard shortcuts"
          aria-expanded={shortcutsOpen}
        >
          ⌨
        </button>
        {shortcutsOpen && (
          <div className="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-3 px-4 min-w-[220px]">
            <p className="text-xs font-semibold text-zinc-200 mb-2">{t('shortcuts')}</p>
            <div className="space-y-1.5 text-xs text-zinc-400">
              <div className="flex justify-between"><span>{"Play / Pause"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">Space</kbd></div>
              <div className="flex justify-between"><span>{"Previous frame"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">←</kbd></div>
              <div className="flex justify-between"><span>{"Next frame"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">→</kbd></div>
              <div className="flex justify-between"><span>{"First frame"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">Home</kbd></div>
              <div className="flex justify-between"><span>{"Last frame"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">End</kbd></div>
              <div className="flex justify-between"><span>{"Slower"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">[</kbd></div>
              <div className="flex justify-between"><span>{"Faster"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">]</kbd></div>
              <div className="flex justify-between"><span>{"Undo"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Z</kbd></div>
              <div className="flex justify-between"><span>{"Redo"}</span><kbd className="bg-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded font-mono">Ctrl+⇧+Z</kbd></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
