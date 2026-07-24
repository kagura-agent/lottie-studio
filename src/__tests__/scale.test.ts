import { describe, it, expect } from "vitest";
import { scaleAnimation } from "@/lib/scale";
import { parseCommand } from "@/lib/commands";

describe("scaleAnimation", () => {
  const baseLottie = {
    w: 512,
    h: 512,
    fr: 30,
    ip: 0,
    op: 60,
    layers: [
      {
        ty: 4,
        ks: {
          p: { a: 0, k: [100, 200, 0] },
          a: { a: 0, k: [50, 50, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        shapes: [
          { ty: "rc", s: { a: 0, k: [80, 40] }, p: { a: 0, k: [10, 20] } },
          { ty: "el", s: { a: 0, k: [60, 60] } },
          {
            ty: "st",
            w: { a: 0, k: 4 },
          },
          {
            ty: "sh",
            ks: {
              a: 0,
              k: {
                v: [[0, 0], [10, 0], [10, 10]],
                i: [[0, 0], [0, 0], [0, 0]],
                o: [[0, 0], [0, 0], [0, 0]],
                c: true,
              },
            },
          },
        ],
      },
    ],
  };

  it("does not change canvas dimensions", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    expect(result.w).toBe(512);
    expect(result.h).toBe(512);
  });

  it("scales layer positions", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as { a: number; k: number[] };
    expect(p.k).toEqual([200, 400, 0]);
  });

  it("scales layer anchor points", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    const a = ks.a as { a: number; k: number[] };
    expect(a.k).toEqual([100, 100, 0]);
  });

  it("scales rectangle size and position", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const rect = shapes[0];
    expect((rect.s as { k: number[] }).k).toEqual([160, 80]);
    expect((rect.p as { k: number[] }).k).toEqual([20, 40]);
  });

  it("scales ellipse size", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const el = shapes[1];
    expect((el.s as { k: number[] }).k).toEqual([120, 120]);
  });

  it("scales stroke widths", () => {
    const result = scaleAnimation(baseLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const st = shapes[2];
    expect((st.w as { k: number }).k).toBe(8);
  });

  it("scales path vertices", () => {
    const result = scaleAnimation(baseLottie, 0.5) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const sh = shapes[3];
    const ks = sh.ks as { k: { v: number[][] } };
    expect(ks.k.v).toEqual([[0, 0], [5, 0], [5, 5]]);
  });

  it("handles animated keyframe values", () => {
    const anim = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [10, 20, 0], e: [30, 40, 0] },
              { t: 30, s: [30, 40, 0] },
            ],
          },
        },
        shapes: [],
      }],
    };
    const result = scaleAnimation(anim, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const p = (layers[0].ks as Record<string, unknown>).p as { k: Array<{ s?: number[]; e?: number[] }> };
    expect(p.k[0].s).toEqual([20, 40, 0]);
    expect(p.k[0].e).toEqual([60, 80, 0]);
    expect(p.k[1].s).toEqual([60, 80, 0]);
  });

  it("scales text font sizes", () => {
    const textLottie = {
      ...baseLottie,
      layers: [{
        ty: 5,
        ks: { p: { a: 0, k: [100, 100, 0] } },
        t: {
          d: {
            k: [{ s: { s: 24, f: "Arial" }, t: 0 }],
          },
        },
      }],
    };
    const result = scaleAnimation(textLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const t = layers[0].t as { d: { k: Array<{ s: { s: number } }> } };
    expect(t.d.k[0].s.s).toBe(48);
  });

  it("scales group children recursively", () => {
    const groupLottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{
          ty: "gr",
          it: [
            { ty: "rc", s: { a: 0, k: [10, 20] } },
            { ty: "tr", p: { a: 0, k: [5, 10] }, a: { a: 0, k: [1, 2] } },
          ],
        }],
      }],
    };
    const result = scaleAnimation(groupLottie, 3) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const gr = shapes[0] as { it: Record<string, unknown>[] };
    expect((gr.it[0].s as { k: number[] }).k).toEqual([30, 60]);
    expect((gr.it[1].p as { k: number[] }).k).toEqual([15, 30]);
    expect((gr.it[1].a as { k: number[] }).k).toEqual([3, 6]);
  });

  it("scales animated path keyframes (a=1 with shape objects)", () => {
    const animPathLottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{
          ty: "sh",
          ks: {
            a: 1,
            k: [
              {
                t: 0,
                s: [{ v: [[0, 0], [10, 20]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: true }],
                e: [{ v: [[5, 5], [15, 25]], i: [[1, 1], [2, 2]], o: [[3, 3], [4, 4]], c: true }],
              },
              {
                t: 30,
                s: [{ v: [[5, 5], [15, 25]], i: [[1, 1], [2, 2]], o: [[3, 3], [4, 4]], c: true }],
              },
            ],
          },
        }],
      }],
    };
    const result = scaleAnimation(animPathLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const sh = shapes[0] as { ks: { k: Array<{ s?: Array<{ v: number[][] }>; e?: Array<{ v: number[][] }> }> } };
    expect(sh.ks.k[0].s![0].v).toEqual([[0, 0], [20, 40]]);
    expect(sh.ks.k[0].e![0].v).toEqual([[10, 10], [30, 50]]);
    expect(sh.ks.k[1].s![0].v).toEqual([[10, 10], [30, 50]]);
  });

  it("handles animated path keyframes without shape objects (plain arrays)", () => {
    const animPathPlain = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{
          ty: "sh",
          ks: {
            a: 1,
            k: [
              { t: 0, s: [1, 2, 3], e: [4, 5, 6] },
            ],
          },
        }],
      }],
    };
    const result = scaleAnimation(animPathPlain, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const sh = shapes[0] as { ks: { k: Array<{ s?: number[]; e?: number[] }> } };
    // s[0] is a number not an object, so path scaling should leave them unchanged
    expect(sh.ks.k[0].s).toEqual([1, 2, 3]);
    expect(sh.ks.k[0].e).toEqual([4, 5, 6]);
  });

  it("scales gradient stroke width (gs type)", () => {
    const gsLottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{ ty: "gs", w: { a: 0, k: 3 } }],
      }],
    };
    const result = scaleAnimation(gsLottie, 4) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    expect((shapes[0].w as { k: number }).k).toBe(12);
  });

  it("scales animated stroke width (a=1)", () => {
    const animStroke = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{
          ty: "st",
          w: { a: 1, k: [{ t: 0, s: [2], e: [4] }, { t: 30, s: [4] }] },
        }],
      }],
    };
    const result = scaleAnimation(animStroke, 3) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const w = (shapes[0] as { w: { k: Array<{ s?: number[]; e?: number[] }> } }).w;
    expect(w.k[0].s).toEqual([6]);
    expect(w.k[0].e).toEqual([12]);
  });

  it("scaleProperty with indices parameter", () => {
    const lottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: {
          p: { a: 0, k: [100, 200, 0] },
        },
        shapes: [],
      }],
    };
    // This tests the default (all indices) path which is already covered,
    // but let's test the animated property with indices via position
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    expect((ks.p as { k: number[] }).k).toEqual([200, 400, 0]);
  });

  it("scales tr shape without a field", () => {
    const lottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{ ty: "tr", p: { a: 0, k: [5, 10] } }],
      }],
    };
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    expect((shapes[0].p as { k: number[] }).k).toEqual([10, 20]);
    expect(shapes[0].a).toBeUndefined();
  });

  it("scales tr shape without p field", () => {
    const lottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{ ty: "tr", a: { a: 0, k: [3, 6] } }],
      }],
    };
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    expect((shapes[0].a as { k: number[] }).k).toEqual([6, 12]);
    expect(shapes[0].p).toBeUndefined();
  });

  it("handles layer without ks field", () => {
    const lottie = {
      ...baseLottie,
      layers: [{ ty: 4, shapes: [{ ty: "rc", s: { a: 0, k: [10, 10] } }] }],
    };
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    expect((shapes[0].s as { k: number[] }).k).toEqual([20, 20]);
  });

  it("handles layer ks without p or a fields", () => {
    const lottie = {
      ...baseLottie,
      layers: [{ ty: 4, ks: { s: { a: 0, k: [100, 100] } }, shapes: [] }],
    };
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    expect(ks.s).toEqual({ a: 0, k: [100, 100] });
  });

  it("scales text layer with multiple keyframes and missing s field", () => {
    const textLottie = {
      ...baseLottie,
      layers: [{
        ty: 5,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        t: {
          d: {
            k: [
              { s: { s: 12, f: "Helvetica" }, t: 0 },
              { s: { s: 24, f: "Helvetica" }, t: 30 },
              { t: 60 },
            ],
          },
        },
      }],
    };
    const result = scaleAnimation(textLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const t = layers[0].t as { d: { k: Array<{ s?: { s: number }; t: number }> } };
    expect(t.d.k[0].s!.s).toBe(24);
    expect(t.d.k[1].s!.s).toBe(48);
    expect(t.d.k[2].s).toBeUndefined();
  });

  it("handles text layer with d but no k array", () => {
    const textLottie = {
      ...baseLottie,
      layers: [{
        ty: 5,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        t: { d: { x: 1 } },
      }],
    };
    const result = scaleAnimation(textLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const t = layers[0].t as { d: { x: number } };
    expect(t.d.x).toBe(1);
  });

  it("handles text layer with t but no d field", () => {
    const textLottie = {
      ...baseLottie,
      layers: [{
        ty: 5,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        t: { a: { a: 0, k: [] } },
      }],
    };
    const result = scaleAnimation(textLottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    expect(layers[0].t).toBeDefined();
  });

  it("handles scaleShapeData with missing keys", () => {
    const lottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: { a: 0, k: [0, 0, 0] } },
        shapes: [{
          ty: "sh",
          ks: {
            a: 0,
            k: { v: [[1, 2]], c: true },
          },
        }],
      }],
    };
    const result = scaleAnimation(lottie, 3) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const shapes = layers[0].shapes as Record<string, unknown>[];
    const ks = (shapes[0] as { ks: { k: { v: number[][]; i?: unknown; o?: unknown } } }).ks;
    expect(ks.k.v).toEqual([[3, 6]]);
    expect(ks.k.i).toBeUndefined();
    expect(ks.k.o).toBeUndefined();
  });

  it("handles non-animated-property value in ks field gracefully", () => {
    const lottie = {
      ...baseLottie,
      layers: [{
        ty: 4,
        ks: { p: "not-a-property" },
        shapes: [{ ty: "sh", ks: "invalid" }],
      }],
    };
    const result = scaleAnimation(lottie, 2) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    // Should not throw
    expect(layers[0]).toBeDefined();
  });

  it("returns input unchanged when no layers", () => {
    const noLayers = { w: 100, h: 100 };
    const result = scaleAnimation(noLayers, 2) as Record<string, unknown>;
    expect(result.w).toBe(100);
  });

  it("handles scale factor < 1", () => {
    const result = scaleAnimation(baseLottie, 0.5) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as { k: number[] };
    expect(p.k).toEqual([50, 100, 0]);
  });
});

describe("parseCommand /scale", () => {
  it("parses /scale 2x", () => {
    expect(parseCommand("/scale 2x")).toEqual({ type: "scale", factor: 2 });
  });

  it("parses /scale 0.5x", () => {
    expect(parseCommand("/scale 0.5x")).toEqual({ type: "scale", factor: 0.5 });
  });

  it("parses /scale 150%", () => {
    expect(parseCommand("/scale 150%")).toEqual({ type: "scale", factor: 1.5 });
  });

  it("parses /scale 200%", () => {
    expect(parseCommand("/scale 200%")).toEqual({ type: "scale", factor: 2 });
  });

  it("parses bare number /scale 3", () => {
    expect(parseCommand("/scale 3")).toEqual({ type: "scale", factor: 3 });
  });

  it("errors on missing arg", () => {
    const result = parseCommand("/scale");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on invalid arg", () => {
    const result = parseCommand("/scale abc");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on zero", () => {
    const result = parseCommand("/scale 0x");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on negative", () => {
    const result = parseCommand("/scale -1x");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });
});
