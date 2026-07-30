import { describe, it, expect } from "vitest";
import { createShadowStyle, applyShadowToLayers, LottieLayerWithStyles } from "../shadow";

describe("createShadowStyle", () => {
  it("creates a drop shadow with defaults", () => {
    const style = createShadowStyle({});
    expect(style.ty).toBe(1);
    expect(style.c).toEqual({ a: 0, k: [0, 0, 0, 1] });
    expect(style.o).toEqual({ a: 0, k: 60 });
    expect(style.s).toEqual({ a: 0, k: 8 });
    expect(style.d).toEqual({ a: 0, k: 5 });
    expect(style.a).toEqual({ a: 0, k: 135 });
  });

  it("creates an inner shadow (ty:2)", () => {
    const style = createShadowStyle({ type: "inner" });
    expect(style.ty).toBe(2);
    expect(style.o).toEqual({ a: 0, k: 50 });
  });

  it("creates a glow (drop shadow with distance 0)", () => {
    const style = createShadowStyle({ type: "glow" });
    expect(style.ty).toBe(1);
    expect(style.d).toEqual({ a: 0, k: 0 });
    expect(style.c).toEqual({ a: 0, k: [1, 1, 1, 1] });
    expect(style.o).toEqual({ a: 0, k: 75 });
  });

  it("respects custom options", () => {
    const style = createShadowStyle({ color: "#ff0000", opacity: 80, blur: 20, distance: 10, angle: 90 });
    expect(style.c).toEqual({ a: 0, k: [1, 0, 0, 1] });
    expect(style.o).toEqual({ a: 0, k: 80 });
    expect(style.s).toEqual({ a: 0, k: 20 });
    expect(style.d).toEqual({ a: 0, k: 10 });
    expect(style.a).toEqual({ a: 0, k: 90 });
  });

  it("animates blur when animated is true", () => {
    const style = createShadowStyle({ animated: true, blur: 10 }, 0);
    expect(style.s.a).toBe(1);
    expect(Array.isArray(style.s.k)).toBe(true);
    const kf = style.s.k as { t: number; s: number[] }[];
    expect(kf[0].t).toBe(0);
    expect(kf[0].s).toEqual([0]);
    expect(kf[1].t).toBe(15);
    expect(kf[1].s).toEqual([10]);
  });
});

describe("applyShadowToLayers", () => {
  it("applies shadow to all layers", () => {
    const layers: LottieLayerWithStyles[] = [
      { nm: "Layer 1" },
      { nm: "Layer 2" },
    ];
    const modified = applyShadowToLayers(layers, {});
    expect(modified).toEqual(["Layer 1", "Layer 2"]);
    expect(layers[0].sy).toHaveLength(1);
    expect(layers[1].sy).toHaveLength(1);
  });

  it("filters by layer name", () => {
    const layers: LottieLayerWithStyles[] = [
      { nm: "Target" },
      { nm: "Other" },
    ];
    const modified = applyShadowToLayers(layers, { layer: "Target" });
    expect(modified).toEqual(["Target"]);
    expect(layers[0].sy).toHaveLength(1);
    expect(layers[1].sy).toBeUndefined();
  });

  it("returns empty array when no layers match", () => {
    const layers: LottieLayerWithStyles[] = [{ nm: "A" }];
    const modified = applyShadowToLayers(layers, { layer: "NonExistent" });
    expect(modified).toEqual([]);
  });

  it("appends to existing sy array", () => {
    const existing = { ty: 1, c: { a: 0, k: [0, 0, 0, 1] }, o: { a: 0, k: 50 }, a: { a: 0, k: 0 }, s: { a: 0, k: 5 }, d: { a: 0, k: 3 } };
    const layers: LottieLayerWithStyles[] = [{ nm: "L", sy: [existing as unknown] }];
    applyShadowToLayers(layers, {});
    expect(layers[0].sy).toHaveLength(2);
  });
});
