import { describe, it, expect } from "vitest";

// Test the layer context extraction logic (mirrored from ChatPanel)
function extractLayerContext(animationData: object | null | undefined, layerIndex: number | null | undefined): object | null {
  if (layerIndex == null || !animationData) return null;
  const layers = (animationData as Record<string, unknown>).layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !layers[layerIndex]) return null;
  const layer = layers[layerIndex];
  const typeNames: Record<number, string> = { 0: "Precomp", 1: "Solid", 2: "Image", 3: "Null", 4: "Shape", 5: "Text" };
  const ks = layer.ks as Record<string, unknown> | undefined;
  const pos = ks?.p as { k?: unknown } | undefined;
  const opacity = ks?.o as { a?: number; k?: unknown } | undefined;
  const scale = ks?.s as { k?: unknown } | undefined;
  const rotation = ks?.r as { a?: number; k?: unknown } | undefined;

  return {
    name: layer.nm || `Layer ${layerIndex}`,
    type: typeNames[(layer.ty as number)] || "Unknown",
    index: layerIndex,
    inPoint: layer.ip,
    outPoint: layer.op,
    position: pos?.k,
    opacity: opacity?.a === 1 ? "animated" : opacity?.k,
    scale: scale?.k,
    rotation: rotation?.a === 1 ? "animated" : rotation?.k,
  };
}

describe("extractLayerContext", () => {
  const sampleAnimation = {
    v: "5.7.1",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      {
        nm: "Background",
        ty: 4,
        ip: 0,
        op: 60,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [256, 256, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
      },
      {
        nm: "Circle",
        ty: 4,
        ip: 0,
        op: 60,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [100] }] },
          p: { a: 0, k: [128, 128, 0] },
          s: { a: 0, k: [50, 50, 100] },
          r: { a: 0, k: 45 },
        },
      },
    ],
  };

  it("returns null when layerIndex is null", () => {
    expect(extractLayerContext(sampleAnimation, null)).toBeNull();
  });

  it("returns null when animationData is null", () => {
    expect(extractLayerContext(null, 0)).toBeNull();
  });

  it("returns null for out-of-bounds index", () => {
    expect(extractLayerContext(sampleAnimation, 99)).toBeNull();
  });

  it("extracts static layer metadata", () => {
    const ctx = extractLayerContext(sampleAnimation, 0);
    expect(ctx).toEqual({
      name: "Background",
      type: "Shape",
      index: 0,
      inPoint: 0,
      outPoint: 60,
      position: [256, 256, 0],
      opacity: 100,
      scale: [100, 100, 100],
      rotation: 0,
    });
  });

  it("marks animated opacity as 'animated'", () => {
    const ctx = extractLayerContext(sampleAnimation, 1) as Record<string, unknown>;
    expect(ctx.opacity).toBe("animated");
  });

  it("uses fallback name when nm is missing", () => {
    const anim = { layers: [{ ty: 1, ip: 0, op: 30, ks: {} }] };
    const ctx = extractLayerContext(anim, 0) as Record<string, unknown>;
    expect(ctx.name).toBe("Layer 0");
  });
});
