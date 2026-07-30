export const VALID_GRADIENT_TYPES = ["linear", "radial"] as const;
export type GradientType = (typeof VALID_GRADIENT_TYPES)[number];

export const VALID_GRADIENT_PRESETS = ["shimmer", "sunset", "rainbow", "aurora", "pulse"] as const;
export type GradientPreset = (typeof VALID_GRADIENT_PRESETS)[number];

export const VALID_GRADIENT_MODES = ["fill", "stroke"] as const;
export type GradientMode = (typeof VALID_GRADIENT_MODES)[number];

export interface GradientCommandOptions {
  type?: GradientType;
  preset?: GradientPreset;
  colors?: string[];
  duration?: number;
  angle?: number;
  layer?: string;
  mode?: GradientMode;
  speed?: number;
  from?: string;
  to?: string;
}

interface AnimatedProperty {
  a: number;
  k: unknown;
}

interface GradientShape {
  ty: string;
  o: AnimatedProperty;
  s: AnimatedProperty;
  e: AnimatedProperty;
  t: number;
  g: { p: number; k: AnimatedProperty };
  w?: AnimatedProperty;
  nm: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const PRESET_COLORS: Record<GradientPreset, string[]> = {
  shimmer: ["#ffffff", "#c0c0c0", "#ffffff"],
  sunset: ["#ff6b35", "#f7c59f", "#ff1654"],
  rainbow: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"],
  aurora: ["#00ff87", "#60efff", "#0061ff", "#a855f7"],
  pulse: ["#ff0080", "#7928ca", "#ff0080"],
};

function buildColorStops(colors: string[]): number[] {
  const stops: number[] = [];
  for (let i = 0; i < colors.length; i++) {
    const offset = colors.length === 1 ? 0 : i / (colors.length - 1);
    const [r, g, b] = hexToRgb(colors[i]);
    stops.push(offset, r, g, b);
  }
  return stops;
}

function buildAnimatedColorStops(colors: string[], totalFrames: number, speed: number): unknown[] {
  const numStops = colors.length;
  const shiftFrames = Math.round(totalFrames / speed);

  const keyframes: unknown[] = [];
  const steps = Math.max(2, Math.ceil(speed) + 1);

  for (let step = 0; step < steps; step++) {
    const t = Math.round((step / (steps - 1)) * shiftFrames);
    const shiftedStops: number[] = [];
    const shift = step / (steps - 1);

    for (let i = 0; i < numStops; i++) {
      const srcIdx = (i + Math.floor(shift * numStops)) % numStops;
      const offset = numStops === 1 ? 0 : i / (numStops - 1);
      const [r, g, b] = hexToRgb(colors[srcIdx]);
      shiftedStops.push(offset, r, g, b);
    }

    if (step < steps - 1) {
      keyframes.push({
        t,
        s: shiftedStops,
        o: { x: [0], y: [0] },
        i: { x: [0.25], y: [1] },
      });
    } else {
      keyframes.push({ t, s: shiftedStops });
    }
  }

  return keyframes;
}

function angleToPoints(angle: number): { start: [number, number]; end: [number, number] } {
  const rad = (angle * Math.PI) / 180;
  const cx = 256, cy = 256, len = 256;
  return {
    start: [cx - Math.cos(rad) * len, cy - Math.sin(rad) * len],
    end: [cx + Math.cos(rad) * len, cy + Math.sin(rad) * len],
  };
}

function buildAnimatedPoints(totalFrames: number, speed: number): { s: AnimatedProperty; e: AnimatedProperty } {
  const shiftFrames = Math.round(totalFrames / speed);
  const makeKf = (startAngle: number): unknown[] => {
    const p1 = angleToPoints(startAngle);
    const p2 = angleToPoints(startAngle + 360);
    return [
      { t: 0, s: p1.start, o: { x: [0], y: [0] }, i: { x: [0.25], y: [1] } },
      { t: shiftFrames, s: p2.start },
    ];
  };
  const makeKfEnd = (startAngle: number): unknown[] => {
    const p1 = angleToPoints(startAngle);
    const p2 = angleToPoints(startAngle + 360);
    return [
      { t: 0, s: p1.end, o: { x: [0], y: [0] }, i: { x: [0.25], y: [1] } },
      { t: shiftFrames, s: p2.end },
    ];
  };
  return {
    s: { a: 1, k: makeKf(0) },
    e: { a: 1, k: makeKfEnd(0) },
  };
}

export function createGradientShape(options: GradientCommandOptions, totalFrames: number): GradientShape {
  const gradType = options.type ?? "linear";
  const mode = options.mode ?? "fill";
  const speed = options.speed ?? 1;
  const angle = options.angle ?? 0;
  const colors = options.colors ?? PRESET_COLORS[options.preset ?? "shimmer"];
  const numStops = colors.length;

  const isAnimated = speed > 0;
  const colorStopsProp: AnimatedProperty = isAnimated
    ? { a: 1, k: buildAnimatedColorStops(colors, totalFrames, speed) }
    : { a: 0, k: buildColorStops(colors) };

  let startPt: AnimatedProperty;
  let endPt: AnimatedProperty;

  if (gradType === "linear" && isAnimated && !options.preset) {
    const pts = buildAnimatedPoints(totalFrames, speed);
    startPt = pts.s;
    endPt = pts.e;
  } else {
    const pts = angleToPoints(angle);
    startPt = { a: 0, k: pts.start };
    endPt = { a: 0, k: pts.end };
  }

  if (gradType === "radial") {
    startPt = { a: 0, k: [256, 256] };
    endPt = { a: 0, k: [512, 256] };
  }

  const shape: GradientShape = {
    ty: mode === "fill" ? "gf" : "gs",
    o: { a: 0, k: 100 },
    s: startPt,
    e: endPt,
    t: gradType === "linear" ? 1 : 2,
    g: { p: numStops, k: colorStopsProp },
    nm: `Gradient ${mode === "fill" ? "Fill" : "Stroke"}`,
  };

  if (mode === "stroke") {
    shape.w = { a: 0, k: 4 };
  }

  return shape;
}

export interface LottieLayer {
  nm?: string;
  ty?: number;
  ip?: number;
  op?: number;
  shapes?: unknown[];
  [key: string]: unknown;
}

export function applyGradientToLayer(
  layers: LottieLayer[],
  options: GradientCommandOptions,
  totalFrames: number
): string[] {
  const modifiedLayers: string[] = [];

  for (const layer of layers) {
    if (options.layer && layer.nm !== options.layer) continue;
    if (layer.ty !== 4) continue;

    const gradShape = createGradientShape(options, totalFrames);

    if (!layer.shapes) {
      layer.shapes = [];
    }
    layer.shapes.unshift(gradShape);

    const name = layer.nm || "unnamed";
    if (!modifiedLayers.includes(name)) {
      modifiedLayers.push(name);
    }
  }

  return modifiedLayers;
}

export function generateGradientAnimation(options: GradientCommandOptions): Record<string, unknown> {
  const duration = options.duration ?? 3;
  const fps = 30;
  const totalFrames = Math.round(duration * fps);

  const gradShape = createGradientShape(options, totalFrames);

  return {
    v: "5.7.1",
    fr: fps,
    ip: 0,
    op: totalFrames,
    w: 512,
    h: 512,
    nm: "Gradient Animation",
    layers: [
      {
        ty: 4,
        nm: "Gradient Layer",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [256, 256] },
          a: { a: 0, k: [256, 256] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
        },
        ip: 0,
        op: totalFrames,
        shapes: [
          {
            ty: "rc",
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [512, 512] },
            r: { a: 0, k: 0 },
            nm: "Rectangle",
          },
          gradShape,
        ],
      },
    ],
  };
}
