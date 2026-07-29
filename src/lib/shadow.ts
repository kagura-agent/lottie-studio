export const VALID_SHADOW_TYPES = ["drop", "inner", "glow"] as const;
export type ShadowType = (typeof VALID_SHADOW_TYPES)[number];

export interface ShadowCommandOptions {
  type?: ShadowType;
  color?: string;
  opacity?: number;
  blur?: number;
  distance?: number;
  angle?: number;
  layer?: string;
  spread?: number;
  animated?: boolean;
}

interface ShadowStyleProperty {
  a: number;
  k: number | number[] | unknown[];
}

export interface ShadowStyle {
  ty: number;
  c: ShadowStyleProperty;
  o: ShadowStyleProperty;
  a: ShadowStyleProperty;
  s: ShadowStyleProperty;
  d: ShadowStyleProperty;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const DEFAULTS: Record<ShadowType, { color: string; opacity: number; blur: number; distance: number; angle: number }> = {
  drop: { color: "#000000", opacity: 60, blur: 8, distance: 5, angle: 135 },
  inner: { color: "#000000", opacity: 50, blur: 8, distance: 5, angle: 135 },
  glow: { color: "#ffffff", opacity: 75, blur: 12, distance: 0, angle: 135 },
};

function makeEaseOutKeyframes(startFrame: number, endFrame: number, targetValue: number): unknown[] {
  return [
    {
      t: startFrame,
      s: [0],
      o: { x: [0], y: [0] },
      i: { x: [0.25], y: [1] },
    },
    {
      t: endFrame,
      s: [targetValue],
    },
  ];
}

export function createShadowStyle(options: ShadowCommandOptions, startFrame?: number): ShadowStyle {
  const type = options.type ?? "drop";
  const defaults = DEFAULTS[type];
  const color = options.color ?? defaults.color;
  const opacity = options.opacity ?? defaults.opacity;
  const blur = options.blur ?? defaults.blur;
  const distance = options.distance ?? defaults.distance;
  const angle = options.angle ?? defaults.angle;

  const [r, g, b] = hexToRgb(color);
  const ty = type === "inner" ? 2 : 1;

  const animated = options.animated ?? false;
  const blurProp: ShadowStyleProperty = animated && startFrame !== undefined
    ? { a: 1, k: makeEaseOutKeyframes(startFrame, startFrame + 15, blur) }
    : { a: 0, k: blur };

  return {
    ty,
    c: { a: 0, k: [r, g, b, 1] },
    o: { a: 0, k: opacity },
    a: { a: 0, k: angle },
    s: blurProp,
    d: { a: 0, k: distance },
  };
}

export interface LottieLayerWithStyles {
  nm?: string;
  sy?: ShadowStyle[];
  ip?: number;
  [key: string]: unknown;
}

export function applyShadowToLayers(
  layers: LottieLayerWithStyles[],
  options: ShadowCommandOptions
): string[] {
  const modifiedLayers: string[] = [];

  for (const layer of layers) {
    if (options.layer && layer.nm !== options.layer) continue;

    const startFrame = layer.ip ?? 0;
    const style = createShadowStyle(options, startFrame);

    if (!layer.sy) {
      layer.sy = [];
    }
    layer.sy.push(style);

    const name = layer.nm || "unnamed";
    if (!modifiedLayers.includes(name)) {
      modifiedLayers.push(name);
    }
  }

  return modifiedLayers;
}
