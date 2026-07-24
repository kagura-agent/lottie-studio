export const VALID_FADE_MODES = ["in", "out", "in-out", "pulse"] as const;
export type FadeMode = (typeof VALID_FADE_MODES)[number];

export interface FadeOptions {
  mode: FadeMode;
  duration?: number;
  easing?: string;
  layer?: string;
  stagger?: number;
  from?: number;
  to?: number;
  delay?: number;
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

function buildOpacityKeyframes(
  startFrame: number,
  endFrame: number,
  fromVal: number,
  toVal: number,
  curve: EasingCurve
): unknown[] {
  return [
    { t: startFrame, s: [fromVal], o: curve.o, i: curve.i },
    { t: endFrame, s: [toVal] },
  ];
}

function buildFadeInOutKeyframes(
  startFrame: number,
  endFrame: number,
  fromVal: number,
  toVal: number,
  curve: EasingCurve
): unknown[] {
  const midFrame = Math.round((startFrame + endFrame) / 2);
  return [
    { t: startFrame, s: [fromVal], o: curve.o, i: curve.i },
    { t: midFrame, s: [toVal], o: curve.o, i: curve.i },
    { t: endFrame, s: [fromVal] },
  ];
}

function buildPulseKeyframes(
  startFrame: number,
  endFrame: number,
  fromVal: number,
  toVal: number,
  curve: EasingCurve
): unknown[] {
  const totalFrames = endFrame - startFrame;
  const cycleFrames = Math.max(Math.round(totalFrames / 2), 2);
  const kfs: unknown[] = [];
  let frame = startFrame;
  let toggle = true;
  while (frame < endFrame) {
    const val = toggle ? fromVal : toVal;
    if (frame + cycleFrames < endFrame) {
      kfs.push({ t: frame, s: [val], o: curve.o, i: curve.i });
    } else {
      kfs.push({ t: frame, s: [val] });
    }
    frame += cycleFrames;
    toggle = !toggle;
  }
  if (kfs.length < 2) {
    return [
      { t: startFrame, s: [fromVal], o: curve.o, i: curve.i },
      { t: endFrame, s: [toVal] },
    ];
  }
  return kfs;
}

function setOpacityProperty(
  layer: Record<string, unknown>,
  keyframes: unknown[]
): void {
  const ks = layer.ks as Record<string, unknown> | undefined;
  if (!ks) {
    layer.ks = { o: { a: 1, k: keyframes } };
    return;
  }
  ks.o = { a: 1, k: keyframes };
}

export function applyFade(
  lottieJson: Record<string, unknown>,
  options: FadeOptions
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(lottieJson));
  const fr = (result.fr as number) || 30;
  const ip = (result.ip as number) || 0;
  const op = (result.op as number) || 60;
  const duration = options.duration ?? 1;
  const easing = options.easing ?? "ease-in-out";
  const staggerMs = options.stagger ?? 0;
  const delaySeconds = options.delay ?? 0;
  const mode = options.mode;

  const durationFrames = Math.round(duration * fr);
  const staggerFrames = Math.round((staggerMs / 1000) * fr);
  const delayFrames = Math.round(delaySeconds * fr);

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

  let fromVal: number;
  let toVal: number;
  switch (mode) {
    case "in":
      fromVal = options.from ?? 0;
      toVal = options.to ?? 100;
      break;
    case "out":
      fromVal = options.from ?? 100;
      toVal = options.to ?? 0;
      break;
    case "in-out":
      fromVal = options.from ?? 0;
      toVal = options.to ?? 100;
      break;
    case "pulse":
      fromVal = options.from ?? 30;
      toVal = options.to ?? 100;
      break;
  }

  let layerIndex = 0;
  for (const layer of targetLayers) {
    const offset = layerIndex * staggerFrames;
    const layerIp = (layer.ip as number) ?? ip;
    const layerOp = (layer.op as number) ?? op;
    const startFrame = layerIp + delayFrames + offset;
    const endFrame = Math.min(startFrame + durationFrames, layerOp);

    let keyframes: unknown[];
    switch (mode) {
      case "in":
        keyframes = buildOpacityKeyframes(startFrame, endFrame, fromVal, toVal, curve);
        break;
      case "out":
        keyframes = buildOpacityKeyframes(startFrame, endFrame, fromVal, toVal, curve);
        break;
      case "in-out":
        keyframes = buildFadeInOutKeyframes(startFrame, endFrame, fromVal, toVal, curve);
        break;
      case "pulse":
        keyframes = buildPulseKeyframes(startFrame, endFrame, fromVal, toVal, curve);
        break;
    }

    setOpacityProperty(layer, keyframes);
    layerIndex++;
  }

  return result;
}
