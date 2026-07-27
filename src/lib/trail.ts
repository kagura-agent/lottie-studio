export const VALID_FADE_MODES_TRAIL = ["linear", "exponential", "stepped"] as const;
export type TrailFadeMode = (typeof VALID_FADE_MODES_TRAIL)[number];

export interface TrailOptions {
  count: number;
  fade: TrailFadeMode;
  spacing?: number;
  layer?: string;
  color?: string;
  scale: boolean;
}

interface LottieLayer {
  nm?: string;
  ip?: number;
  op?: number;
  ks?: {
    o?: { a: number; k: unknown };
    s?: { a: number; k: unknown };
    [key: string]: unknown;
  };
  shapes?: ShapeGroup[];
  [key: string]: unknown;
}

interface ShapeGroup {
  ty: string;
  it?: ShapeItem[];
  [key: string]: unknown;
}

interface ShapeItem {
  ty: string;
  c?: { a: number; k: number[] | unknown };
  [key: string]: unknown;
}

interface LottieAnimation {
  fr: number;
  ip: number;
  op: number;
  layers: LottieLayer[];
  [key: string]: unknown;
}

function hasKeyframes(layer: LottieLayer): boolean {
  if (!layer.ks) return false;
  const transform = layer.ks;
  for (const key of Object.keys(transform)) {
    const prop = transform[key] as { a?: number } | undefined;
    if (prop && typeof prop === "object" && prop.a === 1) return true;
  }
  return false;
}

function findTargetLayer(animation: LottieAnimation, layerName?: string): number {
  if (layerName) {
    const idx = animation.layers.findIndex((l) => l.nm === layerName);
    return idx;
  }
  for (let i = animation.layers.length - 1; i >= 0; i--) {
    if (hasKeyframes(animation.layers[i])) return i;
  }
  if (animation.layers.length > 0) return animation.layers.length - 1;
  return -1;
}

function computeOpacity(index: number, count: number, fade: TrailFadeMode): number {
  switch (fade) {
    case "linear":
      return 1 - index / count;
    case "exponential":
      return Math.pow(0.5, index);
    case "stepped":
      return index < count / 2 ? 0.5 : 0.2;
  }
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function applyColorTint(layer: LottieLayer, color: string): void {
  const [r, g, b] = hexToRgbNormalized(color);
  if (!layer.shapes) return;

  for (const shape of layer.shapes) {
    if (shape.it) {
      for (const item of shape.it) {
        if ((item.ty === "fl" || item.ty === "st") && item.c) {
          const colorProp = item.c as { a: number; k: number[] };
          if (colorProp.a === 0 && Array.isArray(colorProp.k)) {
            colorProp.k = [r, g, b, colorProp.k[3] ?? 1];
          }
        }
      }
    }
  }
}

export function generateTrail(lottieJson: object, options: TrailOptions): object {
  const animation = JSON.parse(JSON.stringify(lottieJson)) as LottieAnimation;

  if (animation.layers.length === 0) return animation;

  const targetIdx = findTargetLayer(animation, options.layer);
  if (targetIdx === -1) return animation;

  const targetLayer = animation.layers[targetIdx];
  const totalDuration = animation.op - animation.ip;
  const spacing = options.spacing ?? Math.round(totalDuration / (options.count + 1));

  const trailLayers: LottieLayer[] = [];

  for (let i = 1; i <= options.count; i++) {
    const copy = JSON.parse(JSON.stringify(targetLayer)) as LottieLayer;
    copy.nm = `${targetLayer.nm || "layer"}_trail_${i}`;

    // Offset in-point
    const baseIp = targetLayer.ip ?? animation.ip;
    copy.ip = baseIp + spacing * i;

    // Set opacity
    const opacity = computeOpacity(i, options.count, options.fade) * 100;
    if (copy.ks) {
      copy.ks.o = { a: 0, k: opacity };
    }

    // Progressive scale
    if (options.scale && copy.ks) {
      const scaleFactor = 100 - (40 * i) / options.count;
      copy.ks.s = { a: 0, k: [scaleFactor, scaleFactor, 100] };
    }

    // Color tint
    if (options.color) {
      applyColorTint(copy, options.color);
    }

    trailLayers.push(copy);
  }

  // Insert trail copies behind (lower index = rendered behind in Lottie)
  animation.layers.splice(targetIdx + 1, 0, ...trailLayers);

  return animation;
}
