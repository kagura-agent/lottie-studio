/**
 * Animation sequence composition: append source animation after target temporally.
 * Unlike compose (which overlays layers), sequence places them end-to-end.
 */

import { getMaxLayerIndex, scaleKeyframes } from "./compose";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieAny = any;

/**
 * Recursively add an offset to all keyframe `t` values in an object.
 */
export function offsetKeyframes(obj: LottieAny, offset: number): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      offsetKeyframes(item, offset);
    }
    return;
  }

  // Animated property with keyframes
  if (obj.a === 1 && Array.isArray(obj.k)) {
    for (const kf of obj.k) {
      if (kf && typeof kf === "object" && typeof kf.t === "number") {
        kf.t = kf.t + offset;
      }
    }
  }

  // Recurse into all properties
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object") {
      offsetKeyframes(val, offset);
    }
  }
}

/**
 * Sequence layers from a source animation after a target animation.
 * Returns a new animation with source appended temporally after target.
 * Does not mutate inputs.
 */
export function sequenceLayers(target: object, source: object): object {
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

  // Time offset: target's duration in target frames
  const timeOffset = (result.op || 0) - (result.ip || 0);

  // Process source layers
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

    // Add time offset to ip and op (place after target)
    if (typeof layer.ip === "number") {
      layer.ip = layer.ip + timeOffset;
    }
    if (typeof layer.op === "number") {
      layer.op = layer.op + timeOffset;
    }

    // Offset keyframes in transform, shapes, effects
    if (layer.ks) {
      offsetKeyframes(layer.ks, timeOffset);
    }
    if (Array.isArray(layer.shapes)) {
      offsetKeyframes(layer.shapes, timeOffset);
    }
    if (Array.isArray(layer.ef)) {
      offsetKeyframes(layer.ef, timeOffset);
    }
  }

  // Extend target.op by the source's converted duration
  const sourceDuration = ((src.op || 0) - (src.ip || 0)) * frRatio;
  result.op = (result.op || 0) + sourceDuration;

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

export default sequenceLayers;
