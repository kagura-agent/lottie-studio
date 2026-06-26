import { describe, it, expect } from "vitest";
import {
  roundDecimals,
  removeHiddenLayers,
  removeEmptyGroups,
  removeRedundantKeyframes,
  collapseSingleItemGroups,
  optimizeLottie,
  validateAndFix,
} from "../optimizer";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("roundDecimals", () => {
  it("rounds floating point numbers to 3 decimal places by default", () => {
    const input = { x: 1.123456, y: 2.987654 };
    const result = roundDecimals(input) as any;
    expect(result).toEqual({ x: 1.123, y: 2.988 });
  });

  it("does not round integers", () => {
    const input = { x: 5, y: 100, z: 0 };
    const result = roundDecimals(input);
    expect(result).toEqual({ x: 5, y: 100, z: 0 });
  });

  it("handles nested objects and arrays", () => {
    const input = { a: { b: [1.11111, 2.22222] }, c: 3.33333 };
    const result = roundDecimals(input, 2);
    expect(result).toEqual({ a: { b: [1.11, 2.22] }, c: 3.33 });
  });

  it("supports custom precision", () => {
    const input = { val: 3.14159265 };
    expect(roundDecimals(input, 5)).toEqual({ val: 3.14159 });
    expect(roundDecimals(input, 1)).toEqual({ val: 3.1 });
  });

  it("does not mutate the input", () => {
    const input = { x: 1.123456 };
    const original = JSON.parse(JSON.stringify(input));
    roundDecimals(input);
    expect(input).toEqual(original);
  });

  it("handles null and string values gracefully", () => {
    const input = { a: null, b: "hello", c: 1.999 };
    const result = roundDecimals(input, 2);
    expect(result).toEqual({ a: null, b: "hello", c: 2 });
  });

  it("handles deeply nested arrays", () => {
    const input = [[[1.55555]]];
    const result = roundDecimals(input, 3);
    expect(result).toEqual([[[1.556]]]);
  });
});

describe("removeHiddenLayers", () => {
  it("removes layers with hd: true", () => {
    const input = {
      layers: [
        { nm: "visible", hd: false },
        { nm: "hidden", hd: true },
        { nm: "also_visible" },
      ],
    };
    const result = removeHiddenLayers(input) as any;
    expect(result.layers).toHaveLength(2);
    expect(result.layers[0].nm).toBe("visible");
    expect(result.layers[1].nm).toBe("also_visible");
  });

  it("preserves all layers when none are hidden", () => {
    const input = {
      layers: [
        { nm: "a" },
        { nm: "b", hd: false },
      ],
    };
    const result = removeHiddenLayers(input) as any;
    expect(result.layers).toHaveLength(2);
  });

  it("does not mutate the input", () => {
    const input = { layers: [{ nm: "hidden", hd: true }] };
    const original = JSON.parse(JSON.stringify(input));
    removeHiddenLayers(input);
    expect(input).toEqual(original);
  });

  it("handles missing layers array", () => {
    const input = { v: "5.5.7" };
    const result = removeHiddenLayers(input);
    expect(result).toEqual({ v: "5.5.7" });
  });
});

describe("removeEmptyGroups", () => {
  it("removes shape groups with no visible shapes", () => {
    const input = {
      layers: [
        {
          shapes: [
            { ty: "gr", it: [{ ty: "tr" }] }, // group with only transform = empty
            { ty: "gr", it: [{ ty: "sh" }, { ty: "tr" }] }, // group with shape + transform = keep
          ],
        },
      ],
    };
    const result = removeEmptyGroups(input) as any;
    expect(result.layers[0].shapes).toHaveLength(1);
    expect(result.layers[0].shapes[0].it).toHaveLength(2);
  });

  it("preserves groups that have content", () => {
    const input = {
      layers: [
        {
          shapes: [
            { ty: "gr", it: [{ ty: "fl" }, { ty: "rc" }, { ty: "tr" }] },
          ],
        },
      ],
    };
    const result = removeEmptyGroups(input) as any;
    expect(result.layers[0].shapes).toHaveLength(1);
  });

  it("does not mutate the input", () => {
    const input = { layers: [{ shapes: [{ ty: "gr", it: [{ ty: "tr" }] }] }] };
    const original = JSON.parse(JSON.stringify(input));
    removeEmptyGroups(input);
    expect(input).toEqual(original);
  });
});

