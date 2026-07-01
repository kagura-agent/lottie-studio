"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface ColorPaletteProps {
  animationData: unknown;
  onChange: (updatedData: unknown) => void;
}

interface ColorEntry {
  /** Hex color string, e.g. "#ff00aa" */
  hex: string;
  /** Lottie RGBA in 0-1 range */
  rgba: [number, number, number, number];
  /** Number of times this color appears */
  count: number;
  /** Layer names where this color is used */
  layers: string[];
}

// --- Color conversion helpers ---

function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return [r, g, b, 1];
}

function colorsMatch(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  // Compare with small epsilon for floating point
  return (
    Math.abs(a[0] - b[0]) < 0.002 &&
    Math.abs(a[1] - b[1]) < 0.002 &&
    Math.abs(a[2] - b[2]) < 0.002
  );
}

function isStaticColor(
  ck: unknown
): ck is [number, number, number, number] {
  if (!Array.isArray(ck)) return false;
  if (ck.length < 3 || ck.length > 4) return false;
  return ck.every((v) => typeof v === "number");
}

// --- Lottie traversal ---

type ShapeItem = Record<string, unknown>;
type Layer = Record<string, unknown>;

function extractColorsFromShapes(
  shapes: ShapeItem[],
  layerName: string,
  result: Map<string, { rgba: [number, number, number, number]; count: number; layers: Set<string> }>
): void {
  for (const shape of shapes) {
    const ty = shape.ty as string;

    // Recurse into groups
    if (ty === "gr" && Array.isArray(shape.it)) {
      extractColorsFromShapes(
        shape.it as ShapeItem[],
        layerName,
        result
      );
      continue;
    }

    // Fill or stroke (skip gradients)
    if (ty === "fl" || ty === "st") {
      const c = shape.c as { k?: unknown } | undefined;
      if (!c || !c.k) continue;
      if (!isStaticColor(c.k)) continue;

      const rgba: [number, number, number, number] = [
        c.k[0],
        c.k[1],
        c.k[2],
        c.k[3] ?? 1,
      ];
      const hex = rgbaToHex(rgba[0], rgba[1], rgba[2]);

      const existing = result.get(hex);
      if (existing) {
        existing.count++;
        existing.layers.add(layerName);
      } else {
        result.set(hex, {
          rgba,
          count: 1,
          layers: new Set([layerName]),
        });
      }
    }
  }
}

function extractColorsFromLayers(
  layers: Layer[],
  result: Map<string, { rgba: [number, number, number, number]; count: number; layers: Set<string> }>
): void {
  for (const layer of layers) {
    const layerName = (layer.nm as string) || "Unnamed";

    // Shape layers have shapes array
    if (Array.isArray(layer.shapes)) {
      extractColorsFromShapes(
        layer.shapes as ShapeItem[],
        layerName,
        result
      );
    }

    // Precomp layers can have nested layers
    if (Array.isArray((layer as Record<string, unknown>).layers)) {
      extractColorsFromLayers(
        (layer as Record<string, unknown>).layers as Layer[],
        result
      );
    }
  }
}

function extractColors(data: unknown): ColorEntry[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  const result = new Map<
    string,
    { rgba: [number, number, number, number]; count: number; layers: Set<string> }
  >();

  // Process main layers
  if (Array.isArray(root.layers)) {
    extractColorsFromLayers(root.layers as Layer[], result);
  }

  // Process assets (precomps have their own layers)
  if (Array.isArray(root.assets)) {
    for (const asset of root.assets as Record<string, unknown>[]) {
      if (Array.isArray(asset.layers)) {
        extractColorsFromLayers(asset.layers as Layer[], result);
      }
    }
  }

  return Array.from(result.entries()).map(([hex, info]) => ({
    hex,
    rgba: info.rgba,
    count: info.count,
    layers: Array.from(info.layers),
  }));
}

// --- Deep replace color in Lottie JSON ---

function replaceColorInShapes(
  shapes: ShapeItem[],
  oldRgba: [number, number, number, number],
  newRgba: [number, number, number, number]
): void {
  for (const shape of shapes) {
    const ty = shape.ty as string;

    if (ty === "gr" && Array.isArray(shape.it)) {
      replaceColorInShapes(
        shape.it as ShapeItem[],
        oldRgba,
        newRgba
      );
      continue;
    }

    if (ty === "fl" || ty === "st") {
      const c = shape.c as { k?: unknown } | undefined;
      if (!c || !c.k) continue;
      if (!isStaticColor(c.k)) continue;

      const current: [number, number, number, number] = [
        c.k[0],
        c.k[1],
        c.k[2],
        c.k[3] ?? 1,
      ];

      if (colorsMatch(current, oldRgba)) {
        c.k = [...newRgba];
      }
    }
  }
}

