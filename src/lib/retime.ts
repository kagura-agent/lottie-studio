export interface LottieJson {
  op: number;
  fr: number;
  ip?: number;
  layers?: Layer[];
  markers?: Marker[];
  [key: string]: unknown;
}

interface Layer {
  ip: number;
  op: number;
  [key: string]: unknown;
}

interface Marker {
  tm: number;
  [key: string]: unknown;
}

interface Keyframe {
  t: number;
  [key: string]: unknown;
}

function isAnimatedProperty(obj: unknown): obj is { a: 1; k: Keyframe[] } {
  if (typeof obj !== "object" || obj === null) return false;
  const rec = obj as Record<string, unknown>;
  return rec.a === 1 && Array.isArray(rec.k) && rec.k.length > 0 && typeof rec.k[0]?.t === "number";
}

function scaleKeyframes(obj: unknown, ratio: number): void {
  if (typeof obj !== "object" || obj === null) return;

  if (isAnimatedProperty(obj)) {
    for (const kf of (obj as { k: Keyframe[] }).k) {
      kf.t = Math.round(kf.t * ratio);
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) scaleKeyframes(item, ratio);
  } else {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (typeof val === "object" && val !== null) {
        scaleKeyframes(val, ratio);
      }
    }
  }
}

export function retime(lottie: LottieJson, targetDurationMs: number): LottieJson {
  const result = JSON.parse(JSON.stringify(lottie)) as LottieJson;
  const oldFrameCount = result.op;
  const frameRate = result.fr;
  const newFrameCount = Math.round((targetDurationMs / 1000) * frameRate);

  if (oldFrameCount === 0 || newFrameCount === oldFrameCount) return result;

  const ratio = newFrameCount / oldFrameCount;

  result.op = newFrameCount;
  if (result.ip != null) {
    result.ip = Math.round(result.ip * ratio);
  }

  if (result.layers) {
    for (const layer of result.layers) {
      layer.ip = Math.round(layer.ip * ratio);
      layer.op = Math.round(layer.op * ratio);
      scaleKeyframes(layer, ratio);
    }
  }

  if (result.markers) {
    for (const marker of result.markers) {
      marker.tm = Math.round(marker.tm * ratio);
    }
  }

  return result;
}
