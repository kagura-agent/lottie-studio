import { describe, it, expect } from "vitest";
import { drawAnimation, DrawOptions } from "@/lib/draw";

function makeLottie(layers: unknown[] = []) {
  return { w: 200, h: 200, ip: 0, op: 60, fr: 30, layers };
}

function makeShapeLayerWithStroke(opts: { ip?: number; op?: number } = {}) {
  return {
    ty: 4,
    ip: opts.ip ?? 0,
    op: opts.op ?? 60,
    ks: { p: { a: 0, k: [100, 100, 0] } },
    shapes: [
      { ty: "sh", ks: { a: 0, k: { c: true, v: [[0, 0], [100, 0], [100, 100]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] } } },
      { ty: "st", c: { a: 0, k: [1, 0, 0, 1] }, w: { a: 0, k: 2 } },
    ],
  };
}

function makeShapeLayerWithGradientStroke() {
  return {
    ty: 4,
    ip: 0,
    op: 60,
    ks: { p: { a: 0, k: [100, 100, 0] } },
    shapes: [
      { ty: "sh", ks: { a: 0, k: {} } },
      { ty: "gs", g: { k: { a: 0, k: [0, 1, 0, 0, 1, 0, 1, 0] } }, s: { a: 0, k: [0, 0] }, e: { a: 0, k: [100, 0] }, w: { a: 0, k: 3 } },
    ],
  };
}

function makeShapeLayerNoStroke() {
  return {
    ty: 4,
    ip: 0,
    op: 60,
    ks: { p: { a: 0, k: [100, 100, 0] } },
    shapes: [
      { ty: "sh", ks: { a: 0, k: {} } },
      { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
    ],
  };
}

function makeShapeLayerWithGroup() {
  return {
    ty: 4,
    ip: 0,
    op: 60,
    ks: { p: { a: 0, k: [100, 100, 0] } },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "sh", ks: { a: 0, k: {} } },
          { ty: "st", c: { a: 0, k: [0, 0, 1, 1] }, w: { a: 0, k: 1 } },
        ],
      },
    ],
  };
}

