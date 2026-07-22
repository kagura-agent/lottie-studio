/**
 * Reverses animation keyframes in a Lottie JSON object.
 */

interface Keyframe {
  t: number;
  s?: unknown;
  e?: unknown;
  i?: { x: number | number[]; y: number | number[] };
  o?: { x: number | number[]; y: number | number[] };
  [key: string]: unknown;
}

interface AnimatedProperty {
  a: number;
  k: Keyframe[] | unknown;
}

function isAnimatedProperty(val: unknown): val is AnimatedProperty {
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  return obj.a === 1 && Array.isArray(obj.k);
}

function reverseKeyframes(keyframes: Keyframe[], duration: number): Keyframe[] {
  if (keyframes.length <= 1) return keyframes.map((kf) => ({ ...kf }));

  const reversed = keyframes.map((kf) => ({
    ...kf,
    t: duration - kf.t,
  }));

  // Reverse order so times are ascending again
  reversed.reverse();

  // Swap easing: when time is reversed, in-tangent becomes out-tangent and vice versa
  // In original: keyframe[i].o is how you leave toward keyframe[i+1], keyframe[i+1].i is how you arrive
  // After reversing order, we need to swap i and o between adjacent keyframes
  const result: Keyframe[] = reversed.map((kf, idx) => {
    const newKf = { ...kf };
    if (idx < reversed.length - 1) {
      // This keyframe's out-easing should be the original next keyframe's in-easing
      // Since we reversed, the "original next" is now the previous in the reversed array
      // Actually simpler: just swap i and o on each keyframe
      newKf.i = kf.o;
      newKf.o = kf.i;
    } else {
      // Last keyframe typically has no easing (end of animation)
      delete newKf.i;
      delete newKf.o;
    }
    return newKf;
  });

  return result;
}

function reverseProperty(prop: unknown, duration: number): unknown {
  if (isAnimatedProperty(prop)) {
    const keyframes = prop.k as Keyframe[];
    return { ...prop, k: reverseKeyframes(keyframes, duration) };
  }
  return prop;
}

function reverseShapeItems(items: unknown[], duration: number): unknown[] {
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const obj = item as Record<string, unknown>;
    const result: Record<string, unknown> = { ...obj };

    // Recurse into group items
    if (obj.ty === "gr" && Array.isArray(obj.it)) {
      result.it = reverseShapeItems(obj.it as unknown[], duration);
    }

    // Handle transform within groups
    if (obj.ty === "tr") {
      for (const key of ["p", "s", "r", "o", "a", "sk", "sa"]) {
        if (key in result) {
          result[key] = reverseProperty(result[key], duration);
        }
      }
    }

    // Handle shape keyframes (ks property on shape types)
    if ("ks" in result) {
      result.ks = reverseProperty(result.ks, duration);
    }

    return result;
  });
}

function reverseLayer(layer: Record<string, unknown>, animDuration: number): Record<string, unknown> {
  const result: Record<string, unknown> = { ...layer };
  const ip = (layer.ip as number) ?? 0;
  const op = (layer.op as number) ?? animDuration;
  const duration = op - ip;

  // Reverse transform properties
  const ks = layer.ks as Record<string, unknown> | undefined;
  if (ks && typeof ks === "object") {
    const newKs: Record<string, unknown> = { ...ks };
    for (const key of ["p", "s", "r", "o", "a", "sk", "sa"]) {
      if (key in newKs) {
        newKs[key] = reverseProperty(newKs[key], duration);
      }
    }
    result.ks = newKs;
  }

  // Reverse shape keyframes
  if (Array.isArray(layer.shapes)) {
    result.shapes = reverseShapeItems(layer.shapes as unknown[], duration);
  }

  return result;
}

export function reverseAnimation(lottieJson: object): object {
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;
  const ip = (json.ip as number) ?? 0;
  const op = (json.op as number) ?? 0;
  const animDuration = op - ip;

  if (!Array.isArray(json.layers) || animDuration <= 0) return json;

  json.layers = (json.layers as Record<string, unknown>[]).map((layer) =>
    reverseLayer(layer, animDuration)
  );

  return json;
}
