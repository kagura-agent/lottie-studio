import { describe, it, expect } from "vitest";
import { createBlurEffect, applyBlurToLayers, LottieLayerWithEffects } from "../blur";

describe("createBlurEffect", () => {
  it("creates an 'in' blur (intensity→0) by default", () => {
    const effect = createBlurEffect({}) as { ty: number; nm: string; ef: { nm: string; v: { a: number; k: unknown } }[] };
    expect(effect.ty).toBe(29);
    expect(effect.nm).toBe("Gaussian Blur");
    expect(effect.ef[0].nm).toBe("Blurriness");
    expect(effect.ef[0].v.a).toBe(1);
    const kf = effect.ef[0].v.k as { s: number[]; e: number[] }[];
    expect(kf[0].s).toEqual([10]);
    expect(kf[0].e).toEqual([0]);
  });

  it("creates 'out' blur (0→intensity)", () => {
    const effect = createBlurEffect({ mode: "out", intensity: 20 }) as { ef: { v: { k: { s: number[]; e: number[] }[] } }[] };
    const kf = effect.ef[0].v.k;
    expect(kf[0].s).toEqual([0]);
    expect(kf[0].e).toEqual([20]);
  });

  it("creates 'pulse' blur (0→intensity→0)", () => {
    const effect = createBlurEffect({ mode: "pulse", intensity: 15 }, 0, 60) as { ef: { v: { a: number; k: { s: number[]; e: number[]; t: number }[] } }[] };
    const kf = effect.ef[0].v.k;
    expect(kf).toHaveLength(3);
    expect(kf[0].s).toEqual([0]);
    expect(kf[0].e).toEqual([15]);
    expect(kf[0].t).toBe(0);
    expect(kf[1].s).toEqual([15]);
    expect(kf[1].e).toEqual([0]);
    expect(kf[1].t).toBe(30);
    expect(kf[2].t).toBe(60);
  });

  it("creates 'static' blur (constant value)", () => {
    const effect = createBlurEffect({ mode: "static", intensity: 5 }) as { ef: { v: { a: number; k: number } }[] };
    expect(effect.ef[0].v.a).toBe(0);
    expect(effect.ef[0].v.k).toBe(5);
  });

  it("respects custom intensity", () => {
    const effect = createBlurEffect({ intensity: 25 }) as { ef: { v: { k: { s: number[] }[] } }[] };
    expect(effect.ef[0].v.k[0].s).toEqual([25]);
  });

  it("includes Blur Dimensions and Repeat Edge Pixels sub-effects", () => {
    const effect = createBlurEffect({}) as { ef: { ty: number; nm: string; v: { a: number; k: number } }[] };
    expect(effect.ef[1]).toEqual({ ty: 7, nm: "Blur Dimensions", v: { a: 0, k: 1 } });
    expect(effect.ef[2]).toEqual({ ty: 7, nm: "Repeat Edge Pixels", v: { a: 0, k: 1 } });
  });
});

describe("applyBlurToLayers", () => {
  it("applies blur to all layers when no layer filter", () => {
    const layers: LottieLayerWithEffects[] = [{ nm: "A" }, { nm: "B" }];
    const modified = applyBlurToLayers(layers, {});
    expect(modified).toEqual(["A", "B"]);
    expect(layers[0].ef).toHaveLength(1);
    expect(layers[1].ef).toHaveLength(1);
  });

  it("applies blur only to matching layer", () => {
    const layers: LottieLayerWithEffects[] = [{ nm: "A" }, { nm: "B" }];
    const modified = applyBlurToLayers(layers, { layer: "B" });
    expect(modified).toEqual(["B"]);
    expect(layers[0].ef).toBeUndefined();
    expect(layers[1].ef).toHaveLength(1);
  });

  it("appends to existing ef array", () => {
    const existing = { ty: 5, nm: "Other" };
    const layers: LottieLayerWithEffects[] = [{ nm: "L", ef: [existing] }];
    applyBlurToLayers(layers, {});
    expect(layers[0].ef).toHaveLength(2);
    expect(layers[0].ef![0]).toBe(existing);
  });

  it("uses default intensity 10 and mode 'in'", () => {
    const layers: LottieLayerWithEffects[] = [{ nm: "X" }];
    applyBlurToLayers(layers, {});
    const effect = layers[0].ef![0] as { ef: { v: { a: number; k: { s: number[]; e: number[] }[] } }[] };
    expect(effect.ef[0].v.a).toBe(1);
    expect(effect.ef[0].v.k[0].s).toEqual([10]);
    expect(effect.ef[0].v.k[0].e).toEqual([0]);
  });

  it("returns empty array when no layers match filter", () => {
    const layers: LottieLayerWithEffects[] = [{ nm: "A" }];
    const modified = applyBlurToLayers(layers, { layer: "Z" });
    expect(modified).toEqual([]);
  });
});
