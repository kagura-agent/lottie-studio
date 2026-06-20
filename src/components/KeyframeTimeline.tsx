"use client";

import { useState, useRef, useMemo, useCallback } from "react";

interface KeyframeTimelineProps {
  animationData: object | null;
  currentFrame: number;
  totalFrames: number;
  onSeek: (frame: number) => void;
}

interface KeyframeInfo {
  frame: number;
  property: string;
}

interface LayerTimeline {
  name: string;
  inPoint: number;
  outPoint: number;
  keyframes: KeyframeInfo[];
}

// Colors for layer keyframe markers (rotating palette)
const LAYER_COLORS = [
  "#60a5fa", // blue-400
  "#f472b6", // pink-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#22d3ee", // cyan-400
  "#f87171", // red-400
];

// Map transform key codes to readable names
const PROP_NAMES: Record<string, string> = {
  p: "Position",
  a: "Anchor Point",
  s: "Scale",
  r: "Rotation",
  o: "Opacity",
  rx: "X Rotation",
  ry: "Y Rotation",
  rz: "Z Rotation",
  sk: "Skew",
  sa: "Skew Axis",
};

const SHAPE_PROP_NAMES: Record<string, string> = {
  c: "Fill Color",
  o: "Opacity",
  s: "Size",
  p: "Position",
  r: "Roundness",
  e: "End",
  w: "Stroke Width",
  ks: "Path",
};

type AnimatedProp = Record<string, unknown>;
type Layer = Record<string, unknown>;
type ShapeItem = Record<string, unknown>;

function collectKeyframesFromProp(
  prop: AnimatedProp,
  propName: string,
  out: KeyframeInfo[]
): void {
  if (!prop || typeof prop !== "object") return;
  if (prop.a !== 1) return;
  if (!Array.isArray(prop.k)) return;

  for (const kf of prop.k) {
    if (kf && typeof kf === "object" && typeof (kf as Record<string, unknown>).t === "number") {
      out.push({ frame: (kf as Record<string, unknown>).t as number, property: propName });
    }
  }
}

function collectKeyframesFromTransform(
  ks: Record<string, unknown> | undefined,
  out: KeyframeInfo[]
): void {
  if (!ks || typeof ks !== "object") return;
  const transformKeys = ["p", "a", "s", "r", "o", "rx", "ry", "rz", "sk", "sa"];
  for (const key of transformKeys) {
    if (ks[key]) {
      collectKeyframesFromProp(
        ks[key] as AnimatedProp,
        PROP_NAMES[key] || key,
        out
      );
    }
  }
}

function collectKeyframesFromShapes(
  shapes: ShapeItem[],
  out: KeyframeInfo[]
): void {
  for (const shape of shapes) {
    const ty = shape.ty as string;

    if (ty === "gr" && Array.isArray(shape.it)) {
      collectKeyframesFromShapes(shape.it as ShapeItem[], out);
    }

    const propsToCheck = ["c", "o", "s", "p", "r", "e", "w"];
    for (const key of propsToCheck) {
      if (shape[key]) {
        collectKeyframesFromProp(
          shape[key] as AnimatedProp,
          SHAPE_PROP_NAMES[key] || key,
          out
        );
      }
    }

    if (shape.ks) {
      collectKeyframesFromProp(shape.ks as AnimatedProp, "Path", out);
    }

    if (ty === "tr") {
      collectKeyframesFromTransform(shape as Record<string, unknown>, out);
    }
  }
}

function extractLayerTimelines(data: object | null): {
  layers: LayerTimeline[];
  globalIp: number;
  globalOp: number;
} {
  if (!data || typeof data !== "object") {
    return { layers: [], globalIp: 0, globalOp: 0 };
  }

  const root = data as Record<string, unknown>;
  const globalIp = typeof root.ip === "number" ? root.ip : 0;
  const globalOp = typeof root.op === "number" ? root.op : 0;

  if (!Array.isArray(root.layers)) {
    return { layers: [], globalIp, globalOp };
  }

  const layers: LayerTimeline[] = [];

  for (const layer of root.layers as Layer[]) {
    const name = (typeof layer.nm === "string" ? layer.nm : `Layer ${layers.length + 1}`);
    const ip = typeof layer.ip === "number" ? layer.ip : globalIp;
    const op = typeof layer.op === "number" ? layer.op : globalOp;
    const keyframes: KeyframeInfo[] = [];

    // Collect keyframes from layer transform
    if (layer.ks) {
      collectKeyframesFromTransform(layer.ks as Record<string, unknown>, keyframes);
    }

    // Collect keyframes from shapes
    if (Array.isArray(layer.shapes)) {
      collectKeyframesFromShapes(layer.shapes as ShapeItem[], keyframes);
    }

    layers.push({ name, inPoint: ip, outPoint: op, keyframes });
  }

  return { layers, globalIp, globalOp };
}