describe("removeRedundantKeyframes", () => {
  it("removes keyframes where start equals end (no-op hold frames)", () => {
    const input = {
      layers: [
        {
          ks: {
            o: {
              a: 1,
              k: [
                { t: 0, s: [100], e: [100] }, // no-op: start === end
                { t: 10, s: [100], e: [50] },
                { t: 20, s: [50] },
              ],
            },
          },
        },
      ],
    };
    const result = removeRedundantKeyframes(input) as any;
    const keyframes = result.layers[0].ks.o.k;
    expect(keyframes.length).toBeLessThan(3);
  });

  it("keeps keyframes that introduce actual value changes", () => {
    const input = {
      layers: [
        {
          ks: {
            o: {
              a: 1,
              k: [
                { t: 0, s: [0], e: [100] },
                { t: 10, s: [100], e: [0] },
                { t: 20, s: [0] },
              ],
            },
          },
        },
      ],
    };
    const result = removeRedundantKeyframes(input) as any;
    expect(result.layers[0].ks.o.k).toHaveLength(3);
  });

  it("does not mutate the input", () => {
    const input = {
      layers: [{ ks: { o: { a: 1, k: [{ t: 0, s: [100], e: [100] }, { t: 10, s: [100] }] } } }],
    };
    const original = JSON.parse(JSON.stringify(input));
    removeRedundantKeyframes(input);
    expect(input).toEqual(original);
  });
});

describe("collapseSingleItemGroups", () => {
  it("unwraps groups that contain only one shape item plus transform", () => {
    const input = {
      layers: [
        {
          shapes: [
            {
              ty: "gr",
              it: [
                { ty: "rc", s: { k: [100, 100] } },
                { ty: "tr", p: { k: [0, 0] } },
              ],
            },
          ],
        },
      ],
    };
    const result = collapseSingleItemGroups(input) as any;
    expect(result.layers[0].shapes[0].ty).toBe("rc");
  });

  it("does not collapse groups with multiple shapes", () => {
    const input = {
      layers: [
        {
          shapes: [
            {
              ty: "gr",
              it: [
                { ty: "rc" },
                { ty: "fl" },
                { ty: "tr" },
              ],
            },
          ],
        },
      ],
    };
    const result = collapseSingleItemGroups(input) as any;
    expect(result.layers[0].shapes[0].ty).toBe("gr");
    expect(result.layers[0].shapes[0].it).toHaveLength(3);
  });

  it("does not mutate the input", () => {
    const input = {
      layers: [{ shapes: [{ ty: "gr", it: [{ ty: "rc" }, { ty: "tr" }] }] }],
    };
    const original = JSON.parse(JSON.stringify(input));
    collapseSingleItemGroups(input);
    expect(input).toEqual(original);
  });
});

