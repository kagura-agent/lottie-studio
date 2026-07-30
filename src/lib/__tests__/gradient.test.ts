import { describe, it, expect } from "vitest";
import {
  createGradientShape,
  applyGradientToLayer,
  generateGradientAnimation,
  LottieLayer,
  VALID_GRADIENT_TYPES,
  VALID_GRADIENT_PRESETS,
  VALID_GRADIENT_MODES,
} from "../gradient";

describe("constants", () => {
  it("exports valid gradient types", () => {
    expect(VALID_GRADIENT_TYPES).toEqual(["linear", "radial"]);
  });

  it("exports valid gradient presets", () => {
    expect(VALID_GRADIENT_PRESETS).toContain("shimmer");
    expect(VALID_GRADIENT_PRESETS).toContain("sunset");
    expect(VALID_GRADIENT_PRESETS).toContain("rainbow");
    expect(VALID_GRADIENT_PRESETS).toContain("aurora");
    expect(VALID_GRADIENT_PRESETS).toContain("pulse");
  });

  it("exports valid gradient modes", () => {
    expect(VALID_GRADIENT_MODES).toEqual(["fill", "stroke"]);
  });
});

describe("createGradientShape", () => {
  it("creates a linear gradient fill by default", () => {
    const shape = createGradientShape({}, 90);
    expect(shape.ty).toBe("gf");
    expect(shape.t).toBe(1);
    expect(shape.nm).toBe("Gradient Fill");
    expect(shape.g.p).toBeGreaterThan(0);
    expect(shape.w).toBeUndefined();
  });

  it("creates a radial gradient", () => {
    const shape = createGradientShape({ type: "radial" }, 90);
    expect(shape.t).toBe(2);
    expect(shape.s.k).toEqual([256, 256]);
  });

  it("creates a gradient stroke with width", () => {
    const shape = createGradientShape({ mode: "stroke" }, 90);
    expect(shape.ty).toBe("gs");
    expect(shape.nm).toBe("Gradient Stroke");
    expect(shape.w).toBeDefined();
    expect(shape.w!.k).toBe(4);
  });

  it("uses preset colors", () => {
    const shape = createGradientShape({ preset: "sunset" }, 90);
    expect(shape.g.p).toBe(3);
  });

  it("uses custom colors", () => {
    const shape = createGradientShape({ colors: ["#ff0000", "#00ff00"] }, 90);
    expect(shape.g.p).toBe(2);
  });

  it("animates color stops when speed > 0", () => {
    const shape = createGradientShape({ speed: 2 }, 90);
    expect(shape.g.k.a).toBe(1);
    expect(Array.isArray(shape.g.k.k)).toBe(true);
  });

  it("static color stops when speed is 0", () => {
    const shape = createGradientShape({ speed: 0 }, 90);
    expect(shape.g.k.a).toBe(0);
    expect(Array.isArray(shape.g.k.k)).toBe(true);
  });

  it("respects angle for linear gradient", () => {
    const shape = createGradientShape({ angle: 45, speed: 0 }, 90);
    expect(shape.s.a).toBe(0);
    expect(shape.e.a).toBe(0);
  });

  it("uses rainbow preset with 6 colors", () => {
    const shape = createGradientShape({ preset: "rainbow" }, 90);
    expect(shape.g.p).toBe(6);
  });

  it("uses aurora preset with 4 colors", () => {
    const shape = createGradientShape({ preset: "aurora" }, 90);
    expect(shape.g.p).toBe(4);
  });
});

