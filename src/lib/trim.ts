import type { LottieJson } from "./retime";
import type { TrimPoint } from "./commands";

interface Keyframe {
  t: number;
  [key: string]: unknown;
}

function isAnimatedProperty(obj: unknown): obj is { a: 1; k: Keyframe[] } {
  if (typeof obj !== "object" || obj === null) return false;
  const rec = obj as Record<string, unknown>;
  return rec.a === 1 && Array.isArray(rec.k) && rec.k.length > 0 && typeof rec.k[0]?.t === "number";
}

function offsetKeyframes(obj: unknown, offset: number): void {
  if (typeof obj !== "object" || obj === null) return;

  if (isAnimatedProperty(obj)) {
    const kfs = (obj as { k: Keyframe[] }).k;
    for (const kf of kfs) {
      kf.t = Math.round(kf.t - offset);
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) offsetKeyframes(item, offset);
  } else {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (typeof val === "object" && val !== null) {
        offsetKeyframes(val, offset);
      }
    }
  }
}

function trimKeyframes(obj: unknown, startFrame: number, endFrame: number): void {
  if (typeof obj !== "object" || obj === null) return;

  if (isAnimatedProperty(obj)) {
    const prop = obj as { a: 1; k: Keyframe[] };
    const kfs = prop.k;
    // Keep keyframes within range, plus boundary ones for interpolation
    const filtered: Keyframe[] = [];
    for (let i = 0; i < kfs.length; i++) {
      const t = kfs[i].t;
      if (t >= startFrame && t <= endFrame) {
        filtered.push(kfs[i]);
      }
    }
    if (filtered.length > 0) {
      prop.k = filtered;
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) trimKeyframes(item, startFrame, endFrame);
  } else {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (typeof val === "object" && val !== null) {
        trimKeyframes(val, startFrame, endFrame);
      }
    }
  }
}

export function resolveRange(
  range: { start: TrimPoint; end: TrimPoint },
  fr: number,
  op: number
): { startFrame: number; endFrame: number } {
  return {
    startFrame: resolvePoint(range.start, fr, op),
    endFrame: resolvePoint(range.end, fr, op),
  };
}

function resolvePoint(point: TrimPoint, fr: number, op: number): number {
  switch (point.unit) {
    case "frame":
      return point.value;
    case "seconds":
      return Math.round(point.value * fr);
    case "ms":
      return Math.round((point.value / 1000) * fr);
    case "percent":
      return Math.round((point.value / 100) * op);
    case "start":
      return 0;
    case "end":
      return op;
  }
}

export function trimAnimation(lottie: LottieJson, startFrame: number, endFrame: number): LottieJson {
  const result = JSON.parse(JSON.stringify(lottie)) as LottieJson;
  const duration = endFrame - startFrame;

  // Remove layers entirely outside the range
  if (result.layers) {
    result.layers = result.layers.filter((layer) => {
      return layer.op > startFrame && layer.ip < endFrame;
    });

    // Clip layers partially overlapping
    for (const layer of result.layers) {
      if (layer.ip < startFrame) layer.ip = startFrame;
      if (layer.op > endFrame) layer.op = endFrame;

      // Trim and offset keyframes
      trimKeyframes(layer, startFrame, endFrame);
      offsetKeyframes(layer, startFrame);

      // Offset layer ip/op
      layer.ip = layer.ip - startFrame;
      layer.op = layer.op - startFrame;
    }
  }

  result.ip = 0;
  result.op = duration;

  // Offset markers
  if (result.markers) {
    result.markers = result.markers
      .filter((m) => m.tm >= startFrame && m.tm <= endFrame)
      .map((m) => ({ ...m, tm: m.tm - startFrame }));
  }

  return result;
}