describe("drawAnimation", () => {
  it("returns unchanged animation when no layers", () => {
    const anim = makeLottie([]);
    const result = drawAnimation(anim);
    expect(result).toEqual(anim);
  });

  it("returns unchanged animation when no shape layers", () => {
    const anim = makeLottie([{ ty: 0, ip: 0, op: 60 }]);
    const result = drawAnimation(anim);
    expect(result).toEqual(anim);
  });

  it("returns unchanged animation when shape layers have no strokes", () => {
    const anim = makeLottie([makeShapeLayerNoStroke()]);
    const result = drawAnimation(anim);
    expect(result).toEqual(anim);
  });

  it("adds trim path to shape layer with stroke", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim) as any;
    const shapes = result.layers[0].shapes;
    const tm = shapes.find((s: any) => s.ty === "tm");
    expect(tm).toBeDefined();
    expect(tm.m).toBe(1);
  });

  it("animates end property by default (draw effect)", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.a).toBe(1);
    expect(tm.e.k).toHaveLength(2);
    expect(tm.e.k[0].s).toEqual([0]);
    expect(tm.e.k[1].s).toEqual([100]);
    expect(tm.s.a).toBe(0);
    expect(tm.s.k).toBe(0);
  });

  it("animates start property when reverse is true (erase effect)", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { reverse: true }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.s.a).toBe(1);
    expect(tm.s.k[0].s).toEqual([0]);
    expect(tm.s.k[1].s).toEqual([100]);
    expect(tm.e.a).toBe(0);
    expect(tm.e.k).toBe(100);
  });

  it("respects custom duration", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { duration: 2 }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[0].t).toBe(0);
    expect(tm.e.k[1].t).toBe(60); // 2s * 30fps
  });

  it("respects custom from/to", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { from: 25, to: 75 }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.s.k).toBe(25);
    expect(tm.e.k[0].s).toEqual([25]);
    expect(tm.e.k[1].s).toEqual([75]);
  });

  it("applies stagger offset to subsequent layers", () => {
    const anim = makeLottie([
      makeShapeLayerWithStroke({ ip: 0 }),
      makeShapeLayerWithStroke({ ip: 0 }),
      makeShapeLayerWithStroke({ ip: 0 }),
    ]);
    const result = drawAnimation(anim, { stagger: 200 }) as any;
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[1].ip).toBe(6); // 200ms * 30fps / 1000 = 6 frames
    expect(result.layers[2].ip).toBe(12);
  });

  it("uses ease-out easing by default", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[0].o.x).toEqual([0]);
    expect(tm.e.k[0].o.y).toEqual([0]);
    expect(tm.e.k[0].i.x).toEqual([0.58]);
    expect(tm.e.k[0].i.y).toEqual([1]);
  });

  it("applies linear easing", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { easing: "linear" }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[0].o.x).toEqual([0]);
    expect(tm.e.k[0].i.x).toEqual([1]);
  });

  it("applies bounce easing", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { easing: "bounce" }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[0].o.x).toEqual([0.34]);
    expect(tm.e.k[0].o.y).toEqual([1.56]);
  });

  it("works with gradient stroke layers", () => {
    const anim = makeLottie([makeShapeLayerWithGradientStroke()]);
    const result = drawAnimation(anim) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm).toBeDefined();
    expect(tm.e.a).toBe(1);
  });

  it("works with strokes inside groups", () => {
    const anim = makeLottie([makeShapeLayerWithGroup()]);
    const result = drawAnimation(anim) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm).toBeDefined();
  });

  it("replaces existing trim path", () => {
    const layer = makeShapeLayerWithStroke();
    (layer.shapes as any[]).push({ ty: "tm", s: { a: 0, k: 50 }, e: { a: 0, k: 50 }, o: { a: 0, k: 0 }, m: 1 });
    const anim = makeLottie([layer]);
    const result = drawAnimation(anim) as any;
    const tms = result.layers[0].shapes.filter((s: any) => s.ty === "tm");
    expect(tms).toHaveLength(1);
    expect(tms[0].e.a).toBe(1);
  });

  it("does not mutate original animation", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const original = JSON.parse(JSON.stringify(anim));
    drawAnimation(anim, { duration: 2 });
    expect(anim).toEqual(original);
  });

  it("uses animation frame rate for duration conversion", () => {
    const anim = { ...makeLottie([makeShapeLayerWithStroke()]), fr: 60 };
    const result = drawAnimation(anim, { duration: 1 }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[1].t).toBe(60); // 1s * 60fps
  });

  it("defaults fr to 30 if missing", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    delete (anim as any).fr;
    const result = drawAnimation(anim, { duration: 1 }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[1].t).toBe(30);
  });

  it("skips non-shape layers", () => {
    const anim = makeLottie([
      { ty: 0, ip: 0, op: 60 },
      makeShapeLayerWithStroke(),
      { ty: 1, ip: 0, op: 60 },
    ]);
    const result = drawAnimation(anim) as any;
    // Only the shape layer should get a trim path
    expect(result.layers[0].shapes).toBeUndefined();
    const tm = result.layers[1].shapes.find((s: any) => s.ty === "tm");
    expect(tm).toBeDefined();
    expect(result.layers[2].shapes).toBeUndefined();
  });

  it("falls back to ease-out for unknown easing", () => {
    const anim = makeLottie([makeShapeLayerWithStroke()]);
    const result = drawAnimation(anim, { easing: "unknown-curve" }) as any;
    const tm = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    expect(tm.e.k[0].i.x).toEqual([0.58]);
  });

  it("handles stagger with reverse", () => {
    const anim = makeLottie([
      makeShapeLayerWithStroke({ ip: 0 }),
      makeShapeLayerWithStroke({ ip: 0 }),
    ]);
    const result = drawAnimation(anim, { reverse: true, stagger: 100 }) as any;
    const tm0 = result.layers[0].shapes.find((s: any) => s.ty === "tm");
    const tm1 = result.layers[1].shapes.find((s: any) => s.ty === "tm");
    expect(tm0.s.k[0].t).toBe(0);
    expect(tm1.s.k[0].t).toBe(3); // 100ms * 30fps / 1000 = 3 frames
    expect(result.layers[1].ip).toBe(3);
  });
});
