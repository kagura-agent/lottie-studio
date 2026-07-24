import { describe, it, expect } from "vitest";
import { morphAnimation, MorphShape } from "../morph";

interface MorphKs extends Record<string, unknown> {
  a: number;
  k: Record<string, unknown>[];
}

interface MorphLayer extends Record<string, unknown> {
  shapes: { ks: MorphKs }[];
}

interface MorphResult extends Record<string, unknown> {
  layers: MorphLayer[];
  op: number;
}

function getKs(result: object, layerIdx = 0): MorphKs {
  return (result as MorphResult).layers[layerIdx].shapes[0].ks;
}

function makeLottie(shapeVertices?: number[][], opts?: { layerName?: string; multiLayer?: boolean }) {
  const vertices = shapeVertices || [
    [0, 0], [100, 0], [100, 100], [0, 100],
  ];
  const shape = {
    ty: "sh",
    ks: {
      a: 0,
      k: {
        v: vertices,
        i: vertices.map(() => [0, 0]),
        o: vertices.map(() => [0, 0]),
        c: true,
      },
    },
  };

  const layer: Record<string, unknown> = {
    nm: opts?.layerName || "Shape Layer",
    ty: 4,
    ip: 0,
    op: 60,
    shapes: [shape],
    ks: { p: { a: 0, k: [50, 50] } },
  };

  const layers = [layer];
  if (opts?.multiLayer) {
    layers.push({
      nm: "Other Layer",
      ty: 4,
      ip: 0,
      op: 60,
      shapes: [{
        ty: "sh",
        ks: {
          a: 0,
          k: {
            v: [[10, 10], [90, 10], [90, 90]],
            i: [[0, 0], [0, 0], [0, 0]],
            o: [[0, 0], [0, 0], [0, 0]],
            c: true,
          },
        },
      }],
      ks: { p: { a: 0, k: [50, 50] } },
    } as Record<string, unknown>);
  }

  return { v: "5.7.0", fr: 30, ip: 0, op: 60, w: 200, h: 200, layers };
}

