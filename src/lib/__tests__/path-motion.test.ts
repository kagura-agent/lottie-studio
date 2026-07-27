import { describe, it, expect } from "vitest";
import { applyPathMotion, parseSvgPath, VALID_PATH_SHAPES } from "../path-motion";

function makeAnim(overrides: Record<string, unknown> = {}) {
  return {
    fr: 30,
    ip: 0,
    op: 90,
    w: 512,
    h: 512,
    layers: [
      { ty: 4, nm: "Shape", ind: 1, ip: 0, op: 90, ks: { p: { a: 0, k: [256, 256, 0] } } },
    ],
    ...overrides,
  };
}

describe("applyPathMotion", () => {
  describe("circle", () => {
    it("creates a null wrapper with circular position keyframes", () => {
      const result = applyPathMotion(makeAnim(), "circle", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers[0].ty).toBe(3);
      expect(layers[0].nm).toBe("Path Motion Wrapper");
      expect(layers[0].ind).toBe(0);
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number; k: unknown[] };
      expect(p.a).toBe(1);
      expect(p.k.length).toBe(5);
    });

    it("respects radius option", () => {
      const result = applyPathMotion(makeAnim(), "circle", { radius: 100 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number; k: Array<{ s: number[] }> };
      const firstKf = p.k[0];
      expect(firstKf.s[0]).toBeCloseTo(256 + 100);
    });

    it("respects counterclockwise option", () => {
      const cw = applyPathMotion(makeAnim(), "circle", { clockwise: true }) as Record<string, unknown>;
      const ccw = applyPathMotion(makeAnim(), "circle", { clockwise: false }) as Record<string, unknown>;
      const cwLayers = cw.layers as Array<Record<string, unknown>>;
      const ccwLayers = ccw.layers as Array<Record<string, unknown>>;
      const cwP = (cwLayers[0].ks as Record<string, unknown>).p as { k: Array<{ s: number[] }> };
      const ccwP = (ccwLayers[0].ks as Record<string, unknown>).p as { k: Array<{ s: number[] }> };
      // Second point should be opposite Y direction
      expect(cwP.k[1].s[1]).toBeGreaterThan(256);
      expect(ccwP.k[1].s[1]).toBeLessThan(256);
    });

    it("uses spatial bezier tangents (ti/to)", () => {
      const result = applyPathMotion(makeAnim(), "circle", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ to?: number[]; ti?: number[] }> };
      expect(p.k[0].to).toBeDefined();
      expect(p.k[0].ti).toBeDefined();
    });
  });

  describe("wave", () => {
    it("generates wave keyframes", () => {
      const result = applyPathMotion(makeAnim(), "wave", { frequency: 2, amplitude: 40 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number; k: unknown[] };
      expect(p.a).toBe(1);
      expect(p.k.length).toBe(2 * 4 + 1);
    });

    it("uses amplitude for y-offset", () => {
      const result = applyPathMotion(makeAnim(), "wave", { amplitude: 80, frequency: 1 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      const yValues = p.k.map(kf => kf.s[1]);
      const maxDeviation = Math.max(...yValues.map(y => Math.abs(y - 256)));
      expect(maxDeviation).toBeGreaterThan(0);
      expect(maxDeviation).toBeLessThanOrEqual(80 + 1);
    });
  });

  describe("spiral", () => {
    it("generates spiral keyframes with increasing radius", () => {
      const result = applyPathMotion(makeAnim(), "spiral", { radius: 100, frequency: 2 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      // First point should be at center (radius=0)
      expect(p.k[0].s[0]).toBeCloseTo(256);
      expect(p.k[0].s[1]).toBeCloseTo(256);
      // Last point should be far from center
      const last = p.k[p.k.length - 1];
      const dist = Math.sqrt((last.s[0] - 256) ** 2 + (last.s[1] - 256) ** 2);
      expect(dist).toBeGreaterThan(50);
    });
  });

  describe("figure-8", () => {
    it("generates figure-8 keyframes", () => {
      const result = applyPathMotion(makeAnim(), "figure-8", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: unknown[] };
      expect(p.k.length).toBe(17);
    });

    it("starts and ends at same position (closed loop)", () => {
      const result = applyPathMotion(makeAnim(), "figure-8", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      expect(p.k[0].s[0]).toBeCloseTo(p.k[p.k.length - 1].s[0], 0);
      expect(p.k[0].s[1]).toBeCloseTo(p.k[p.k.length - 1].s[1], 0);
    });
  });

  describe("arc", () => {
    it("generates arc keyframes", () => {
      const result = applyPathMotion(makeAnim(), "arc", { radius: 80 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: unknown[] };
      expect(p.k.length).toBe(9);
    });
  });

  describe("zigzag", () => {
    it("generates zigzag with sharp corners (zero tangents)", () => {
      const result = applyPathMotion(makeAnim(), "zigzag", { frequency: 3 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ to?: number[]; ti?: number[] }> };
      // Zigzag uses zero tangents
      expect(p.k[0].to).toEqual([0, 0, 0]);
      expect(p.k[0].ti).toEqual([0, 0, 0]);
    });

    it("alternates y values", () => {
      const result = applyPathMotion(makeAnim(), "zigzag", { frequency: 2, amplitude: 60 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      const y0 = p.k[0].s[1];
      const y1 = p.k[1].s[1];
      expect(y0).not.toBeCloseTo(y1);
    });
  });

  describe("pendulum", () => {
    it("generates pendulum keyframes", () => {
      const result = applyPathMotion(makeAnim(), "pendulum", { frequency: 2 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: unknown[] };
      expect(p.k.length).toBe(2 * 4 + 1);
    });
  });

  describe("custom SVG path", () => {
    it("parses and applies custom SVG path", () => {
      const result = applyPathMotion(makeAnim(), "custom", {
        svgPath: "M10,10 L100,100 L200,50",
      }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      expect(p.k.length).toBe(3);
      expect(p.k[0].s[0]).toBe(10);
      expect(p.k[0].s[1]).toBe(10);
      expect(p.k[2].s[0]).toBe(200);
      expect(p.k[2].s[1]).toBe(50);
    });

    it("handles cubic bezier SVG commands", () => {
      const result = applyPathMotion(makeAnim(), "custom", {
        svgPath: "M0,0 C50,0 50,100 100,100",
      }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[]; to?: number[] }> };
      expect(p.k.length).toBe(2);
      expect(p.k[0].to).toBeDefined();
    });

    it("falls back to center if path has less than 2 points", () => {
      const result = applyPathMotion(makeAnim(), "custom", { svgPath: "M10,10" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      expect(p.k.length).toBe(1);
      expect(p.k[0].s[0]).toBe(256);
    });
  });

  describe("options", () => {
    it("applies duration option", () => {
      const result = applyPathMotion(makeAnim(), "circle", { duration: 1 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ t: number }> };
      const lastKf = p.k[p.k.length - 1];
      expect(lastKf.t).toBe(30);
    });

    it("applies from/to frame range", () => {
      const result = applyPathMotion(makeAnim(), "circle", { from: 10, to: 50 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ t: number }> };
      expect(p.k[0].t).toBe(10);
      expect(p.k[p.k.length - 1].t).toBe(50);
    });

    it("applies center option", () => {
      const result = applyPathMotion(makeAnim(), "circle", { center: [100, 100], radius: 50 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ s: number[] }> };
      expect(p.k[0].s[0]).toBeCloseTo(150);
      expect(p.k[0].s[1]).toBeCloseTo(100);
    });

    it("applies loops option", () => {
      const result = applyPathMotion(makeAnim(), "circle", { loops: 2 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: unknown[] };
      // 2 loops: each has 4 points + 1 closing, minus 1 overlap = 9
      expect(p.k.length).toBe(9);
    });

    it("applies easing preset", () => {
      const result = applyPathMotion(makeAnim(), "circle", { easing: "ease-in-out" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ o?: { x: number[] } }> };
      expect(p.k[0].o?.x[0]).toBe(0.42);
    });

    it("defaults easing to linear", () => {
      const result = applyPathMotion(makeAnim(), "circle", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { k: Array<{ o?: { x: number[] } }> };
      expect(p.k[0].o?.x[0]).toBe(0);
    });
  });

  describe("orient (auto-orient rotation)", () => {
    it("generates rotation keyframes when orient is true", () => {
      const result = applyPathMotion(makeAnim(), "circle", { orient: true }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const r = ks.r as { a: number; k: unknown[] };
      expect(r.a).toBe(1);
      expect(r.k.length).toBe(5);
    });

    it("does not generate rotation keyframes when orient is false", () => {
      const result = applyPathMotion(makeAnim(), "circle", { orient: false }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      const r = ks.r as { a: number; k: number };
      expect(r.a).toBe(0);
    });
  });

  describe("layer targeting", () => {
    it("applies to specific layer by name", () => {
      const result = applyPathMotion(makeAnim(), "circle", { layer: "Shape" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      // No wrapper layer added
      expect(layers.length).toBe(1);
      expect(layers[0].nm).toBe("Shape");
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number };
      expect(p.a).toBe(1);
    });

    it("applies to specific layer by index", () => {
      const result = applyPathMotion(makeAnim(), "circle", { layer: 1 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers.length).toBe(1);
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number };
      expect(p.a).toBe(1);
    });

    it("creates wrapper when no --layer specified", () => {
      const result = applyPathMotion(makeAnim(), "circle", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers.length).toBe(2);
      expect(layers[0].ty).toBe(3);
      expect(layers[1].parent).toBe(0);
      expect(layers[1].ind).toBe(2);
    });

    it("does nothing if layer not found by name", () => {
      const result = applyPathMotion(makeAnim(), "circle", { layer: "NonExistent" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers.length).toBe(1);
      const ks = layers[0].ks as Record<string, unknown>;
      const p = ks.p as { a: number; k: number[] };
      expect(p.a).toBe(0);
    });
  });

  describe("null wrapper behavior", () => {
    it("shifts existing layer indices up", () => {
      const anim = makeAnim({
        layers: [
          { ty: 4, nm: "A", ind: 0, ip: 0, op: 90, ks: {} },
          { ty: 4, nm: "B", ind: 1, ip: 0, op: 90, ks: {}, parent: 0 },
        ],
      });
      const result = applyPathMotion(anim, "circle", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers[0].ind).toBe(0);
      expect(layers[0].ty).toBe(3);
      expect(layers[1].ind).toBe(1);
      expect(layers[1].parent).toBe(0);
      expect(layers[2].ind).toBe(2);
      expect(layers[2].parent).toBe(1);
    });
  });
});

describe("parseSvgPath", () => {
  it("parses M and L commands", () => {
    const pts = parseSvgPath("M10,20 L30,40 L50,60");
    expect(pts.length).toBe(3);
    expect(pts[0]).toEqual({ x: 10, y: 20 });
    expect(pts[1]).toEqual({ x: 30, y: 40 });
    expect(pts[2]).toEqual({ x: 50, y: 60 });
  });

  it("parses C commands with control points", () => {
    const pts = parseSvgPath("M0,0 C10,0 20,10 20,20");
    expect(pts.length).toBe(2);
    expect(pts[0].cpOut).toEqual({ x: 10, y: 0 });
    expect(pts[1].cpIn).toEqual({ x: 0, y: -10 });
  });

  it("parses Q commands (quadratic → cubic)", () => {
    const pts = parseSvgPath("M0,0 Q50,50 100,0");
    expect(pts.length).toBe(2);
    expect(pts[0].cpOut).toBeDefined();
    expect(pts[1].cpIn).toBeDefined();
  });

  it("handles relative commands", () => {
    const pts = parseSvgPath("M10,10 l20,20 l30,30");
    expect(pts.length).toBe(3);
    expect(pts[1]).toEqual({ x: 30, y: 30 });
    expect(pts[2]).toEqual({ x: 60, y: 60 });
  });

  it("handles Z command", () => {
    const pts = parseSvgPath("M10,10 L20,20 Z L30,30");
    expect(pts.length).toBe(3);
    expect(pts[2]).toEqual({ x: 30, y: 30 });
  });

  it("returns empty for empty string", () => {
    const pts = parseSvgPath("");
    expect(pts.length).toBe(0);
  });

  it("parses relative cubic", () => {
    const pts = parseSvgPath("M0,0 c10,0 20,10 20,20");
    expect(pts.length).toBe(2);
    expect(pts[1].x).toBe(20);
    expect(pts[1].y).toBe(20);
    expect(pts[0].cpOut).toEqual({ x: 10, y: 0 });
  });

  it("parses relative quadratic", () => {
    const pts = parseSvgPath("M0,0 q50,50 100,0");
    expect(pts.length).toBe(2);
    expect(pts[1].x).toBe(100);
    expect(pts[1].y).toBe(0);
  });
});

describe("VALID_PATH_SHAPES", () => {
  it("contains all expected shapes", () => {
    expect(VALID_PATH_SHAPES).toContain("circle");
    expect(VALID_PATH_SHAPES).toContain("wave");
    expect(VALID_PATH_SHAPES).toContain("spiral");
    expect(VALID_PATH_SHAPES).toContain("figure-8");
    expect(VALID_PATH_SHAPES).toContain("arc");
    expect(VALID_PATH_SHAPES).toContain("zigzag");
    expect(VALID_PATH_SHAPES).toContain("pendulum");
    expect(VALID_PATH_SHAPES).toContain("custom");
  });
});

describe("edge cases", () => {
  it("handles animation with no layers", () => {
    const anim = { fr: 30, ip: 0, op: 90, w: 512, h: 512 };
    const result = applyPathMotion(anim, "circle", {}) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    expect(layers.length).toBe(1);
    expect(layers[0].ty).toBe(3);
  });

  it("handles animation with empty layers array", () => {
    const anim = { fr: 30, ip: 0, op: 90, w: 512, h: 512, layers: [] };
    const result = applyPathMotion(anim, "circle", {}) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    expect(layers.length).toBe(1);
  });

  it("handles unknown easing gracefully (falls back to linear)", () => {
    const result = applyPathMotion(makeAnim(), "circle", { easing: "nonexistent" }) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as { k: Array<{ o?: { x: number[] } }> };
    expect(p.k[0].o?.x[0]).toBe(0);
  });

  it("defaults radius to 25% of min dimension", () => {
    const anim = { fr: 30, ip: 0, op: 90, w: 200, h: 400, layers: [] };
    const result = applyPathMotion(anim, "circle", {}) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as { k: Array<{ s: number[] }> };
    // radius = 200 * 0.25 = 50, center = 100,200
    expect(p.k[0].s[0]).toBeCloseTo(100 + 50);
  });

  it("orient on targeted layer adds rotation", () => {
    const result = applyPathMotion(makeAnim(), "wave", { layer: "Shape", orient: true }) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    const ks = layers[0].ks as Record<string, unknown>;
    expect((ks.r as { a: number }).a).toBe(1);
  });
});