describe("applyGradientToLayer", () => {
  it("applies gradient to shape layers (ty:4)", () => {
    const layers: LottieLayer[] = [
      { nm: "Shape 1", ty: 4, shapes: [] },
      { nm: "Shape 2", ty: 4, shapes: [] },
    ];
    const modified = applyGradientToLayer(layers, {}, 90);
    expect(modified).toEqual(["Shape 1", "Shape 2"]);
    expect(layers[0].shapes).toHaveLength(1);
    expect(layers[1].shapes).toHaveLength(1);
  });

  it("skips non-shape layers", () => {
    const layers: LottieLayer[] = [
      { nm: "Solid", ty: 1 },
      { nm: "Shape", ty: 4, shapes: [] },
    ];
    const modified = applyGradientToLayer(layers, {}, 90);
    expect(modified).toEqual(["Shape"]);
  });

  it("filters by layer name", () => {
    const layers: LottieLayer[] = [
      { nm: "Target", ty: 4, shapes: [] },
      { nm: "Other", ty: 4, shapes: [] },
    ];
    const modified = applyGradientToLayer(layers, { layer: "Target" }, 90);
    expect(modified).toEqual(["Target"]);
    expect(layers[0].shapes).toHaveLength(1);
    expect(layers[1].shapes).toHaveLength(0);
  });

  it("returns empty array when no layers match", () => {
    const layers: LottieLayer[] = [{ nm: "A", ty: 4, shapes: [] }];
    const modified = applyGradientToLayer(layers, { layer: "NonExistent" }, 90);
    expect(modified).toEqual([]);
  });

  it("returns empty array when no shape layers exist", () => {
    const layers: LottieLayer[] = [{ nm: "Solid", ty: 1 }];
    const modified = applyGradientToLayer(layers, {}, 90);
    expect(modified).toEqual([]);
  });

  it("creates shapes array if missing", () => {
    const layers: LottieLayer[] = [{ nm: "Shape", ty: 4 }];
    applyGradientToLayer(layers, {}, 90);
    expect(layers[0].shapes).toHaveLength(1);
  });

  it("prepends gradient to existing shapes", () => {
    const existing = { ty: "fl", nm: "Fill" };
    const layers: LottieLayer[] = [{ nm: "Shape", ty: 4, shapes: [existing] }];
    applyGradientToLayer(layers, {}, 90);
    expect(layers[0].shapes).toHaveLength(2);
    expect((layers[0].shapes![0] as { ty: string }).ty).toBe("gf");
  });
});

describe("generateGradientAnimation", () => {
  it("creates a valid animation structure", () => {
    const anim = generateGradientAnimation({});
    expect(anim.v).toBe("5.7.1");
    expect(anim.fr).toBe(30);
    expect(anim.w).toBe(512);
    expect(anim.h).toBe(512);
    expect(anim.ip).toBe(0);
    expect(anim.op).toBe(90);
    expect(Array.isArray(anim.layers)).toBe(true);
    expect((anim.layers as unknown[]).length).toBe(1);
  });

  it("respects custom duration", () => {
    const anim = generateGradientAnimation({ duration: 5 });
    expect(anim.op).toBe(150);
  });

  it("creates layer with gradient and rectangle shapes", () => {
    const anim = generateGradientAnimation({});
    const layer = (anim.layers as { shapes: unknown[] }[])[0];
    expect(layer.shapes.length).toBe(2);
    expect((layer.shapes[0] as { ty: string }).ty).toBe("rc");
    expect((layer.shapes[1] as { ty: string }).ty).toBe("gf");
  });

  it("uses preset when specified", () => {
    const anim = generateGradientAnimation({ preset: "rainbow" });
    const layer = (anim.layers as { shapes: { g?: { p: number } }[] }[])[0];
    const gradShape = layer.shapes[1];
    expect(gradShape.g!.p).toBe(6);
  });

  it("creates radial gradient when type is radial", () => {
    const anim = generateGradientAnimation({ type: "radial" });
    const layer = (anim.layers as { shapes: { t?: number }[] }[])[0];
    expect(layer.shapes[1].t).toBe(2);
  });

  it("creates stroke gradient", () => {
    const anim = generateGradientAnimation({ mode: "stroke" });
    const layer = (anim.layers as { shapes: { ty?: string }[] }[])[0];
    expect(layer.shapes[1].ty).toBe("gs");
  });
});
