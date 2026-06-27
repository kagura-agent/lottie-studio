/**
 * Rescale a Lottie animation to target dimensions for export.
 * Deep-clones the animation data and modifies w, h, and layer transforms proportionally.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieAny = any;

export type FitMode = "contain" | "cover" | "stretch";

interface RescaleOptions {
  /** Target width in pixels */
  targetWidth: number;
  /** Target height in pixels */
  targetHeight: number;
  /** How to fit the animation into the target dimensions. Default: "contain" */
  fit?: FitMode;
}

interface RescaleResult {
  /** The rescaled animation data */
  animationData: LottieAny;
  /** The scale factor applied */
  scale: number;
  /** X offset applied (for contain/cover centering) */
  offsetX: number;
  /** Y offset applied (for contain/cover centering) */
  offsetY: number;
}

/**
 * Rescale a Lottie animation to fit target dimensions.
 *
 * - "contain": Fit within bounds, maintaining aspect ratio, centered with transparent padding
 * - "cover": Fill bounds, maintaining aspect ratio, cropping overflow (centered)
 * - "stretch": Stretch to exactly fill target dimensions (distorts aspect ratio)
 */
export function rescaleForExport(
  animationData: LottieAny,
  options: RescaleOptions
): RescaleResult {
  const { targetWidth, targetHeight, fit = "contain" } = options;

  const cloned: LottieAny = JSON.parse(JSON.stringify(animationData));

  const sourceWidth = cloned.w || 512;
  const sourceHeight = cloned.h || 512;

  let scaleX: number;
  let scaleY: number;
  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  switch (fit) {
    case "contain": {
      scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
      scaleX = scale;
      scaleY = scale;
      // Center the animation within the target bounds
      offsetX = (targetWidth - sourceWidth * scale) / 2;
      offsetY = (targetHeight - sourceHeight * scale) / 2;
      break;
    }
    case "cover": {
      scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
      scaleX = scale;
      scaleY = scale;
      // Center (overflow is cropped)
      offsetX = (targetWidth - sourceWidth * scale) / 2;
      offsetY = (targetHeight - sourceHeight * scale) / 2;
      break;
    }
    case "stretch": {
      scaleX = targetWidth / sourceWidth;
      scaleY = targetHeight / sourceHeight;
      scale = Math.min(scaleX, scaleY); // report the smaller for metadata
      offsetX = 0;
      offsetY = 0;
      break;
    }
  }

  // Update canvas dimensions
  cloned.w = targetWidth;
  cloned.h = targetHeight;

  // Wrap all existing layers in a precomp-like transform by adjusting their transforms
  if (Array.isArray(cloned.layers)) {
    for (const layer of cloned.layers) {
      applyTransformToLayer(layer, scaleX, scaleY, offsetX, offsetY);
    }
  }

  return { animationData: cloned, scale, offsetX, offsetY };
}

/**
 * Apply scale and offset to a layer's transform (ks).
 * Handles both static and animated position/scale/anchor values.
 */
function applyTransformToLayer(
  layer: LottieAny,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
): void {
  if (!layer.ks) return;

  const ks = layer.ks;

  // Scale the position
  if (ks.p) {
    scaleProperty(ks.p, scaleX, scaleY, offsetX, offsetY, "position");
  }

  // Scale the anchor point
  if (ks.a) {
    // Anchor points stay relative to the layer, no offset needed
    // but they need to be consistent with the new scale
    // Actually anchor points define the transform origin within the layer's own coordinate space
    // We should NOT scale anchor points — they stay in local coordinates
  }

  // Adjust the scale property (multiply existing scale by our factor)
  if (ks.s) {
    multiplyScaleProperty(ks.s, scaleX * 100, scaleY * 100);
  }
}

/**
 * Scale a position property (handles both static and animated).
 * For position: newPos = oldPos * scale + offset
 */
function scaleProperty(
  prop: LottieAny,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
  _type: string
): void {
  if (prop.a === 1 && Array.isArray(prop.k)) {
    // Animated property - array of keyframes
    for (const kf of prop.k) {
      if (kf && typeof kf === "object") {
        // Keyframe start value
        if (Array.isArray(kf.s)) {
          kf.s[0] = kf.s[0] * scaleX + offsetX;
          if (kf.s.length > 1) kf.s[1] = kf.s[1] * scaleY + offsetY;
        }
        // Keyframe end value (older format)
        if (Array.isArray(kf.e)) {
          kf.e[0] = kf.e[0] * scaleX + offsetX;
          if (kf.e.length > 1) kf.e[1] = kf.e[1] * scaleY + offsetY;
        }
      }
    }
  } else if (Array.isArray(prop.k)) {
    // Static value as array [x, y] or [x, y, z]
    prop.k[0] = prop.k[0] * scaleX + offsetX;
    if (prop.k.length > 1) prop.k[1] = prop.k[1] * scaleY + offsetY;
  }
}

/**
 * Multiply a scale property by factors (percentage-based in Lottie).
 * Lottie scale is in percentage (100 = 1x), so we multiply existing values.
 */
function multiplyScaleProperty(
  prop: LottieAny,
  factorX: number,
  factorY: number
): void {
  // factorX and factorY are already in percentage form (e.g., 50 means 0.5x)
  // We need to multiply existing percentage by (factor / 100)
  const mulX = factorX / 100;
  const mulY = factorY / 100;

  if (prop.a === 1 && Array.isArray(prop.k)) {
    // Animated property
    for (const kf of prop.k) {
      if (kf && typeof kf === "object") {
        if (Array.isArray(kf.s)) {
          kf.s[0] = kf.s[0] * mulX;
          if (kf.s.length > 1) kf.s[1] = kf.s[1] * mulY;
        }
        if (Array.isArray(kf.e)) {
          kf.e[0] = kf.e[0] * mulX;
          if (kf.e.length > 1) kf.e[1] = kf.e[1] * mulY;
        }
      }
    }
  } else if (Array.isArray(prop.k)) {
    // Static value [scaleX%, scaleY%] or [scaleX%, scaleY%, scaleZ%]
    prop.k[0] = prop.k[0] * mulX;
    if (prop.k.length > 1) prop.k[1] = prop.k[1] * mulY;
  }
}

export default rescaleForExport;
