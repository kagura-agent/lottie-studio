"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ArtboardPickerProps {
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}

interface Preset {
  label: string;
  w: number;
  h: number;
  desc: string;
}

const PRESETS: Preset[] = [
  { label: "Square", w: 512, h: 512, desc: "Social media, icons" },
  { label: "Landscape", w: 1920, h: 1080, desc: "YouTube, presentations" },
  { label: "Portrait", w: 1080, h: 1920, desc: "Stories, mobile" },
  { label: "Banner", w: 1200, h: 630, desc: "OG images, social cards" },
];

function clampDimension(val: number): number {
  return Math.max(1, Math.min(4096, Math.round(val)));
}

export default function ArtboardPicker({ width, height, onChange }: ArtboardPickerProps) {
  const [open, setOpen] = useState(false);
  const [customW, setCustomW] = useState(String(width));
  const [customH, setCustomH] = useState(String(height));
  const ref = useRef<HTMLDivElement>(null);
  const [prevWidth, setPrevWidth] = useState(width);
  const [prevHeight, setPrevHeight] = useState(height);

  // Sync custom inputs when external width/height change (derived state pattern)
  if (width !== prevWidth || height !== prevHeight) {
    setPrevWidth(width);
    setPrevHeight(height);
    setCustomW(String(width));
    setCustomH(String(height));
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isPresetActive = (preset: Preset) => preset.w === width && preset.h === height;
  const isCustom = !PRESETS.some((p) => p.w === width && p.h === height);

  const applyCustom = useCallback(() => {
    const w = clampDimension(Number(customW) || 512);
    const h = clampDimension(Number(customH) || 512);
    setCustomW(String(w));
    setCustomH(String(h));
    if (w !== width || h !== height) {
      onChange(w, h);
    }
  }, [customW, customH, width, height, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyCustom();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Artboard dimensions"
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors flex items-center justify-center gap-1.5"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0"
        >
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M2 5h12M5 2v12" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </svg>
        <span className="hidden md:inline text-xs text-zinc-400">
          {width}×{height}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-2 min-w-[200px]">
          <div className="flex flex-col gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  onChange(preset.w, preset.h);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors text-left ${
                  isPresetActive(preset)
                    ? "bg-zinc-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <span className="flex-1">
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-zinc-400 ml-1.5 text-xs">
                    {preset.w}×{preset.h}
                  </span>
                </span>
                <span className="text-zinc-500 text-xs">{preset.desc}</span>
              </button>
            ))}

            {/* Custom dimensions */}
            <div className="border-t border-zinc-700 mt-1 pt-2">
              <div
                className={`px-3 py-1.5 rounded text-sm ${
                  isCustom ? "bg-zinc-600 text-white" : "text-zinc-300"
                }`}
              >
                <span className="text-xs font-medium">Custom</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="flex items-center gap-1 flex-1">
                  <label className="text-xs text-zinc-500">W</label>
                  <input
                    type="number"
                    min={1}
                    max={4096}
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    onBlur={applyCustom}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <span className="text-zinc-500 text-xs">×</span>
                <div className="flex items-center gap-1 flex-1">
                  <label className="text-xs text-zinc-500">H</label>
                  <input
                    type="number"
                    min={1}
                    max={4096}
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    onBlur={applyCustom}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
