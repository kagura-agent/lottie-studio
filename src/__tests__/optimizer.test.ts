import { describe, it, expect } from "vitest";
import {
  roundDecimals,
  removeHiddenLayers,
  removeEmptyGroups,
  removeRedundantKeyframes,
  collapseSingleItemGroups,
  validateAndFix,
  optimizeLottie,
} from "@/lib/optimizer";

describe("roundDecimals", () => {
  it("returns null/undefined as-is", () => {
    expect(roundDecimals(null)).toBe(null);
    expect(roundDecimals(undefined)).toBe(undefined);
  });

  it("keeps integers unchanged", () => {
    expect(roundDecimals(42)).toBe(42);
  });

  it("rounds floats to default precision (3)", () => {
    expect(roundDecimals(1.23456)).toBe(1.235);
  });

  it("rounds floats to custom precision", () => {
    expect(roundDecimals(1.23456, 2)).toBe(1.23);
  });

  it("rounds arrays recursively", () => {
    expect(roundDecimals([1.23456, 2.34567])).toEqual([1.235, 2.346]);
  });

  it("rounds nested objects recursively", () => {
    expect(roundDecimals({ a: 1.23456, b: { c: 2.34567 } })).toEqual({
      a: 1.235,
      b: { c: 2.346 },
    });
  });

  it("returns non-number/non-object types as-is", () => {
    expect(roundDecimals("hello")).toBe("hello");
    expect(roundDecimals(true)).toBe(true);
    expect(roundDecimals(false)).toBe(false);
  });
});

describe("removeHiddenLayers", () => {
  it("removes hidden layers (hd=true)", () => {
    const data = { layers: [{ nm: "a", hd: true }, { nm: "b" }] };
    const result = removeHiddenLayers(data);
    expect(result.layers).toHaveLength(1);
    expect((result.layers as Record<string, any>[])[0].nm).toBe("b");
  });

  it("returns data unchanged when no layers array", () => {
    const result = removeHiddenLayers({ w: 100 });
    expect(result).toEqual({ w: 100 });
  });

  it("keeps all visible layers", () => {
    const data = { layers: [{ nm: "a", hd: false }, { nm: "b" }] };
    const result = removeHiddenLayers(data);
    expect(result.layers).toHaveLength(2);
  });
});

describe("removeEmptyGroups", () => {
  it("removes groups with only transform items", () => {
    const data = {
      layers: [{ shapes: [{ ty: "gr", it: [{ ty: "tr" }] }] }],
    };
    const result = removeEmptyGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes).toHaveLength(0);
  });

  it("keeps groups with real items", () => {
    const data = {
      layers: [{ shapes: [{ ty: "gr", it: [{ ty: "tr" }, { ty: "fl" }] }] }],
    };
    const result = removeEmptyGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes).toHaveLength(1);
  });

  it("keeps non-group shapes", () => {
    const data = { layers: [{ shapes: [{ ty: "fl" }] }] };
    const result = removeEmptyGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes).toHaveLength(1);
  });

  it("handles layers without shapes", () => {
    const data = { layers: [{ nm: "text" }] };
    const result = removeEmptyGroups(data);
    expect((result.layers as Record<string, any>[])[0]).toEqual({ nm: "text" });
  });

  it("returns data unchanged when no layers array", () => {
    expect(removeEmptyGroups({ w: 100 })).toEqual({ w: 100 });
  });

  it("keeps groups with no it array", () => {
    const data = { layers: [{ shapes: [{ ty: "gr" }] }] };
    const result = removeEmptyGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes).toHaveLength(1);
  });
});

describe("removeRedundantKeyframes", () => {
  it("returns data unchanged when no layers", () => {
    expect(removeRedundantKeyframes({ w: 100 })).toEqual({ w: 100 });
  });

  it("skips non-animated props (a!==1)", () => {
    const data = { layers: [{ ks: { p: { a: 0, k: [0, 0] } } }] };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toEqual([0, 0]);
  });

  it("keeps single keyframe unchanged", () => {
    const data = { layers: [{ ks: { p: { a: 1, k: [{ t: 0, s: [0], e: [100] }] } } }] };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toHaveLength(1);
  });

  it("keeps first keyframe when s !== e", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [100] },
              { t: 30, s: [100], e: [200] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toHaveLength(2);
  });

  it("keeps first keyframe when e is undefined", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toHaveLength(2);
  });

  // Lines 92-96: first keyframe no-op (s===e), next starts at same value → skip
  it("removes first keyframe no-op when next starts at same value", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [50], e: [50] },
              { t: 15, s: [50], e: [100] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    const kfs = (result.layers as Record<string, any>[])[0].ks.p.k;
    expect(kfs).toHaveLength(2);
    expect(kfs[0].t).toBe(15);
  });

  // Lines 92-96: first keyframe no-op but next starts at different value → keep
  it("keeps first keyframe no-op when next starts at different value", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [50], e: [50] },
              { t: 15, s: [75], e: [100] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    const kfs = (result.layers as Record<string, any>[])[0].ks.p.k;
    expect(kfs).toHaveLength(3);
    expect(kfs[0].t).toBe(0);
  });

  it("removes redundant middle keyframes (s===e)", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [50] },
              { t: 15, s: [50], e: [50] },
              { t: 30, s: [50] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    const kfs = (result.layers as Record<string, any>[])[0].ks.p.k;
    expect(kfs).toHaveLength(2);
  });

  it("keeps middle keyframes with e undefined", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [50] },
              { t: 15, s: [50] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toHaveLength(3);
  });

  it("keeps middle keyframes where s !== e", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [50] },
              { t: 15, s: [50], e: [100] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const result = removeRedundantKeyframes(data);
    expect((result.layers as Record<string, any>[])[0].ks.p.k).toHaveLength(3);
  });
});

