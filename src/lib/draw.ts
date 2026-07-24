export interface DrawOptions {
  duration?: number;
  easing?: string;
  reverse?: boolean;
  stagger?: number;
  from?: number;
  to?: number;
}

interface BezierHandle {
  x: number[];
  y: number[];
}

interface EasingCurve {
  o: BezierHandle;
  i: BezierHandle;
}

const EASING_CURVES: Record<string, EasingCurve> = {
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
  "ease-in": { o: { x: [0.42], y: [0] }, i: { x: [1], y: [1] } },
  "ease-out": { o: { x: [0], y: [0] }, i: { x: [0.58], y: [1] } },
  "ease-in-out": { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
  bounce: { o: { x: [0.34], y: [1.56] }, i: { x: [0.64], y: [1] } },
  elastic: { o: { x: [0.68], y: [-0.55] }, i: { x: [0.27], y: [1.55] } },
};

export function drawAnimation(
  anim: Record<string, unknown>,
  options: DrawOptions = {}
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(anim));
  const fr = (result.fr as number) || 30;
  const duration = options.duration ?? 1;
  const easing = options.easing ?? "ease-out";
  const reverse = options.reverse ?? false;
  const staggerMs = options.stagger ?? 0;
  const from = options.from ?? 0;
  const to = options.to ?? 100;

  const durationFrames = Math.round(duration * fr);
  const staggerFrames = Math.round((staggerMs / 1000) * fr);

  const layers = result.layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !Array.isArray(layers)) return result;

  const shapeLayers = layers.filter((l) => l.ty === 4);
  if (shapeLayers.length === 0) return result;

  const qualifyingLayers = shapeLayers.filter((layer) => hasStrokeContent(layer));
  if (qualifyingLayers.length === 0) return result;

  const curve = EASING_CURVES[easing] || EASING_CURVES["ease-out"];

  let layerIndex = 0;
  for (const layer of qualifyingLayers) {
    const offset = layerIndex * staggerFrames;
    const startFrame = (layer.ip as number) || 0;
    const kfStart = startFrame + offset;
    const kfEnd = kfStart + durationFrames;

    const trimPath = createTrimPath(from, to, kfStart, kfEnd, reverse, curve);
    addTrimPathToLayer(layer, trimPath);

    if (staggerFrames > 0 && offset > 0) {
      layer.ip = startFrame + offset;
    }

    layerIndex++;
  }

  return result;
}

function hasStrokeContent(layer: Record<string, unknown>): boolean {
  const shapes = layer.shapes as Array<Record<string, unknown>> | undefined;
  if (!shapes) return false;
  return shapes.some((s) => s.ty === "st" || s.ty === "gs" || hasStrokeInGroup(s));
}

function hasStrokeInGroup(shape: Record<string, unknown>): boolean {
  if (shape.ty === "st" || shape.ty === "gs") return true;
  const it = shape.it as Array<Record<string, unknown>> | undefined;
  if (!it) return false;
  return it.some((s) => s.ty === "st" || s.ty === "gs" || hasStrokeInGroup(s));
}

function createTrimPath(
  from: number,
  to: number,
  startFrame: number,
  endFrame: number,
  reverse: boolean,
  curve: EasingCurve
): Record<string, unknown> {
  if (reverse) {
    return {
      ty: "tm",
      s: {
        a: 1,
        k: [
          { t: startFrame, s: [from], o: curve.o, i: curve.i },
          { t: endFrame, s: [to] },
        ],
      },
      e: { a: 0, k: to },
      o: { a: 0, k: 0 },
      m: 1,
    };
  }

  return {
    ty: "tm",
    s: { a: 0, k: from },
    e: {
      a: 1,
      k: [
        { t: startFrame, s: [from], o: curve.o, i: curve.i },
        { t: endFrame, s: [to] },
      ],
    },
    o: { a: 0, k: 0 },
    m: 1,
  };
}

function addTrimPathToLayer(
  layer: Record<string, unknown>,
  trimPath: Record<string, unknown>
): void {
  const shapes = layer.shapes as Array<Record<string, unknown>>;
  if (!shapes) return;

  const existingIdx = shapes.findIndex((s) => s.ty === "tm");
  if (existingIdx >= 0) {
    shapes[existingIdx] = trimPath;
  } else {
    shapes.push(trimPath);
  }
}