describe("optimizeLottie", () => {
  it("runs all optimization passes and returns stats", () => {
    const input = {
      v: "5.5.7",
      fr: 30,
      ip: 0,
      op: 60,
      w: 512,
      h: 512,
      layers: [
        {
          nm: "hidden_layer",
          hd: true,
          ks: { o: { a: 0, k: 100 } },
          shapes: [],
        },
        {
          nm: "visible_layer",
          ks: {
            o: {
              a: 1,
              k: [
                { t: 0, s: [100.123456], e: [100.123456] },
                { t: 10, s: [100.123456] },
              ],
            },
          },
          shapes: [
            { ty: "gr", it: [{ ty: "tr" }] }, // empty group
            { ty: "gr", it: [{ ty: "rc", s: { k: [50.999999, 50.999999] } }, { ty: "tr" }] }, // single item group
          ],
        },
      ],
    };

    const { optimized, stats } = optimizeLottie(input);

    expect(stats.originalSize).toBeGreaterThan(0);
    expect(stats.optimizedSize).toBeLessThan(stats.originalSize);
    expect(stats.layersRemoved).toBe(1);
    expect(stats.groupsSimplified).toBeGreaterThan(0);

    // Verify hidden layer removed
    const layers = optimized.layers as any[];
    expect(layers).toHaveLength(1);
    expect(layers[0].nm).toBe("visible_layer");
  });

  it("does not mutate the input", () => {
    const input = {
      v: "5.5.7",
      layers: [{ nm: "test", hd: true, shapes: [] }],
    };
    const original = JSON.parse(JSON.stringify(input));
    optimizeLottie(input);
    expect(input).toEqual(original);
  });

  it("handles an already-optimized animation gracefully", () => {
    const input = {
      v: "5.5.7",
      layers: [
        {
          nm: "clean",
          ks: { o: { a: 0, k: 100 } },
          shapes: [{ ty: "rc", s: { k: [100, 100] } }],
        },
      ],
    };
    const { optimized, stats } = optimizeLottie(input);
    expect(stats.layersRemoved).toBe(0);
    const layers = optimized.layers as any[];
    expect(layers).toHaveLength(1);
  });
});