describe("collapseSingleItemGroups", () => {
  it("collapses groups with single non-transform item", () => {
    const data = {
      layers: [{
        shapes: [{ ty: "gr", it: [{ ty: "fl", c: {} }, { ty: "tr" }] }],
      }],
    };
    const result = collapseSingleItemGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes[0].ty).toBe("fl");
  });

  it("keeps groups with multiple non-transform items", () => {
    const data = {
      layers: [{
        shapes: [{ ty: "gr", it: [{ ty: "fl" }, { ty: "st" }, { ty: "tr" }] }],
      }],
    };
    const result = collapseSingleItemGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes[0].ty).toBe("gr");
  });

  it("keeps non-group shapes", () => {
    const data = { layers: [{ shapes: [{ ty: "fl" }] }] };
    const result = collapseSingleItemGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes[0].ty).toBe("fl");
  });

  it("returns data unchanged when no layers", () => {
    expect(collapseSingleItemGroups({ w: 100 })).toEqual({ w: 100 });
  });

  it("handles layers without shapes", () => {
    const data = { layers: [{ nm: "text" }] };
    const result = collapseSingleItemGroups(data);
    expect(result.layers).toHaveLength(1);
  });

  it("keeps groups with no it array", () => {
    const data = { layers: [{ shapes: [{ ty: "gr" }] }] };
    const result = collapseSingleItemGroups(data);
    expect((result.layers as Record<string, any>[])[0].shapes[0].ty).toBe("gr");
  });
});

