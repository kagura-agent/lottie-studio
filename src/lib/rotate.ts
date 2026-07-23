export type RotateDegrees = number;

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

function offsetRotation(prop: AnimatedProperty, degrees: number): AnimatedProperty {
  const result = { ...prop };

  if (prop.a === 1 && Array.isArray(prop.k)) {
    result.k = (prop.k as Keyframe[]).map((kf) => {
      const newKf = { ...kf };
      if (Array.isArray(kf.s)) {
        const s = [...kf.s];
        s[0] = s[0] + degrees;
        newKf.s = s;
      }
      if (Array.isArray(kf.e)) {
        const e = [...kf.e];
        e[0] = e[0] + degrees;
        newKf.e = e;
      }
      return newKf;
    });
  } else if (prop.a === 0 && typeof prop.k === "number") {
    result.k = prop.k + degrees;
  }

  return result;
}

export function rotateAnimation(lottieJson: object, degrees: number): object {
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;

  if (!Array.isArray(json.layers)) return json;

  json.layers = (json.layers as Record<string, unknown>[]).map((layer) => {
    const result = JSON.parse(JSON.stringify(layer)) as Record<string, unknown>;
    let ks = result.ks as Record<string, unknown> | undefined;

    if (!ks || typeof ks !== "object") {
      ks = {};
      result.ks = ks;
    }

    if (!("r" in ks) || !isAnimatedProperty(ks.r)) {
      ks.r = { a: 0, k: 0 };
    }

    ks.r = offsetRotation(ks.r as AnimatedProperty, degrees);

    return result;
  });

  return json;
}
