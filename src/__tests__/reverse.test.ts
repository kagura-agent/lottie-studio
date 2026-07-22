import { describe, it, expect } from "vitest";
import { reverseAnimation } from "@/lib/reverse";

describe("reverseAnimation", () => {
  it("leaves static properties unchanged", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: {
            p: { a: 0, k: [100, 100] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        },
      ],
    };
    const result = reverseAnimation(input) as typeof input;
    expect(result.layers[0].ks.p).toEqual({ a: 0, k: [100, 100] });
    expect(result.layers[0].ks.s).toEqual({ a: 0, k: [100, 100] });
  });

  it("reverses animated position keyframes in time", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 30, s: [50, 50] },
                { t: 60, s: [100, 100] },
              ],
            },
          },
        },
      ],
    };
    const result = reverseAnimation(input) as Record<string, any>;
    const kf = result.layers[0].ks.p.k;
    expect(kf[0].t).toBe(0);
    expect(kf[0].s).toEqual([100, 100]);
    expect(kf[1].t).toBe(30);
    expect(kf[1].s).toEqual([50, 50]);
    expect(kf[2].t).toBe(60);
    expect(kf[2].s).toEqual([0, 0]);
  });

  it("swaps easing in/out tangents", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], i: { x: 0.1, y: 0.1 }, o: { x: 0.9, y: 0.9 } },
                { t: 30, s: [50, 50], i: { x: 0.2, y: 0.2 }, o: { x: 0.8, y: 0.8 } },
                { t: 60, s: [100, 100] },
              ],
            },
          },
        },
      ],
    };
    const result = reverseAnimation(input) as Record<string, any>;
    const kf = result.layers[0].ks.p.k;
    // First keyframe (was last original, had no easing) — swaps its own i/o (both undefined)
    expect(kf[0].i).toBeUndefined();
    expect(kf[0].o).toBeUndefined();
    // Second keyframe — swaps i and o
    expect(kf[1].i).toEqual({ x: 0.8, y: 0.8 });
    expect(kf[1].o).toEqual({ x: 0.2, y: 0.2 });
    // Last keyframe — no easing (terminal)
    expect(kf[2].i).toBeUndefined();
    expect(kf[2].o).toBeUndefined();
  });

  it("handles multi-layer animations", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: { p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] } },
        },
        {
          ip: 0,
          op: 60,
          ks: { p: { a: 1, k: [{ t: 0, s: [200, 200] }, { t: 60, s: [300, 300] }] } },
        },
      ],
    };
    const result = reverseAnimation(input) as Record<string, any>;
    expect(result.layers[0].ks.p.k[0].s).toEqual([100, 100]);
    expect(result.layers[1].ks.p.k[0].s).toEqual([300, 300]);
  });

  it("handles shape keyframes", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: { p: { a: 0, k: [0, 0] } },
          shapes: [
            {
              ty: "gr",
              it: [
                {
                  ty: "sh",
                  ks: {
                    a: 1,
                    k: [
                      { t: 0, s: [{ v: [[0, 0]] }] },
                      { t: 60, s: [{ v: [[100, 100]] }] },
                    ],
                  },
                },
                {
                  ty: "tr",
                  p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [50, 50] }] },
                  s: { a: 0, k: [100, 100] },
                },
              ],
            },
          ],
        },
      ],
    };
    const result = reverseAnimation(input) as Record<string, any>;
    const shapePath = result.layers[0].shapes[0].it[0].ks.k;
    expect(shapePath[0].s).toEqual([{ v: [[100, 100]] }]);
    expect(shapePath[1].s).toEqual([{ v: [[0, 0]] }]);
    const trPos = result.layers[0].shapes[0].it[1].p.k;
    expect(trPos[0].s).toEqual([50, 50]);
  });

  it("does not change a single keyframe", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: { p: { a: 1, k: [{ t: 0, s: [50, 50] }] } },
        },
      ],
    };
    const result = reverseAnimation(input) as Record<string, any>;
    expect(result.layers[0].ks.p.k).toEqual([{ t: 0, s: [50, 50] }]);
  });

  it("handles empty layers array", () => {
    const input = { ip: 0, op: 60, layers: [] };
    const result = reverseAnimation(input) as Record<string, any>;
    expect(result.layers).toEqual([]);
  });

  it("does not mutate input", () => {
    const input = {
      ip: 0,
      op: 60,
      layers: [
        {
          ip: 0,
          op: 60,
          ks: { p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] } },
        },
      ],
    };
    const original = JSON.parse(JSON.stringify(input));
    reverseAnimation(input);
    expect(input).toEqual(original);
  });
});
