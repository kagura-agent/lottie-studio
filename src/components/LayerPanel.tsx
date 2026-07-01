"use client";

import { useState } from "react";

interface LottieLayer {
  nm?: string;
  ty: number;
  hd?: boolean;
  ind?: number;
  ks?: { o?: { a?: number; k?: number | unknown[] } };
}

interface LayerPanelProps {
  animationData: object | null;
  onSelectLayer: (layerName: string) => void;
  onToggleVisibility: (layerIndex: number, hidden: boolean) => void;
  onChangeOpacity: (layerIndex: number, opacity: number) => void;
  onPreviewOpacity: (layerIndex: number, opacity: number) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
}

function getTypeIcon(ty: number): string {
  switch (ty) {
    case 4: return "◆";  // shape
    case 1: return "■";  // solid
    case 5: return "T";  // text
    case 2: return "🖼"; // image
    case 0:              // precomp
    case 3: return "📁"; // null
    default: return "○";
  }
}

function getTypeName(ty: number): string {
  switch (ty) {
    case 0: return "Precomp";
    case 1: return "Solid";
    case 2: return "Image";
    case 3: return "Null";
    case 4: return "Shape";
    case 5: return "Text";
    default: return "Layer";
  }
}

function getOpacity(layer: LottieLayer): number {
  const o = layer.ks?.o;
  if (!o) return 100;
  if (o.a === 1 && Array.isArray(o.k)) {
    // Animated: read first keyframe start value
    for (const kf of o.k) {
      if (kf && typeof kf === 'object' && 's' in (kf as Record<string, unknown>)) {
        const s = (kf as Record<string, unknown>).s;
        if (Array.isArray(s) && typeof s[0] === 'number') return Math.round(s[0]);
      }
    }
    return 100;
  }
  if (typeof o.k === 'number') return Math.round(o.k);
  return 100;
}

export default function LayerPanel({ animationData, onSelectLayer, onToggleVisibility, onChangeOpacity, onPreviewOpacity, onReorderLayers }: LayerPanelProps) {
  const layers: LottieLayer[] = (animationData as Record<string, unknown>)?.layers as LottieLayer[] ?? [];

  // Track dragging state: [layerIndex, opacity value]
  const [draggingState, setDraggingState] = useState<{ layerIndex: number; opacity: number } | null>(null);

  // Track drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Reverse for render order: last in array = bottom layer visually
  const displayLayers = [...layers].reverse();

  if (!animationData || layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No layers found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-400 font-medium">{layers.length} layers</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {displayLayers.map((layer, displayIdx) => {
          // Original index in the layers array
          const originalIndex = layers.length - 1 - displayIdx;
          const name = layer.nm || `${getTypeName(layer.ty)} ${originalIndex}`;
          const icon = getTypeIcon(layer.ty);
          const isHidden = !!layer.hd;

          return (
            <div key={originalIndex} className="relative">
              {dragOverIndex === displayIdx && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
              )}
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedIndex(displayIdx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(originalIndex));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggedIndex !== displayIdx) {
                    setDragOverIndex(displayIdx);
                  }
                }}
                onDragLeave={() => {
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromOriginalIndex = Number(e.dataTransfer.getData("text/plain"));
                  const toOriginalIndex = originalIndex;
                  if (fromOriginalIndex !== toOriginalIndex) {
                    onReorderLayers(fromOriginalIndex, toOriginalIndex);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors group ${
                  isHidden ? "opacity-50" : ""
                } ${draggedIndex === displayIdx ? "opacity-40" : ""}`}
              >
                <button
                  className="text-zinc-500 hover:text-zinc-300 text-sm w-4 text-center shrink-0 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-label={`Drag to reorder layer ${name}`}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ≡
                </button>
                <span className="text-sm w-5 text-center shrink-0" title={getTypeName(layer.ty)}>
                  {icon}
                </span>
              <button
                onClick={() => onSelectLayer(`[${name}]`)}
                className="flex-1 text-left text-sm text-zinc-200 truncate hover:text-zinc-100 transition-colors"
                title={name}
              >
                {name}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-zinc-500 w-7 text-right tabular-nums">
                  {draggingState?.layerIndex === originalIndex ? draggingState.opacity : getOpacity(layer)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draggingState?.layerIndex === originalIndex ? draggingState.opacity : getOpacity(layer)}
                  aria-label={`Opacity for layer ${name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={draggingState?.layerIndex === originalIndex ? draggingState.opacity : getOpacity(layer)}
                  onPointerDown={(e) => {
                    // Start dragging - record initial state
                    setDraggingState({ layerIndex: originalIndex, opacity: getOpacity(layer) });
                    // Capture pointer to ensure we get pointer-up even if cursor leaves element
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onChange={(e) => {
                    const newOpacity = Number(e.target.value);
                    // Update local state for immediate visual feedback
                    setDraggingState({ layerIndex: originalIndex, opacity: newOpacity });
                    // Call preview handler to update canvas without pushing undo
                    onPreviewOpacity(originalIndex, newOpacity);
                  }}
                  onPointerUp={(e) => {
                    if (draggingState?.layerIndex === originalIndex) {
                      // Commit final value with undo entry
                      onChangeOpacity(originalIndex, draggingState.opacity);
                      setDraggingState(null);
                    }
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => {
                    // Handle cancelled drag (e.g., context menu)
                    setDraggingState(null);
                  }}
                  className="w-16 h-1 accent-zinc-400 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-thumb]:hover:bg-white [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-zinc-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:hover:bg-white"
                  title={`Opacity: ${draggingState?.layerIndex === originalIndex ? draggingState.opacity : getOpacity(layer)}%`}
                />
              </div>
              <button
                onClick={() => onToggleVisibility(originalIndex, !isHidden)}
                className={`shrink-0 w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                  isHidden
                    ? "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
                title={isHidden ? "Show layer" : "Hide layer"}
                aria-label={isHidden ? `Show layer ${name}` : `Hide layer ${name}`}
                aria-pressed={!isHidden}
              >
                {isHidden ? "🚫" : "👁"}
              </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
