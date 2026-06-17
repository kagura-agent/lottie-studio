"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface TimingEditorProps {
  animationData: unknown;
  onChange: (updatedData: unknown) => void;
}

interface TimingInfo {
  duration: number;
  frameRate: number;
  totalFrames: number;
  inPoint: number;
  outPoint: number;
}

// --- Timing extraction ---

function getTimingInfo(data: unknown): TimingInfo | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  const fr = typeof root.fr === "number" ? root.fr : 30;
  const ip = typeof root.ip === "number" ? root.ip : 0;
  const op = typeof root.op === "number" ? root.op : 0;
  const totalFrames = op - ip;
  const duration = fr > 0 ? totalFrames / fr : 0;

  return { duration, frameRate: fr, totalFrames, inPoint: ip, outPoint: op };
}

// --- Keyframe traversal ---

type AnimatedProp = Record<string, unknown>;
type ShapeItem = Record<string, unknown>;
type Layer = Record<string, unknown>;

/**
 * Scale all keyframe `t` values in an animated property by the given ratio.
 * An animated property has `a: 1` and `k` is an array of keyframe objects with `t` fields.
 */
function scaleKeyframesInProp(prop: AnimatedProp, ratio: number): void {
  if (!prop || typeof prop !== "object") return;
  if (prop.a !== 1) return;
  if (!Array.isArray(prop.k)) return;

  for (const kf of prop.k) {
    if (kf && typeof kf === "object" && typeof (kf as Record<string, unknown>).t === "number") {
      (kf as Record<string, unknown>).t = (kf as Record<string, unknown>).t as number * ratio;
    }
  }
}

/** Transform property keys that can be animated */
const TRANSFORM_KEYS = ["p", "a", "s", "r", "o", "rx", "ry", "rz", "sk", "sa"];

function scaleKeyframesInTransform(ks: Record<string, unknown> | undefined, ratio: number): void {
  if (!ks || typeof ks !== "object") return;
  for (const key of TRANSFORM_KEYS) {
    if (ks[key]) {
      scaleKeyframesInProp(ks[key] as AnimatedProp, ratio);
    }
  }
}

function scaleKeyframesInShapes(shapes: ShapeItem[], ratio: number): void {
  for (const shape of shapes) {
    const ty = shape.ty as string;

    // Recurse into groups
    if (ty === "gr" && Array.isArray(shape.it)) {
      scaleKeyframesInShapes(shape.it as ShapeItem[], ratio);
    }

    // Shape-level properties that can be animated
    // Fill (fl), Stroke (st): c (color), o (opacity)
    // Rectangle (rc): s (size), p (position), r (roundness)
    // Ellipse (el): s (size), p (position)
    // Path (sh): ks (path data)
    // Trim (tm): s (start), e (end), o (offset)
    // Transform (tr): all transform keys
    // Gradient fill/stroke (gf/gs): s, e, etc.
    const propsToCheck = ["c", "o", "s", "p", "r", "e", "sk", "sa", "w"];
    for (const key of propsToCheck) {
      if (shape[key]) {
        scaleKeyframesInProp(shape[key] as AnimatedProp, ratio);
      }
    }

    // Shape path data (sh type has ks property)
    if (shape.ks) {
      scaleKeyframesInProp(shape.ks as AnimatedProp, ratio);
    }

    // Transform inside groups
    if (ty === "tr") {
      scaleKeyframesInTransform(shape as Record<string, unknown>, ratio);
    }
  }
}

