/**
 * Mirror (flip) a Lottie animation horizontally or vertically.
 *
 * Strategy: For each layer, negate the relevant scale axis component and
 * mirror position values relative to the composition center.
 *
 * Lottie scale uses 0-100 range (100 = 100%, -100 = flipped).
 */

export type MirrorAxis = "horizontal" | "vertical";

interface AnimatedProperty {
  a: number;
  k: unknown;
}

interface Keyframe {
  t: number;
  s?: number[];
  e?: number[];
  [key: string]: unknown;
}

function isAnimatedProperty(val: unknown): val is AnimatedProperty {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  return "a" in obj && "k" in obj;
}

/**
 * Negate a specific axis index in a scale or position property.
 * For scale: negate the value at `axisIndex` (0=x, 1=y).
 * For position with `mirrorCenter`: reflect around center (newVal = center*2 - oldVal).
 */
function mirrorProperty(
  prop: unknown,
  axisIndex: number,
  options?: { mirrorCenter?: number }
): unknown {
  if (!isAnimatedProperty(prop)) return prop;

  const result = { ...prop } as AnimatedProperty;
  const { mirrorCenter } = options || {};

  if (prop.a === 1 && Array.isArray(prop.k)) {
    // Animated property with keyframes
    result.k = (prop.k as Keyframe[]).map((kf) => {
      const newKf = { ...kf };
      if (Array.isArray(kf.s)) {
        const s = [...kf.s];
        if (mirrorCenter !== undefined) {
          s[axisIndex] = mirrorCenter * 2 - s[axisIndex];
        } else {
          s[axisIndex] = -s[axisIndex];
        }
        newKf.s = s;
      }
      if (Array.isArray(kf.e)) {
        const e = [...kf.e];
        if (mirrorCenter !== undefined) {
          e[axisIndex] = mirrorCenter * 2 - e[axisIndex];
        } else {
          e[axisIndex] = -e[axisIndex];
        }
        newKf.e = e;
      }
      return newKf;
    });
  } else if (prop.a === 0 && Array.isArray(prop.k)) {
    // Static property with array value
    const k = [...(prop.k as number[])];
    if (mirrorCenter !== undefined) {
      k[axisIndex] = mirrorCenter * 2 - k[axisIndex];
    } else {
      k[axisIndex] = -k[axisIndex];
    }
    result.k = k;
  }

  return result;
}

function mirrorLayer(
  layer: Record<string, unknown>,
  axis: MirrorAxis,
  compWidth: number,
  compHeight: number
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(layer)) as Record<string, unknown>;
  const axisIndex = axis === "horizontal" ? 0 : 1;
  const center = axis === "horizontal" ? compWidth / 2 : compHeight / 2;

  const ks = result.ks as Record<string, unknown> | undefined;
  if (ks && typeof ks === "object") {
    const newKs: Record<string, unknown> = { ...ks };

    // Negate scale on the relevant axis
    if ("s" in newKs) {
      newKs.s = mirrorProperty(newKs.s, axisIndex);
    }

    // Mirror position relative to composition center
    if ("p" in newKs) {
      newKs.p = mirrorProperty(newKs.p, axisIndex, { mirrorCenter: center });
    }

    result.ks = newKs;
  }

  return result;
}

export function mirrorAnimation(lottieJson: object, axis: MirrorAxis): object {
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;
  const compWidth = (json.w as number) ?? 512;
  const compHeight = (json.h as number) ?? 512;

  if (!Array.isArray(json.layers)) return json;

  json.layers = (json.layers as Record<string, unknown>[]).map((layer) =>
    mirrorLayer(layer, axis, compWidth, compHeight)
  );

  return json;
}
