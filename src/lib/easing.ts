export const EASING_PRESETS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "bounce",
  "elastic",
  "spring",
  "sharp",
] as const;

export type EasingPreset = (typeof EASING_PRESETS)[number];

interface BezierHandle {
  x: number;
  y: number;
}

interface EasingValue {
  o: BezierHandle;
  i: BezierHandle;
}

const EASING_VALUES: Record<EasingPreset, EasingValue> = {
  linear: { o: { x: 0, y: 0 }, i: { x: 1, y: 1 } },
  "ease-in": { o: { x: 0.42, y: 0 }, i: { x: 1, y: 1 } },
  "ease-out": { o: { x: 0, y: 0 }, i: { x: 0.58, y: 1 } },
  "ease-in-out": { o: { x: 0.42, y: 0 }, i: { x: 0.58, y: 1 } },
  bounce: { o: { x: 0.34, y: 1.56 }, i: { x: 0.64, y: 1 } },
  elastic: { o: { x: 0.68, y: -0.55 }, i: { x: 0.27, y: 1.55 } },
  spring: { o: { x: 0.43, y: 0.33 }, i: { x: 0.23, y: 1 } },
  sharp: { o: { x: 0.4, y: 0 }, i: { x: 0.6, y: 1 } },
};

function applyHandleToKeyframe(kf: Record<string, unknown>, preset: EasingPreset): boolean {
  if (!kf || typeof kf !== "object") return false;
  if (!("t" in kf)) return false;

  const easing = EASING_VALUES[preset];

  const isMultiDimensional = (val: unknown): boolean =>
    typeof val === "object" && val !== null && Array.isArray((val as Record<string, unknown>).x);

  const currentO = kf.o as Record<string, unknown> | undefined;
  const currentI = kf.i as Record<string, unknown> | undefined;

  if (!currentO && !currentI) return false;

  if (currentO && isMultiDimensional(currentO)) {
    const dims = (currentO.x as number[]).length;
    kf.o = { x: Array(dims).fill(easing.o.x), y: Array(dims).fill(easing.o.y) };
    kf.i = { x: Array(dims).fill(easing.i.x), y: Array(dims).fill(easing.i.y) };
  } else if (currentO) {
    kf.o = { x: easing.o.x, y: easing.o.y };
    kf.i = { x: easing.i.x, y: easing.i.y };
  }

  return true;
}

function walkAnimatedProperties(obj: unknown, preset: EasingPreset): number {
  let count = 0;
  if (!obj || typeof obj !== "object") return 0;

  const record = obj as Record<string, unknown>;

  if (record.a === 1 && Array.isArray(record.k)) {
    for (const kf of record.k) {
      if (kf && typeof kf === "object" && "t" in (kf as Record<string, unknown>)) {
        if (applyHandleToKeyframe(kf as Record<string, unknown>, preset)) {
          count++;
        }
      }
    }
    return count;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        count += walkAnimatedProperties(item, preset);
      }
    } else if (value && typeof value === "object") {
      count += walkAnimatedProperties(value, preset);
    }
  }

  return count;
}

export function applyEasing(animation: unknown, preset: EasingPreset): { result: unknown; keyframeCount: number } {
  const copy = JSON.parse(JSON.stringify(animation));
  const keyframeCount = walkAnimatedProperties(copy, preset);
  return { result: copy, keyframeCount };
}