function scaleKeyframesInLayers(layers: Layer[], ratio: number): void {
  for (const layer of layers) {
    // Layer transform
    if (layer.ks) {
      scaleKeyframesInTransform(layer.ks as Record<string, unknown>, ratio);
    }

    // Shape layers
    if (Array.isArray(layer.shapes)) {
      scaleKeyframesInShapes(layer.shapes as ShapeItem[], ratio);
    }

    // Text layer data
    if (layer.t && typeof layer.t === "object") {
      const textData = layer.t as Record<string, unknown>;
      if (Array.isArray(textData.a)) {
        for (const animator of textData.a as Record<string, unknown>[]) {
          if (animator.s) {
            const s = animator.s as Record<string, unknown>;
            for (const key of Object.keys(s)) {
              if (s[key] && typeof s[key] === "object") {
                scaleKeyframesInProp(s[key] as AnimatedProp, ratio);
              }
            }
          }
        }
      }
    }

    // Effects
    if (Array.isArray(layer.ef)) {
      for (const effect of layer.ef as Record<string, unknown>[]) {
        if (Array.isArray(effect.ef)) {
          for (const param of effect.ef as Record<string, unknown>[]) {
            if (param.v) {
              scaleKeyframesInProp(param.v as AnimatedProp, ratio);
            }
          }
        }
      }
    }

    // Scale layer in/out points
    if (typeof layer.ip === "number") {
      layer.ip = (layer.ip as number) * ratio;
    }
    if (typeof layer.op === "number") {
      layer.op = (layer.op as number) * ratio;
    }
    // Scale layer start time
    if (typeof layer.st === "number") {
      layer.st = (layer.st as number) * ratio;
    }
  }
}

function applyTimingChange(
  data: unknown,
  newOp: number,
  newFr: number,
  oldOp: number,
  oldIp: number
): unknown {
  const cloned = JSON.parse(JSON.stringify(data));
  const root = cloned as Record<string, unknown>;

  const ratio = oldOp > 0 ? newOp / oldOp : 1;

  // Scale keyframes in main layers
  if (Array.isArray(root.layers)) {
    scaleKeyframesInLayers(root.layers as Layer[], ratio);
  }

  // Scale keyframes in asset layers (precomps)
  if (Array.isArray(root.assets)) {
    for (const asset of root.assets as Record<string, unknown>[]) {
      if (Array.isArray(asset.layers)) {
        scaleKeyframesInLayers(asset.layers as Layer[], ratio);
      }
    }
  }

  // Update root properties
  root.ip = oldIp * ratio;
  root.op = (root.ip as number) + newOp;
  root.fr = newFr;

  return cloned;
}

// --- Frame rate presets ---
const FPS_PRESETS = [12, 24, 30, 60];

// --- Component ---

