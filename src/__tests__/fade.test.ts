import { describe, it, expect } from "vitest";
import { applyFade, VALID_FADE_MODES } from "@/lib/fade";

function makeAnim(layers?: Array<Record<string, unknown>>, fr = 30, ip = 0, op = 60): Record<string, unknown> {
  return {
    fr,
    ip,
    op,
    layers: layers ?? [
      { nm: "Layer 1", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 100 } } },
      { nm: "Layer 2", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 100 } } },
    ],
  };
}

function getOpacity(layer: Record<string, unknown>): Record<string, unknown> {
  return (layer.ks as Record<string, unknown>).o as Record<string, unknown>;
}

describe("fade", () => {
  describe("VALID_FADE_MODES", () => {
    it("exports valid modes", () => {
      expect(VALID_FADE_MODES).toEqual(["in", "out", "in-out", "pulse"]);
    });
  });

  describe("fade in", () => {
    it("animates opacity from 0 to 100", () => {
      const result = applyFade(makeAnim(), { mode: "in" });
      const layers = result.layers as Array<Record<string, unknown>>;
      for (const layer of layers) {
        const o = getOpacity(layer);
        expect(o.a).toBe(1);
        const kfs = o.k as Array<Record<string, unknown>>;
        expect(kfs.length).toBe(2);
        expect((kfs[0].s as number[])[0]).toBe(0);
        expect((kfs[1].s as number[])[0]).toBe(100);
      }
    });

    it("respects custom from/to", () => {
      const result = applyFade(makeAnim(), { mode: "in", from: 20, to: 80 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect((kfs[0].s as number[])[0]).toBe(20);
      expect((kfs[1].s as number[])[0]).toBe(80);
    });
  });

  describe("fade out", () => {
    it("animates opacity from 100 to 0", () => {
      const result = applyFade(makeAnim(), { mode: "out" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect((kfs[0].s as number[])[0]).toBe(100);
      expect((kfs[1].s as number[])[0]).toBe(0);
    });

    it("respects custom from/to", () => {
      const result = applyFade(makeAnim(), { mode: "out", from: 80, to: 10 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect((kfs[0].s as number[])[0]).toBe(80);
      expect((kfs[1].s as number[])[0]).toBe(10);
    });
  });

  describe("fade in-out", () => {
    it("fades in then out with midpoint", () => {
      const result = applyFade(makeAnim(), { mode: "in-out" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect(kfs.length).toBe(3);
      expect((kfs[0].s as number[])[0]).toBe(0);
      expect((kfs[1].s as number[])[0]).toBe(100);
      expect((kfs[2].s as number[])[0]).toBe(0);
    });
  });

  describe("fade pulse", () => {
    it("creates oscillating keyframes", () => {
      const result = applyFade(makeAnim(), { mode: "pulse", duration: 2 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect(kfs.length).toBeGreaterThanOrEqual(2);
      expect((kfs[0].s as number[])[0]).toBe(30);
      expect((kfs[1].s as number[])[0]).toBe(100);
    });
  });

  describe("duration", () => {
    it("sets keyframe timing based on duration", () => {
      const result = applyFade(makeAnim(undefined, 30, 0, 120), { mode: "in", duration: 2 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect(kfs[0].t).toBe(0);
      expect(kfs[1].t).toBe(60);
    });
  });

  describe("easing", () => {
    it("applies specified easing curve", () => {
      const result = applyFade(makeAnim(), { mode: "in", easing: "ease-in" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      const o = kfs[0].o as { x: number[]; y: number[] };
      expect(o.x[0]).toBe(0.42);
      expect(o.y[0]).toBe(0);
    });

    it("falls back to ease-in-out for unknown easing", () => {
      const result = applyFade(makeAnim(), { mode: "in", easing: "unknown" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      const o = kfs[0].o as { x: number[]; y: number[] };
      expect(o.x[0]).toBe(0.42);
    });
  });

  describe("layer targeting", () => {
    it("only affects named layer", () => {
      const result = applyFade(makeAnim(), { mode: "in", layer: "Layer 1" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const o1 = getOpacity(layers[0]);
      expect(o1.a).toBe(1);
      const o2 = getOpacity(layers[1]);
      expect(o2.a).toBe(0);
      expect(o2.k).toBe(100);
    });

    it("returns unchanged if layer not found", () => {
      const anim = makeAnim();
      const result = applyFade(anim, { mode: "in", layer: "Nonexistent" });
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(getOpacity(layers[0]).a).toBe(0);
    });
  });

  describe("stagger", () => {
    it("offsets each layer's fade start", () => {
      const result = applyFade(makeAnim(), { mode: "in", stagger: 200 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs0 = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      const kfs1 = (getOpacity(layers[1]).k as Array<Record<string, unknown>>);
      expect(kfs0[0].t).toBe(0);
      expect(kfs1[0].t).toBe(6);
    });
  });

  describe("delay", () => {
    it("offsets fade start by delay seconds", () => {
      const result = applyFade(makeAnim(), { mode: "in", delay: 0.5 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect(kfs[0].t).toBe(15);
    });
  });

  describe("edge cases", () => {
    it("handles animation with no layers", () => {
      const result = applyFade({ fr: 30, ip: 0, op: 60 }, { mode: "in" });
      expect(result.layers).toBeUndefined();
    });

    it("handles empty layers array", () => {
      const result = applyFade(makeAnim([]), { mode: "in" });
      expect((result.layers as unknown[]).length).toBe(0);
    });

    it("handles layer without ks property", () => {
      const anim = makeAnim([{ nm: "bare", ty: 4, ip: 0, op: 60 } as Record<string, unknown>]);
      const result = applyFade(anim, { mode: "in" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      expect(ks.o).toBeDefined();
    });

    it("does not mutate the input", () => {
      const anim = makeAnim();
      const original = JSON.stringify(anim);
      applyFade(anim, { mode: "in" });
      expect(JSON.stringify(anim)).toBe(original);
    });

    it("single layer animation works", () => {
      const anim = makeAnim([{ nm: "Solo", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 100 } } }]);
      const result = applyFade(anim, { mode: "out" });
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers.length).toBe(1);
      const o = getOpacity(layers[0]);
      expect(o.a).toBe(1);
    });

    it("uses default framerate when fr is missing", () => {
      const anim = { ip: 0, op: 60, layers: [{ nm: "L", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 100 } } }] };
      const result = applyFade(anim as Record<string, unknown>, { mode: "in", duration: 1 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = (getOpacity(layers[0]).k as Array<Record<string, unknown>>);
      expect(kfs[1].t).toBe(30);
    });
  });

  describe("command parsing integration", () => {
    it("valid modes list is correct", () => {
      expect(VALID_FADE_MODES).toContain("in");
      expect(VALID_FADE_MODES).toContain("out");
      expect(VALID_FADE_MODES).toContain("in-out");
      expect(VALID_FADE_MODES).toContain("pulse");
      expect(VALID_FADE_MODES.length).toBe(4);
    });
  });
});
