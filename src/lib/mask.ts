export const VALID_MASK_TYPES = [
  "reveal",
  "wipe-right",
  "wipe-left",
  "wipe-down",
  "wipe-up",
  "circle",
  "circle-out",
  "iris",
  "star",
  "invert",
] as const;

export type MaskType = (typeof VALID_MASK_TYPES)[number];

export interface MaskCommandOptions {
  type?: MaskType;
  layer?: string;
  duration?: number;
  easing?: string;
  from?: number;
  to?: number;
  expand?: number;
  invert?: boolean;
}

interface PathValue {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
}

interface AnimatedPathKeyframe {
  t: number;
  s: PathValue[];
  e: PathValue[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

export interface MaskProperty {
  inv: boolean;
  mode: string;
  pt: { a: number; k: PathValue | AnimatedPathKeyframe[] };
  o: { a: number; k: number };
  x: { a: number; k: number };
}

function makeRectPath(x: number, y: number, w: number, h: number): PathValue {
  return {
    v: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    i: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    o: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    c: true,
  };
}

function makeCirclePath(cx: number, cy: number, r: number): PathValue {
  // Approximate circle with 4 bezier curves (kappa = 0.5522847498)
  const k = r * 0.5522847498;
  return {
    v: [
      [cx, cy - r],
      [cx + r, cy],
      [cx, cy + r],
      [cx - r, cy],
    ],
    i: [
      [-k, 0],
      [0, -k],
      [k, 0],
      [0, k],
    ],
    o: [
      [k, 0],
      [0, k],
      [-k, 0],
      [0, -k],
    ],
    c: true,
  };
}

function makeStarPath(cx: number, cy: number, outerR: number, points: number = 5): PathValue {
  const innerR = outerR * 0.4;
  const vertices: number[][] = [];
  const totalPoints = points * 2;

  for (let i = 0; i < totalPoints; i++) {
    const angle = (Math.PI * 2 * i) / totalPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    vertices.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  return {
    v: vertices,
    i: vertices.map(() => [0, 0]),
    o: vertices.map(() => [0, 0]),
    c: true,
  };
}

function makeIrisPath(cx: number, cy: number, r: number, points: number = 6): PathValue {
  const vertices: number[][] = [];
  const k = r * 0.5522847498;
  const tangentScale = k / r;

  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
    vertices.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  const inTangents: number[][] = [];
  const outTangents: number[][] = [];

  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
    const tx = -Math.sin(angle) * r * tangentScale;
    const ty = Math.cos(angle) * r * tangentScale;
    inTangents.push([-tx, -ty]);
    outTangents.push([tx, ty]);
  }

  return {
    v: vertices,
    i: inTangents,
    o: outTangents,
    c: true,
  };
}

function getEasingCurves(easing?: string): { i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } } {
  switch (easing) {
    case "ease-in":
      return { i: { x: [0.42], y: [0] }, o: { x: [1], y: [1] } };
    case "ease-out":
      return { i: { x: [0], y: [0] }, o: { x: [0.58], y: [1] } };
    case "ease-in-out":
      return { i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } };
    case "linear":
    default:
      return { i: { x: [0.33], y: [0] }, o: { x: [0.67], y: [1] } };
  }
}

function generateMaskPaths(
  type: MaskType,
  width: number,
  height: number
): { start: PathValue; end: PathValue } {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  switch (type) {
    case "reveal":
    case "wipe-right":
      return {
        start: makeRectPath(0, 0, 0, height),
        end: makeRectPath(0, 0, width, height),
      };

    case "wipe-left":
      return {
        start: makeRectPath(width, 0, 0, height),
        end: makeRectPath(0, 0, width, height),
      };

    case "wipe-down":
      return {
        start: makeRectPath(0, 0, width, 0),
        end: makeRectPath(0, 0, width, height),
      };

    case "wipe-up":
      return {
        start: makeRectPath(0, height, width, 0),
        end: makeRectPath(0, 0, width, height),
      };

    case "circle":
      return {
        start: makeCirclePath(cx, cy, 0),
        end: makeCirclePath(cx, cy, maxR),
      };

    case "circle-out":
      return {
        start: makeCirclePath(cx, cy, maxR),
        end: makeCirclePath(cx, cy, 0),
      };

    case "iris":
      return {
        start: makeIrisPath(cx, cy, 0),
        end: makeIrisPath(cx, cy, maxR),
      };

    case "star":
      return {
        start: makeStarPath(cx, cy, 0),
        end: makeStarPath(cx, cy, maxR),
      };

    case "invert":
      return {
        start: makeRectPath(0, 0, width, height),
        end: makeRectPath(0, 0, 0, 0),
      };

    default:
      return {
        start: makeRectPath(0, 0, 0, height),
        end: makeRectPath(0, 0, width, height),
      };
  }
}

export function createMaskProperty(
  type: MaskType,
  width: number,
  height: number,
  startFrame: number,
  endFrame: number,
  options: MaskCommandOptions = {}
): MaskProperty {
  const { start, end } = generateMaskPaths(type, width, height);
  const easing = getEasingCurves(options.easing);

  const animatedPath: AnimatedPathKeyframe[] = [
    {
      t: startFrame,
      s: [start],
      e: [end],
      i: easing.i,
      o: easing.o,
    },
    {
      t: endFrame,
      s: [end],
      e: [end],
    },
  ];

  return {
    inv: options.invert ?? false,
    mode: "a", // "a" = Add mode
    pt: { a: 1, k: animatedPath },
    o: { a: 0, k: 100 },
    x: { a: 0, k: options.expand ?? 0 },
  };
}

export interface LottieLayerWithMask {
  nm?: string;
  ip?: number;
  op?: number;
  masksProperties?: MaskProperty[];
  [key: string]: unknown;
}

export interface LottieAnimationWithMask {
  w: number;
  h: number;
  fr: number;
  ip: number;
  op: number;
  layers: LottieLayerWithMask[];
  [key: string]: unknown;
}

export function applyMaskToLayers(
  animation: LottieAnimationWithMask,
  options: MaskCommandOptions
): string[] {
  const modifiedLayers: string[] = [];
  const type = options.type ?? "reveal";
  const width = animation.w ?? 512;
  const height = animation.h ?? 512;
  const fr = animation.fr ?? 30;
  const durationFrames = options.duration != null
    ? Math.round(options.duration * fr)
    : fr; // default 1 second

  for (const layer of animation.layers) {
    if (options.layer && layer.nm !== options.layer) continue;

    const startFrame = options.from ?? (layer.ip ?? 0);
    const endFrame = options.to ?? (startFrame + durationFrames);

    const mask = createMaskProperty(type, width, height, startFrame, endFrame, options);

    if (!layer.masksProperties) {
      layer.masksProperties = [];
    }
    layer.masksProperties.push(mask);

    const name = layer.nm || "unnamed";
    if (!modifiedLayers.includes(name)) {
      modifiedLayers.push(name);
    }
  }

  return modifiedLayers;
}
