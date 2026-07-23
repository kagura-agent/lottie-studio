export type ScaleFactor = number;

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

function scaleProperty(prop: unknown, factor: number, indices?: number[]): unknown {
  if (!isAnimatedProperty(prop)) return prop;

  const result = { ...prop } as AnimatedProperty;

  if (prop.a === 1 && Array.isArray(prop.k)) {
    result.k = (prop.k as Keyframe[]).map((kf) => {
      const newKf = { ...kf };
      if (Array.isArray(kf.s)) {
        const s = [...kf.s];
        const idx = indices ?? s.map((_, i) => i);
        for (const i of idx) {
          if (i < s.length) s[i] = s[i] * factor;
        }
        newKf.s = s;
      }
      if (Array.isArray(kf.e)) {
        const e = [...kf.e];
        const idx = indices ?? e.map((_, i) => i);
        for (const i of idx) {
          if (i < e.length) e[i] = e[i] * factor;
        }
        newKf.e = e;
      }
      return newKf;
    });
  } else if (prop.a === 0 && Array.isArray(prop.k)) {
    const k = [...(prop.k as number[])];
    const idx = indices ?? k.map((_, i) => i);
    for (const i of idx) {
      if (i < k.length) k[i] = k[i] * factor;
    }
    result.k = k;
  } else if (prop.a === 0 && typeof prop.k === "number") {
    result.k = (prop.k as number) * factor;
  }

  return result;
}

function scaleShapes(shapes: Record<string, unknown>[], factor: number): Record<string, unknown>[] {
  return shapes.map((shape) => {
    const result = { ...shape };
    const ty = shape.ty as string;

    if (ty === "rc" || ty === "el") {
      if ("s" in result) result.s = scaleProperty(result.s, factor);
      if ("p" in result) result.p = scaleProperty(result.p, factor);
    }

    if (ty === "sh" && result.ks) {
      result.ks = scalePathVertices(result.ks, factor);
    }

    if (ty === "st" || ty === "gs") {
      if ("w" in result) result.w = scaleProperty(result.w, factor);
    }

    if (ty === "gr" && Array.isArray(result.it)) {
      result.it = scaleShapes(result.it as Record<string, unknown>[], factor);
    }

    if (ty === "tr") {
      if ("p" in result) result.p = scaleProperty(result.p, factor);
      if ("a" in result) result.a = scaleProperty(result.a, factor);
    }

    return result;
  });
}

function scalePathVertices(ks: unknown, factor: number): unknown {
  if (!isAnimatedProperty(ks)) return ks;

  const result = { ...ks } as AnimatedProperty;

  if (ks.a === 1 && Array.isArray(ks.k)) {
    result.k = (ks.k as Keyframe[]).map((kf) => {
      const newKf = { ...kf };
      if (Array.isArray(kf.s) && kf.s.length > 0 && typeof kf.s[0] === "object") {
        newKf.s = (kf.s as unknown as Record<string, unknown>[]).map((shape) => scaleShapeData(shape, factor)) as unknown as number[];
      }
      if (Array.isArray(kf.e) && kf.e.length > 0 && typeof kf.e[0] === "object") {
        newKf.e = (kf.e as unknown as Record<string, unknown>[]).map((shape) => scaleShapeData(shape, factor)) as unknown as number[];
      }
      return newKf;
    });
  } else if (ks.a === 0 && ks.k && typeof ks.k === "object" && !Array.isArray(ks.k)) {
    result.k = scaleShapeData(ks.k as Record<string, unknown>, factor);
  }

  return result;
}

function scaleShapeData(shape: Record<string, unknown>, factor: number): Record<string, unknown> {
  const result = { ...shape };
  for (const key of ["v", "i", "o"]) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as number[][]).map((pt) => pt.map((v) => v * factor));
    }
  }
  return result;
}

function scaleTextData(data: Record<string, unknown>, factor: number): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  if (result.d && typeof result.d === "object") {
    const d = result.d as Record<string, unknown>;
    if (Array.isArray(d.k)) {
      d.k = (d.k as Record<string, unknown>[]).map((kf) => {
        const newKf = { ...kf };
        if (newKf.s && typeof newKf.s === "object") {
          const s = { ...(newKf.s as Record<string, unknown>) };
          if (typeof s.s === "number") s.s = s.s * factor;
          newKf.s = s;
        }
        return newKf;
      });
    }
  }
  return result;
}

export function scaleAnimation(lottieJson: object, factor: number): object {
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;

  if (!Array.isArray(json.layers)) return json;

  json.layers = (json.layers as Record<string, unknown>[]).map((layer) => {
    const result = JSON.parse(JSON.stringify(layer)) as Record<string, unknown>;

    const ks = result.ks as Record<string, unknown> | undefined;
    if (ks && typeof ks === "object") {
      if ("p" in ks) ks.p = scaleProperty(ks.p, factor);
      if ("a" in ks) ks.a = scaleProperty(ks.a, factor);
    }

    if (Array.isArray(result.shapes)) {
      result.shapes = scaleShapes(result.shapes as Record<string, unknown>[], factor);
    }

    if (result.ty === 5 && result.t) {
      result.t = scaleTextData(result.t as Record<string, unknown>, factor);
    }

    return result;
  });

  return json;
}