describe("validateAndFix", () => {
  it("normalizes color values > 1 to 0-1 range", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "test", ty: 4, ind: 0, ip: 0, op: 60,
        ks: { p: { a: 0, k: [256, 256] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } },
        shapes: [{
          ty: "fl",
          c: { a: 0, k: [255, 128, 0] },
        }],
      }],
    };
    const result = validateAndFix(input);
    const fill = (result.fixed.layers as any[])[0].shapes[0];
    expect(fill.c.k[0]).toBeCloseTo(1, 2);
    expect(fill.c.k[1]).toBeCloseTo(0.502, 2);
    expect(fill.c.k[2]).toBeCloseTo(0, 2);
    expect(result.fixesApplied.length).toBeGreaterThan(0);
  });

  it("defaults missing ip/op to root values", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "no-timing", ty: 4, ind: 0,
        ks: { p: { a: 0, k: [256, 256] } },
        shapes: [],
      }],
    };
    const result = validateAndFix(input);
    const layer = (result.fixed.layers as any[])[0];
    expect(layer.ip).toBe(0);
    expect(layer.op).toBe(60);
    expect(result.fixesApplied.some((f: string) => f.includes("ip"))).toBe(true);
  });

  it("adds default transform when ks is missing", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 400, h: 300, fr: 30,
      layers: [{
        nm: "no-transform", ty: 4, ind: 0, ip: 0, op: 60,
        shapes: [],
      }],
    };
    const result = validateAndFix(input);
    const layer = (result.fixed.layers as any[])[0];
    expect(layer.ks).toBeDefined();
    expect(layer.ks.p.k).toEqual([200, 150]);
    expect(layer.ks.s.k).toEqual([100, 100]);
    expect(result.fixesApplied.some((f: string) => f.includes("transform"))).toBe(true);
  });

  it("clamps layer ip/op to root range", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "out-of-range", ty: 4, ind: 0, ip: -10, op: 200,
        ks: { p: { a: 0, k: [256, 256] } },
        shapes: [],
      }],
    };
    const result = validateAndFix(input);
    const layer = (result.fixed.layers as any[])[0];
    expect(layer.ip).toBe(0);
    expect(layer.op).toBe(60);
    expect(result.fixesApplied.some((f: string) => f.includes("Clamped"))).toBe(true);
  });

  it("auto-assigns missing ind values", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [
        { nm: "a", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [0, 0] } }, shapes: [] },
        { nm: "b", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [0, 0] } }, shapes: [] },
      ],
    };
    const result = validateAndFix(input);
    const layers = result.fixed.layers as any[];
    expect(layers[0].ind).toBe(0);
    expect(layers[1].ind).toBe(1);
    expect(result.fixesApplied.some((f: string) => f.includes("index"))).toBe(true);
  });

  it("warns about keyframes outside animation range", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "over-range", ty: 4, ind: 0, ip: 0, op: 60,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 90, s: [100, 100] }] },
        },
        shapes: [],
      }],
    };
    const result = validateAndFix(input);
    expect(result.warnings.some((w: string) => w.includes("Keyframe"))).toBe(true);
  });

  it("warns about zero-sized shapes", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "tiny", ty: 4, ind: 0, ip: 0, op: 60,
        ks: { p: { a: 0, k: [0, 0] } },
        shapes: [{
          ty: "rc",
          s: { a: 0, k: [0, 0] },
        }],
      }],
    };
    const result = validateAndFix(input);
    expect(result.warnings.some((w: string) => w.includes("Zero-sized"))).toBe(true);
  });

  it("warns about shape groups without fill or stroke", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "invisible", ty: 4, ind: 0, ip: 0, op: 60,
        ks: { p: { a: 0, k: [0, 0] } },
        shapes: [{
          ty: "gr",
          it: [
            { ty: "rc", s: { a: 0, k: [100, 100] } },
            { ty: "tr", p: { k: [0, 0] } },
          ],
        }],
      }],
    };
    const result = validateAndFix(input);
    expect(result.warnings.some((w: string) => w.includes("no fill or stroke"))).toBe(true);
  });

  it("passes valid animation through with no warnings or fixes", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "valid", ty: 4, ind: 0, ip: 0, op: 60,
        ks: { p: { a: 0, k: [256, 256] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } },
        shapes: [{
          ty: "gr",
          it: [
            { ty: "rc", s: { a: 0, k: [100, 100] } },
            { ty: "fl", c: { a: 0, k: [1, 0, 0] } },
            { ty: "tr", p: { k: [0, 0] } },
          ],
        }],
      }],
    };
    const result = validateAndFix(input);
    expect(result.warnings).toHaveLength(0);
    expect(result.fixesApplied).toHaveLength(0);
  });

  it("walks nested groups to fix colors", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "nested", ty: 4, ind: 0, ip: 0, op: 60,
        ks: { p: { a: 0, k: [256, 256] } },
        shapes: [{
          ty: "gr",
          it: [
            {
              ty: "gr",
              it: [
                { ty: "rc", s: { a: 0, k: [50, 50] } },
                { ty: "fl", c: { a: 0, k: [255, 0, 0] } },
                { ty: "tr" },
              ],
            },
            { ty: "fl", c: { a: 0, k: [0, 255, 0] } },
            { ty: "tr" },
          ],
        }],
      }],
    };
    const result = validateAndFix(input);
    const outerGroup = (result.fixed.layers as any[])[0].shapes[0];
    const innerFill = outerGroup.it[0].it[1];
    const outerFill = outerGroup.it[1];
    expect(innerFill.c.k[0]).toBeCloseTo(1, 2);
    expect(outerFill.c.k[1]).toBeCloseTo(1, 2);
    expect(result.fixesApplied.filter((f: string) => f.includes("Normalized")).length).toBeGreaterThanOrEqual(2);
  });

  it("does not mutate the input", () => {
    const input = {
      v: "5.5.7", ip: 0, op: 60, w: 512, h: 512, fr: 30,
      layers: [{
        nm: "test", ty: 4,
        shapes: [{ ty: "fl", c: { a: 0, k: [255, 128, 0] } }],
      }],
    };
    const original = JSON.parse(JSON.stringify(input));
    validateAndFix(input);
    expect(input).toEqual(original);
  });
});