export default function TimingEditor({
  animationData,
  onChange,
}: TimingEditorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const timing = useMemo(
    () => getTimingInfo(animationData),
    [animationData]
  );

  // Local input states for controlled inputs
  const [durationInput, setDurationInput] = useState("");
  const [fpsInput, setFpsInput] = useState("");
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevTiming, setPrevTiming] = useState(timing);

  // Sync local input when popover opens or timing changes (derived state pattern)
  if ((open && !prevOpen) || (open && timing !== prevTiming)) {
    if (timing) {
      setDurationInput(timing.duration.toFixed(1));
      setFpsInput(String(timing.frameRate));
    }
  }
  if (open !== prevOpen) setPrevOpen(open);
  if (timing !== prevTiming) setPrevTiming(timing);

  // Outside-click dismiss
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

  const handleDurationChange = useCallback(
    (newDuration: number) => {
      if (!timing || !animationData) return;
      if (newDuration < 0.1 || newDuration > 30) return;

      const newOp = newDuration * timing.frameRate;
      const oldOp = timing.outPoint - timing.inPoint;
      const updated = applyTimingChange(
        animationData,
        newOp,
        timing.frameRate,
        oldOp,
        timing.inPoint
      );
      onChange(updated);
    },
    [animationData, timing, onChange]
  );

  const handleFrameRateChange = useCallback(
    (newFr: number) => {
      if (!timing || !animationData) return;
      if (newFr < 1 || newFr > 120) return;

      // Keep visual duration the same
      const newOp = timing.duration * newFr;
      const oldOp = timing.outPoint - timing.inPoint;
      const updated = applyTimingChange(
        animationData,
        newOp,
        newFr,
        oldOp,
        timing.inPoint
      );
      onChange(updated);
    },
    [animationData, timing, onChange]
  );

  const handleDurationSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setDurationInput(val.toFixed(1));
      handleDurationChange(val);
    },
    [handleDurationChange]
  );

  const handleDurationInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDurationInput(e.target.value);
    },
    []
  );

  const handleDurationBlur = useCallback(() => {
    const val = parseFloat(durationInput);
    if (!isNaN(val) && val >= 0.1 && val <= 30) {
      handleDurationChange(val);
    } else if (timing) {
      setDurationInput(timing.duration.toFixed(1));
    }
  }, [durationInput, handleDurationChange, timing]);

  const handleDurationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const handleFpsSelect = useCallback(
    (fps: number) => {
      setFpsInput(String(fps));
      handleFrameRateChange(fps);
    },
    [handleFrameRateChange]
  );

  const handleFpsInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFpsInput(e.target.value);
    },
    []
  );

  const handleFpsBlur = useCallback(() => {
    const val = parseInt(fpsInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 120) {
      handleFrameRateChange(val);
    } else if (timing) {
      setFpsInput(String(timing.frameRate));
    }
  }, [fpsInput, handleFrameRateChange, timing]);

  const handleFpsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const displayDuration = timing ? timing.duration.toFixed(1) : "--";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!timing}
        title="Animation timing"
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="8" cy="8" r="6.5" />
          <polyline points="8 4.5 8 8 11 9.5" />
        </svg>
        <span className="text-xs tabular-nums">{displayDuration}s</span>
      </button>

      {open && timing && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-3 min-w-[260px]">
          {/* Duration control */}
          <div className="mb-3">
            <div className="text-xs text-zinc-400 font-medium mb-1.5">
              Duration
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <input
                type="range"
                min="0.1"
                max="30"
                step="0.1"
                value={parseFloat(durationInput) || timing.duration}
                onChange={handleDurationSlider}
                className="flex-1 h-1.5 accent-zinc-400 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300"
              />
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={durationInput}
                  onChange={handleDurationInput}
                  onBlur={handleDurationBlur}
                  onKeyDown={handleDurationKeyDown}
                  className="w-14 px-1.5 py-1 rounded bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs text-center font-mono focus:outline-none focus:border-zinc-400"
                />
                <span className="text-xs text-zinc-500">s</span>
              </div>
            </div>
          </div>

          {/* Frame rate selector */}
          <div className="mb-3">
            <div className="text-xs text-zinc-400 font-medium mb-1.5">
              Frame Rate
            </div>
            <div className="flex items-center gap-1.5">
              {FPS_PRESETS.map((fps) => (
                <button
                  key={fps}
                  onClick={() => handleFpsSelect(fps)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    timing.frameRate === fps
                      ? "bg-zinc-600 text-white"
                      : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                  }`}
                >
                  {fps}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={fpsInput}
                  onChange={handleFpsInput}
                  onBlur={handleFpsBlur}
                  onKeyDown={handleFpsKeyDown}
                  className="w-12 px-1.5 py-1 rounded bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs text-center font-mono focus:outline-none focus:border-zinc-400"
                />
                <span className="text-xs text-zinc-500">fps</span>
              </div>
            </div>
          </div>

          {/* Info display */}
          <div className="border-t border-zinc-700 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total frames</span>
              <span className="text-zinc-300 font-mono tabular-nums">
                {Math.round(timing.totalFrames)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-0.5">
              <span className="text-zinc-500">Frame rate</span>
              <span className="text-zinc-300 font-mono tabular-nums">
                {timing.frameRate} fps
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-0.5">
              <span className="text-zinc-500">Duration</span>
              <span className="text-zinc-300 font-mono tabular-nums">
                {timing.duration.toFixed(2)}s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
