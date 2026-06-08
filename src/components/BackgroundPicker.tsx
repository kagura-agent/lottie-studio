"use client";

import { useState, useRef, useEffect } from "react";

export type CanvasBackground = "checkered" | "white" | "black" | string;

interface BackgroundPickerProps {
  value: CanvasBackground;
  onChange: (bg: CanvasBackground) => void;
}

const PRESETS: { id: CanvasBackground; label: string; preview: string }[] = [
  { id: "checkered", label: "Checkered", preview: "bg-checkered" },
  { id: "white", label: "White", preview: "bg-white" },
  { id: "black", label: "Black", preview: "bg-black" },
];

export default function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const isCustomColor = value.startsWith("#");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Canvas background"
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors flex items-center justify-center gap-1.5"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0"
        >
          <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
          <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-2 min-w-[160px]">
          <div className="flex flex-col gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onChange(preset.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  value === preset.id
                    ? "bg-zinc-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border border-zinc-600 shrink-0 ${
                    preset.id === "white"
                      ? "bg-white"
                      : preset.id === "black"
                      ? "bg-black"
                      : ""
                  }`}
                  style={
                    preset.id === "checkered"
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)",
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        }
                      : undefined
                  }
                />
                {preset.label}
              </button>
            ))}

            {/* Custom color */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                isCustomColor
                  ? "bg-zinc-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer w-full">
                <span
                  className="w-4 h-4 rounded border border-zinc-600 shrink-0 overflow-hidden"
                  style={{ backgroundColor: isCustomColor ? value : "#6366f1" }}
                />
                <span className="flex-1">Custom</span>
                <input
                  type="color"
                  value={isCustomColor ? value : "#6366f1"}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