// Deduplicate keyframes at same frame (combine property names)
function dedupeKeyframes(keyframes: KeyframeInfo[]): KeyframeInfo[] {
  const map = new Map<number, string[]>();
  for (const kf of keyframes) {
    const existing = map.get(kf.frame);
    if (existing) {
      if (!existing.includes(kf.property)) {
        existing.push(kf.property);
      }
    } else {
      map.set(kf.frame, [kf.property]);
    }
  }
  return Array.from(map.entries()).map(([frame, props]) => ({
    frame,
    property: props.join(", "),
  }));
}

export default function KeyframeTimeline({
  animationData,
  currentFrame,
  totalFrames,
  onSeek,
}: KeyframeTimelineProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { layers, globalIp, globalOp } = useMemo(
    () => extractLayerTimelines(animationData),
    [animationData]
  );

  const duration = globalOp - globalIp;

  const frameToPercent = useCallback(
    (frame: number) => {
      if (duration <= 0) return 0;
      return ((frame - globalIp) / duration) * 100;
    },
    [duration, globalIp]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const frame = Math.round(globalIp + percent * duration);
      onSeek(Math.max(0, Math.min(frame, totalFrames - 1)));
    },
    [globalIp, duration, totalFrames, onSeek]
  );

  const handleKeyframeHover = useCallback(
    (e: React.MouseEvent, property: string) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        text: property,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    []
  );

  const handleKeyframeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (!animationData || layers.length === 0) return null;

  const playheadPercent = frameToPercent(currentFrame);

  return (
    <div className="hidden md:block border-t border-zinc-800 bg-zinc-900 shrink-0">
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`transition-transform ${collapsed ? "" : "rotate-90"}`}
        >
          <path d="M3 1l4 4-4 4z" />
        </svg>
        <span>Timeline</span>
        <span className="text-zinc-500">
          {layers.length} layer{layers.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Timeline content */}
      {!collapsed && (
        <div
          ref={timelineRef}
          className="relative px-3 pb-2 max-h-[120px] overflow-y-auto"
        >
          {/* Frame ruler */}
          <div
            className="relative h-4 mb-1 cursor-pointer rounded bg-zinc-800/50"
            onClick={handleTimelineClick}
          >
            {/* Frame markers */}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[9px] text-zinc-500 font-mono">
                {Math.round(globalIp)}
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">
                {Math.round(globalOp)}
              </span>
            </div>
            {/* Playhead on ruler */}
            <div
              className="absolute top-0 bottom-0 w-px bg-zinc-100"
              style={{ left: `${playheadPercent}%` }}
            />
          </div>

          {/* Layer rows */}
          <div className="space-y-px">
            {layers.map((layer, i) => {
              const color = LAYER_COLORS[i % LAYER_COLORS.length];
              const barLeft = frameToPercent(layer.inPoint);
              const barWidth = frameToPercent(layer.outPoint) - barLeft;
              const dedupedKfs = dedupeKeyframes(layer.keyframes);

              return (
                <div
                  key={i}
                  className="flex items-center h-5 group"
                >
                  {/* Layer name */}
                  <div className="w-24 shrink-0 truncate text-[10px] text-zinc-400 pr-2">
                    {layer.name}
                  </div>
                  {/* Track */}
                  <div
                    className="flex-1 relative h-4 rounded-sm bg-zinc-800/30 cursor-pointer"
                    onClick={handleTimelineClick}
                  >
                    {/* Active span bar */}
                    <div
                      className="absolute top-1 bottom-1 rounded-sm opacity-30"
                      style={{
                        left: `${barLeft}%`,
                        width: `${barWidth}%`,
                        backgroundColor: color,
                      }}
                    />
                    {/* Keyframe markers */}
                    {dedupedKfs.map((kf, ki) => {
                      const pos = frameToPercent(kf.frame);
                      return (
                        <div
                          key={ki}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border border-zinc-600 hover:border-zinc-300 transition-colors cursor-default"
                          style={{
                            left: `${pos}%`,
                            backgroundColor: color,
                          }}
                          onMouseEnter={(e) => handleKeyframeHover(e, kf.property)}
                          onMouseLeave={handleKeyframeLeave}
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    })}
                    {/* Playhead */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-zinc-100/70 pointer-events-none"
                      style={{ left: `${playheadPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-[10px] shadow-lg pointer-events-none whitespace-nowrap"
              style={{
                left: tooltip.x,
                top: tooltip.y - 24,
                transform: "translateX(-50%)",
              }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