function replaceColorInLayers(
  layers: Layer[],
  oldRgba: [number, number, number, number],
  newRgba: [number, number, number, number]
): void {
  for (const layer of layers) {
    if (Array.isArray(layer.shapes)) {
      replaceColorInShapes(
        layer.shapes as ShapeItem[],
        oldRgba,
        newRgba
      );
    }
    if (Array.isArray((layer as Record<string, unknown>).layers)) {
      replaceColorInLayers(
        (layer as Record<string, unknown>).layers as Layer[],
        oldRgba,
        newRgba
      );
    }
  }
}

function replaceColor(
  data: unknown,
  oldRgba: [number, number, number, number],
  newRgba: [number, number, number, number]
): unknown {
  const cloned = JSON.parse(JSON.stringify(data));
  const root = cloned as Record<string, unknown>;

  if (Array.isArray(root.layers)) {
    replaceColorInLayers(root.layers as Layer[], oldRgba, newRgba);
  }

  if (Array.isArray(root.assets)) {
    for (const asset of root.assets as Record<string, unknown>[]) {
      if (Array.isArray(asset.layers)) {
        replaceColorInLayers(asset.layers as Layer[], oldRgba, newRgba);
      }
    }
  }

  return cloned;
}

// --- Component ---

export default function ColorPalette({
  animationData,
  onChange,
}: ColorPaletteProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const colors = useMemo(
    () => extractColors(animationData),
    [animationData]
  );

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

  const handleColorChange = useCallback(
    (entry: ColorEntry, newHex: string) => {
      const newRgba = hexToRgba(newHex);
      const updated = replaceColor(animationData, entry.rgba, newRgba);
      onChange(updated);
    },
    [animationData, onChange]
  );

  // Show up to 4 preview dots on the button
  const previewColors = colors.slice(0, 4);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={colors.length === 0}
        title="Color palette"
        aria-label="Color palette"
        aria-expanded={open}
        aria-haspopup="true"
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {previewColors.length > 0 ? (
          <span className="flex items-center gap-0.5">
            {previewColors.map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full border border-zinc-600 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {colors.length > 4 && (
              <span className="text-xs text-zinc-500 ml-0.5">
                +{colors.length - 4}
              </span>
            )}
          </span>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0"
          >
            <circle cx="8" cy="4" r="2.5" fill="#ef4444" opacity="0.8" />
            <circle cx="4.5" cy="10" r="2.5" fill="#3b82f6" opacity="0.8" />
            <circle cx="11.5" cy="10" r="2.5" fill="#22c55e" opacity="0.8" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-3 min-w-[240px] max-h-[320px] overflow-y-auto">
          <div className="text-xs text-zinc-400 font-medium mb-2">
            Colors ({colors.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {colors.map((entry) => (
              <ColorSwatchRow
                key={entry.hex}
                entry={entry}
                onColorChange={handleColorChange}
              />
            ))}
          </div>
          {colors.length === 0 && (
            <div className="text-xs text-zinc-500 py-2 text-center">
              No static colors found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ColorSwatchRow({
  entry,
  onColorChange,
}: {
  entry: ColorEntry;
  onColorChange: (entry: ColorEntry, newHex: string) => void;
}) {
  const layerLabel =
    entry.layers.length <= 2
      ? entry.layers.join(", ")
      : `${entry.layers[0]}, ${entry.layers[1]} +${entry.layers.length - 2}`;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700/50 transition-colors">
      <label className="relative w-5 h-5 shrink-0 cursor-pointer">
        <span
          className="block w-5 h-5 rounded border border-zinc-600"
          style={{ backgroundColor: entry.hex }}
        />
        <input
          type="color"
          value={entry.hex}
          onChange={(e) => onColorChange(entry, e.target.value)}
          aria-label={`Change color ${entry.hex}`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-200 font-mono">
            {entry.hex.toUpperCase()}
          </span>
          <span className="text-xs text-zinc-500">
            ×{entry.count}
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 truncate" title={entry.layers.join(", ")}>
          {layerLabel}
        </div>
      </div>
    </div>
  );
}
