/**
 * Rescale a Lottie animation to a target duration.
 * Adjusts op (out-point), layer ip/op, and all keyframe `t` values proportionally.
 * Preserves easing curves (only moves timing, doesn't touch i/o/s/e).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieAny = any;

function scaleKeyframes(obj: LottieAny, ratio: number): void {
  if (!obj || typeof obj !== "object") return;

  // If this is an animated property with keyframes (array of objects with 't')
  if (Array.isArray(obj)) {
    for (const item of obj) {
      scaleKeyframes(item, ratio);
    }
    return;
  }

  // Check if this object has a 'k' that is an array of keyframes (animated property)
  if (obj.a === 1 && Array.isArray(obj.k)) {
    for (const kf of obj.k) {
      if (kf && typeof kf === "object" && typeof kf.t === "number") {
        kf.t = kf.t * ratio;
      }
    }
  }

  // Recurse into all properties
  for (const key of Object.keys(obj)) {
    if (key === "t" && typeof obj[key] === "number" && obj.s !== undefined && obj.e !== undefined) {
      // This looks like a keyframe object itself — skip, handled above
      continue;
    }
    const val = obj[key];
    if (val && typeof val === "object") {
      scaleKeyframes(val, ratio);
    }
  }
}

function scaleLayer(layer: LottieAny, ratio: number): void {
  if (typeof layer.ip === "number") {
    layer.ip = layer.ip * ratio;
  }
  if (typeof layer.op === "number") {
    layer.op = layer.op * ratio;
  }

  // Scale transform keyframes (ks)
  if (layer.ks) {
    scaleKeyframes(layer.ks, ratio);
  }

  // Scale shape keyframes
  if (Array.isArray(layer.shapes)) {
    scaleKeyframes(layer.shapes, ratio);
  }

  // Scale effect keyframes
  if (Array.isArray(layer.ef)) {
    scaleKeyframes(layer.ef, ratio);
  }
}

export function rescaleDuration(lottie: LottieAny, targetMs: number): LottieAny {
  const cloned = JSON.parse(JSON.stringify(lottie));

  const fr = cloned.fr || 30;
  const originalOp = cloned.op || 0;

  if (originalOp === 0) return cloned;

  const newOp = (targetMs / 1000) * fr;
  const ratio = newOp / originalOp;

  cloned.op = newOp;

  // Scale ip if present (usually 0)
  if (typeof cloned.ip === "number") {
    cloned.ip = cloned.ip * ratio;
  }

  // Scale all layers
  if (Array.isArray(cloned.layers)) {
    for (const layer of cloned.layers) {
      scaleLayer(layer, ratio);
    }
  }

  return cloned;
}

export default rescaleDuration;
