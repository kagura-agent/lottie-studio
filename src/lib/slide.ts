export const VALID_SLIDE_DIRECTIONS = ["left", "right", "up", "down"] as const;
export type SlideDirection = (typeof VALID_SLIDE_DIRECTIONS)[number];

export interface SlideOptions {
  direction: SlideDirection;
  out?: boolean;
  layer?: string;
  duration?: number;
  easing?: string;
  stagger?: number;
  distance?: number;
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
  spring: { o: { x: [0.43], y: [0.33] }, i: { x: [0.23], y: [1] } },
  sharp: { o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } },
};

function getCurrentPosition(layer: Record<string, unknown>): [number, number] {
  const ks = layer.ks as Record<string, unknown> | undefined;
  if (!ks) return [0, 0];
  const p = ks.p as Record<string, unknown> | undefined;
  if (!p) return [0, 0];

  const animated = p.a as number;
  const k = p.k as number[] | Array<Record<string, unknown>>;

  if (animated === 1 && Array.isArray(k) && k.length > 0) {
    const last = k[k.length - 1] as Record<string, unknown>;
    const s = (last.s ?? last.e) as number[] | undefined;
    if (s) return [s[0], s[1]];
    if (typeof (k[k.length - 1] as Record<string, unknown>).s === "undefined") {
      const prev = k[k.length - 2] as Record<string, unknown> | undefined;
      if (prev) {
        const ps = (prev.e ?? prev.s) as number[] | undefined;
        if (ps) return [ps[0], ps[1]];
      }
    }
    return [0, 0];
  }

  if (Array.isArray(k) && typeof k[0] === "number") {
    return [k[0] as number, k[1] as number];
  }

  return [0, 0];
}

function getOffscreenPosition(
  direction: SlideDirection,
  currentX: number,
  currentY: number,
  canvasW: number,
  canvasH: number,
  distance?: number
): [number, number] {
  switch (direction) {
    case "left":
      return [-(distance ?? canvasW), currentY];
    case "right":
      return [canvasW + (distance ?? canvasW), currentY];
    case "up":
      return [currentX, -(distance ?? canvasH)];
    case "down":
      return [currentX, canvasH + (distance ?? canvasH)];
  }
}

export function applySlide(
  lottieJson: Record<string, unknown>,
  options: SlideOptions
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(lottieJson));
  const fr = (result.fr as number) || 30;
  const ip = (result.ip as number) || 0;
  const op = (result.op as number) || 60;
  const canvasW = (result.w as number) || 512;
  const canvasH = (result.h as number) || 512;
  const duration = options.duration ?? 1;
  const defaultEasing = options.out ? "ease-in" : "ease-out";
  const easing = options.easing ?? defaultEasing;
  const staggerMs = options.stagger ?? 0;

  const durationFrames = Math.round(duration * fr);
  const staggerFrames = Math.round((staggerMs / 1000) * fr);

  const curve = EASING_CURVES[easing] || EASING_CURVES["ease-in-out"];

  const layers = result.layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !Array.isArray(layers) || layers.length === 0) return result;

  let targetLayers: Array<Record<string, unknown>>;
  if (options.layer) {
    targetLayers = layers.filter((l) => l.nm === options.layer);
    if (targetLayers.length === 0) return result;
  } else {
    targetLayers = layers;
  }

  let layerIndex = 0;
  for (const layer of targetLayers) {
    const offset = layerIndex * staggerFrames;
    const layerIp = (layer.ip as number) ?? ip;
    const layerOp = (layer.op as number) ?? op;
    const startFrame = options.from ?? (layerIp + offset);
    const endFrame = options.to ?? Math.min(startFrame + durationFrames, layerOp);

    const [currentX, currentY] = getCurrentPosition(layer);
    const [offX, offY] = getOffscreenPosition(
      options.direction,
      currentX,
      currentY,
      canvasW,
      canvasH,
      options.distance
    );

    let fromPos: [number, number, number];
    let toPos: [number, number, number];

    if (options.out) {
      fromPos = [currentX, currentY, 0];
      toPos = [offX, offY, 0];
    } else {
      fromPos = [offX, offY, 0];
      toPos = [currentX, currentY, 0];
    }

    const keyframes = [
      { t: startFrame, s: fromPos, o: curve.o, i: curve.i },
      { t: endFrame, s: toPos },
    ];

    const ks = layer.ks as Record<string, unknown> | undefined;
    if (!ks) {
      layer.ks = { p: { a: 1, k: keyframes } };
    } else {
      ks.p = { a: 1, k: keyframes };
    }

    layerIndex++;
  }

  return result;
}