describe("morphAnimation", () => {
  const shapes: MorphShape[] = ["circle", "star", "rect", "triangle", "heart", "diamond", "hexagon", "pentagon"];

  for (const shape of shapes) {
    it(`morphs to ${shape}`, () => {
      const result = morphAnimation(makeLottie(), shape);
      const ks = getKs(result);
      expect(ks.a).toBe(1);
      expect(ks.k).toHaveLength(2);
      expect(ks.k[0].s).toBeDefined();
      expect(ks.k[0].e).toBeDefined();
      expect(ks.k[1].s).toBeDefined();
    });
  }

  it("handles rectangle as alias for rect", () => {
    const result = morphAnimation(makeLottie(), "rectangle");
    const ks = getKs(result);
    expect(ks.a).toBe(1);
    expect((ks.k[0].e as Record<string, unknown>[])[0].v).toHaveLength(4);
  });

  it("matches vertex counts via subdivision", () => {
    const result = morphAnimation(makeLottie(), "star");
    const ks = getKs(result);
    const sourceCount = ((ks.k[0].s as Record<string, unknown>[])[0].v as unknown[]).length;
    const targetCount = ((ks.k[0].e as Record<string, unknown>[])[0].v as unknown[]).length;
    expect(sourceCount).toBe(targetCount);
  });

  it("respects --duration flag", () => {
    const result = morphAnimation(makeLottie(), "circle", { duration: 2 });
    const ks = getKs(result);
    expect(ks.k[0].t).toBe(0);
    expect(ks.k[1].t).toBe(60);
  });

  it("defaults duration to 1 second", () => {
    const result = morphAnimation(makeLottie(), "circle");
    const ks = getKs(result);
    expect(ks.k[1].t).toBe(30);
  });

  it("respects --easing flag", () => {
    const result = morphAnimation(makeLottie(), "circle", { easing: "ease-in" });
    const ks = getKs(result);
    expect((ks.k[0].i as Record<string, number[]>).x[0]).toBeCloseTo(0.42);
  });

  it("targets specific layer by name", () => {
    const result = morphAnimation(makeLottie(undefined, { multiLayer: true }), "circle", { layer: "Other Layer" });
    expect(getKs(result, 0).a).toBe(0);
    expect(getKs(result, 1).a).toBe(1);
  });

  it("targets specific layer by index", () => {
    const result = morphAnimation(makeLottie(undefined, { multiLayer: true }), "circle", { layer: 1 });
    expect(getKs(result, 0).a).toBe(0);
    expect(getKs(result, 1).a).toBe(1);
  });

  it("throws when no path data found", () => {
    const noShapes = { v: "5.7.0", fr: 30, ip: 0, op: 60, w: 200, h: 200, layers: [{ nm: "Empty", ty: 4, ip: 0, op: 60, shapes: [], ks: {} }] };
    expect(() => morphAnimation(noShapes, "circle")).toThrow("No path data found");
  });

  it("throws for invalid layer name", () => {
    expect(() => morphAnimation(makeLottie(), "circle", { layer: "Nonexistent" })).toThrow('Layer "Nonexistent" not found');
  });

  it("throws for out of range layer index", () => {
    expect(() => morphAnimation(makeLottie(), "circle", { layer: 99 })).toThrow("out of range");
  });

  it("throws when no layers exist", () => {
    const noLayers = { v: "5.7.0", fr: 30, ip: 0, op: 60, w: 200, h: 200 };
    expect(() => morphAnimation(noLayers, "circle")).toThrow("No layers found");
  });

  it("does not mutate original object", () => {
    const input = makeLottie();
    const origStr = JSON.stringify(input);
    morphAnimation(input, "star");
    expect(JSON.stringify(input)).toBe(origStr);
  });

  it("extends op if morph duration exceeds animation length", () => {
    const short = makeLottie();
    short.op = 10;
    const result = morphAnimation(short, "circle", { duration: 2 }) as MorphResult;
    expect(result.op).toBe(60);
  });

  it("handles single-vertex path gracefully", () => {
    const result = morphAnimation(makeLottie([[50, 50]]), "circle");
    const ks = getKs(result);
    expect(ks.a).toBe(1);
    const sourceCount = ((ks.k[0].s as Record<string, unknown>[])[0].v as unknown[]).length;
    const targetCount = ((ks.k[0].e as Record<string, unknown>[])[0].v as unknown[]).length;
    expect(sourceCount).toBe(targetCount);
  });

  it("handles animated path (a=1) as source", () => {
    const lottie = {
      v: "5.7.0", fr: 30, ip: 0, op: 60, w: 200, h: 200,
      layers: [{
        nm: "Animated",
        ty: 4,
        ip: 0,
        op: 60,
        shapes: [{
          ty: "sh",
          ks: {
            a: 1,
            k: [
              {
                t: 0,
                s: [{ v: [[0, 0], [100, 0], [100, 100]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
                e: [{ v: [[10, 10], [90, 10], [90, 90]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
              },
              {
                t: 30,
                s: [{ v: [[10, 10], [90, 10], [90, 90]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
              },
            ],
          },
        }],
        ks: { p: { a: 0, k: [50, 50] } },
      }],
    };
    const result = morphAnimation(lottie, "hexagon");
    const ks = getKs(result);
    expect(ks.a).toBe(1);
    const s0v = ((ks.k[0].s as Record<string, unknown>[])[0].v as unknown[]).length;
    const e0v = ((ks.k[0].e as Record<string, unknown>[])[0].v as unknown[]).length;
    expect(s0v).toBe(e0v);
  });

  it("morphs multiple shape layers when no --layer specified", () => {
    const result = morphAnimation(makeLottie(undefined, { multiLayer: true }), "triangle");
    expect(getKs(result, 0).a).toBe(1);
    expect(getKs(result, 1).a).toBe(1);
  });
});