describe("validateAndFix", () => {
  it("auto-fixes missing ind/ip/op/ks", () => {
    const data = { ip: 0, op: 60, w: 512, h: 512, layers: [{ nm: "test" }] };
    const { fixed, fixesApplied } = validateAndFix(data);
    const layer = (fixed.layers as Record<string, any>[])[0];
    expect(layer.ind).toBe(0);
    expect(layer.ip).toBe(0);
    expect(layer.op).toBe(60);
    expect(layer.ks).toBeDefined();
    expect(fixesApplied.length).toBeGreaterThanOrEqual(4);
  });

  it("clamps ip below root ip", () => {
    const data = { ip: 10, op: 60, layers: [{ nm: "a", ip: 5, op: 30, ind: 0, ks: {} }] };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("Clamped ip"))).toBe(true);
  });

  it("clamps op above root op", () => {
    const data = { ip: 0, op: 60, layers: [{ nm: "a", ip: 0, op: 100, ind: 0, ks: {} }] };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("Clamped op"))).toBe(true);
  });

  it("normalizes shape fill colors 0-255 → 0-1", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "colored", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{ ty: "fl", c: { a: 0, k: [255, 128, 0, 1] } }],
      }],
    };
    const { fixed, fixesApplied } = validateAndFix(data);
    const c = (fixed.layers as Record<string, any>[])[0].shapes[0].c.k;
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(128 / 255);
    expect(c[2]).toBe(0);
    expect(fixesApplied.some((f) => f.includes("Normalized color"))).toBe(true);
  });

  it("normalizes stroke colors", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "stroked", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{ ty: "st", c: { a: 0, k: [200, 100, 50, 1] } }],
      }],
    };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("Normalized color"))).toBe(true);
  });

  it("warns about groups without fill/stroke", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "empty-group", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{ ty: "gr", it: [{ ty: "tr" }, { ty: "sh" }] }],
      }],
    };
    const { warnings } = validateAndFix(data);
    expect(warnings.some((w) => w.includes("no fill or stroke"))).toBe(true);
  });

  it("warns about zero-sized shapes", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "tiny", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{ ty: "rc", s: { a: 0, k: [0.5, 0.5] } }],
      }],
    };
    const { warnings } = validateAndFix(data);
    expect(warnings.some((w) => w.includes("Zero-sized"))).toBe(true);
  });

  // Lines 321-343: text layer fc/sc normalization
  it("normalizes text layer fill color (fc)", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "text-layer", ind: 0, ip: 0, op: 60, ks: {},
        t: { d: { k: [{ s: { fc: [255, 0, 128] } }] } },
      }],
    };
    const { fixed, fixesApplied } = validateAndFix(data);
    const fc = (fixed.layers as Record<string, any>[])[0].t.d.k[0].s.fc;
    expect(fc[0]).toBe(1);
    expect(fc[1]).toBe(0);
    expect(fc[2]).toBeCloseTo(128 / 255);
    expect(fixesApplied.some((f) => f.includes("text fill color"))).toBe(true);
  });

  it("normalizes text layer stroke color (sc)", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "text-layer", ind: 0, ip: 0, op: 60, ks: {},
        t: { d: { k: [{ s: { sc: [200, 150, 100] } }] } },
      }],
    };
    const { fixed, fixesApplied } = validateAndFix(data);
    const sc = (fixed.layers as Record<string, any>[])[0].t.d.k[0].s.sc;
    expect(sc[0]).toBeCloseTo(200 / 255);
    expect(fixesApplied.some((f) => f.includes("text stroke color"))).toBe(true);
  });

  it("skips text color normalization when values are already 0-1", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "text", ind: 0, ip: 0, op: 60, ks: {},
        t: { d: { k: [{ s: { fc: [1, 0.5, 0], sc: [0, 0, 0] } }] } },
      }],
    };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("text fill"))).toBe(false);
    expect(fixesApplied.some((f) => f.includes("text stroke"))).toBe(false);
  });

  it("warns about keyframes beyond op", () => {
    const data = {
      ip: 0, op: 30, layers: [{
        nm: "over", ind: 0, ip: 0, op: 30, ks: {
          p: { a: 1, k: [{ t: 0, s: [0] }, { t: 50, s: [100] }] },
        },
      }],
    };
    const { warnings } = validateAndFix(data);
    expect(warnings.some((w) => w.includes("beyond animation end"))).toBe(true);
  });

  it("handles nested group color fixes", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "nested", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{
          ty: "gr", it: [
            { ty: "fl", c: { a: 0, k: [255, 255, 255, 1] } },
            { ty: "gr", it: [{ ty: "st", c: { a: 0, k: [128, 64, 32, 1] } }] },
          ],
        }],
      }],
    };
    const { fixesApplied } = validateAndFix(data);
    const colorFixes = fixesApplied.filter((f) => f.includes("Normalized color"));
    expect(colorFixes.length).toBeGreaterThanOrEqual(2);
  });

  it("handles text data with s undefined in keyframe", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "text", ind: 0, ip: 0, op: 60, ks: {},
        t: { d: { k: [{ s: undefined }] } },
      }],
    };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("text"))).toBe(false);
  });

  it("handles missing root ip/op/w/h with defaults", () => {
    const data = { layers: [{ nm: "test" }] };
    const { fixed } = validateAndFix(data);
    const layer = (fixed.layers as Record<string, any>[])[0];
    expect(layer.ip).toBe(0);
    expect(layer.op).toBe(60);
    expect(layer.ks.p.k).toEqual([256, 256]);
  });

  it("handles no layers", () => {
    const { warnings, fixesApplied } = validateAndFix({ w: 100 });
    expect(warnings).toEqual([]);
    expect(fixesApplied).toEqual([]);
  });

  it("skips color fix when c.a is not 0 or undefined", () => {
    const data = {
      ip: 0, op: 60, layers: [{
        nm: "animated-color", ind: 0, ip: 0, op: 60, ks: {},
        shapes: [{ ty: "fl", c: { a: 1, k: [{ t: 0, s: [255, 0, 0] }] } }],
      }],
    };
    const { fixesApplied } = validateAndFix(data);
    expect(fixesApplied.some((f) => f.includes("Normalized color"))).toBe(false);
  });
});

describe("optimizeLottie", () => {
  it("runs full pipeline and returns stats", () => {
    const data = {
      w: 512, h: 512, ip: 0, op: 60, fr: 30,
      layers: [
        { nm: "visible", hd: false, shapes: [{ ty: "fl" }] },
        { nm: "hidden", hd: true, shapes: [{ ty: "fl" }] },
      ],
    };
    const { optimized, stats } = optimizeLottie(data);
    expect(stats.layersRemoved).toBe(1);
    expect(stats.originalSize).toBeGreaterThan(0);
    expect(stats.optimizedSize).toBeGreaterThan(0);
    expect(Array.isArray(optimized.layers)).toBe(true);
  });

  it("calculates keyframes removed", () => {
    const data = {
      layers: [{
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [50], e: [50] },
              { t: 15, s: [50], e: [100] },
              { t: 30, s: [100] },
            ],
          },
        },
      }],
    };
    const { stats } = optimizeLottie(data);
    expect(stats.keyframesRemoved).toBe(1);
  });

  it("calculates groups simplified", () => {
    const data = {
      layers: [{
        shapes: [{ ty: "gr", it: [{ ty: "fl" }, { ty: "tr" }] }],
      }],
    };
    const { stats } = optimizeLottie(data);
    expect(stats.groupsSimplified).toBe(1);
  });

  it("handles empty input", () => {
    const { optimized, stats } = optimizeLottie({});
    expect(stats.layersRemoved).toBe(0);
    expect(stats.keyframesRemoved).toBe(0);
    expect(stats.groupsSimplified).toBe(0);
    expect(optimized).toBeDefined();
  });
});
