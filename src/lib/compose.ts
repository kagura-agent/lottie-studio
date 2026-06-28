/**
 * Animation layer composition: merge layers from a source animation into a target.
 * Handles layer index conflicts, parent references, frame rate normalization,
 * duration extension, and precomp/asset merging.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieAny = any;

/**
 * Recursively scale all keyframe `t` values in an object by a ratio.
 */
function scaleKeyframes(obj: LottieAny, ratio: number): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      scaleKeyframes(item, ratio);
    }
    return;
  }

  // Animated property with keyframes
  if (obj.a === 1 && Array.isArray(obj.k)) {
    for (const kf of obj.k) {
      if (kf && typeof kf === "object" && typeof kf.t === "number") {
        kf.t = kf.t * ratio;
      }
    }
  }

  // Recurse into all properties
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object") {
      scaleKeyframes(val, ratio);
    }
  }
}

/**
 * Find the maximum layer index (ind) in an array of layers.
 */
function getMaxLayerIndex(layers: LottieAny[]): number {
  let max = 0;
  for (const layer of layers) {
    if (typeof layer.ind === "number" && layer.ind > max) {
      max = layer.ind;
    }
  }
  return max;
}

/**
 * Compose layers from a source animation into a target animation.
 * Returns a new merged animation object (does not mutate inputs).
 */
export function composeLayers(target: object, source: object): object {
  const result: LottieAny = JSON.parse(JSON.stringify(target));
  const src: LottieAny = JSON.parse(JSON.stringify(source));

  // Ensure layers arrays exist
  if (!Array.isArray(result.layers)) {
    result.layers = [];
  }
  if (!Array.isArray(src.layers) || src.layers.length === 0) {
    return result;
  }

  // Calculate the index offset to avoid conflicts
  const targetMaxInd = getMaxLayerIndex(result.layers);
  const indexOffset = targetMaxInd + 1;

  // Frame rate normalization
  const targetFr = result.fr || 30;
  const sourceFr = src.fr || 30;
  const frRatio = targetFr / sourceFr;

  // Process source layers: reassign indices, adjust parents, scale timing
  for (const layer of src.layers) {
    // Reassign layer index
    if (typeof layer.ind === "number") {
      layer.ind = layer.ind + indexOffset;
    }

    // Adjust parent references by the same offset
    if (typeof layer.parent === "number") {
      layer.parent = layer.parent + indexOffset;
    }

    // If frame rates differ, rescale timing
    if (frRatio !== 1) {
      if (typeof layer.ip === "number") {
        layer.ip = layer.ip * frRatio;
      }
      if (typeof layer.op === "number") {
        layer.op = layer.op * frRatio;
      }

      // Scale keyframes in transform
      if (layer.ks) {
        scaleKeyframes(layer.ks, frRatio);
      }

      // Scale shape keyframes
      if (Array.isArray(layer.shapes)) {
        scaleKeyframes(layer.shapes, frRatio);
      }

      // Scale effect keyframes
      if (Array.isArray(layer.ef)) {
        scaleKeyframes(layer.ef, frRatio);
      }
    }
  }

  // Extend target duration if source is longer (after frame rate conversion)
  const targetDuration = (result.op || 0) - (result.ip || 0);
  const sourceDuration = ((src.op || 0) - (src.ip || 0)) * frRatio;
  if (sourceDuration > targetDuration) {
    result.op = (result.ip || 0) + sourceDuration;
  }

  // Merge layers
  result.layers = [...result.layers, ...src.layers];

  // Merge assets/precomps
  if (Array.isArray(src.assets) && src.assets.length > 0) {
    if (!Array.isArray(result.assets)) {
      result.assets = [];
    }
    // Avoid duplicate asset IDs
    const existingIds = new Set(result.assets.map((a: LottieAny) => a.id));
    for (const asset of src.assets) {
      if (!existingIds.has(asset.id)) {
        result.assets.push(asset);
        existingIds.add(asset.id);
      }
    }
  }

  return result;
}

export default composeLayers;
