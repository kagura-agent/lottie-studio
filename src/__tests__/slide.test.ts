import { describe, it, expect } from "vitest";
import { applySlide, VALID_SLIDE_DIRECTIONS } from "@/lib/slide";

function makeAnim(
  layers?: Array<Record<string, unknown>>,
  fr = 30,
  ip = 0,
  op = 60,
  w = 512,
  h = 512
): Record<string, unknown> {
  return {
    fr,
    ip,
    op,
    w,
    h,
    layers: layers ?? [
      { nm: "Layer 1", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [256, 256, 0] } } },
      { nm: "Layer 2", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [100, 200, 0] } } },
    ],
  };
}

function getPosition(layer: Record<string, unknown>): Record<string, unknown> {
  return (layer.ks as Record<string, unknown>).p as Record<string, unknown>;
}

function getKfs(layer: Record<string, unknown>) {
  return getPosition(layer).k as Array<Record<string, unknown>>;
}

describe("slide", () => {
  describe("VALID_SLIDE_DIRECTIONS", () => {
    it("exports valid directions", () => {
      expect(VALID_SLIDE_DIRECTIONS).toEqual(["left", "right", "up", "down"]);
    });
  });

  describe("slide in from left", () => {
    it("slides from offscreen left to current position", () => {
      const result = applySlide(makeAnim(), { direction: "left" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect(kfs.length).toBe(2);
      expect((kfs[0].s as number[])[0]).toBe(-512);
      expect((kfs[0].s as number[])[1]).toBe(256);
      expect((kfs[1].s as number[])[0]).toBe(256);
      expect((kfs[1].s as number[])[1]).toBe(256);
    });
  });

  describe("slide in from right", () => {
    it("slides from offscreen right to current position", () => {
      const result = applySlide(makeAnim(), { direction: "right" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(512 + 512);
      expect((kfs[0].s as number[])[1]).toBe(256);
      expect((kfs[1].s as number[])[0]).toBe(256);
    });
  });

  describe("slide in from up", () => {
    it("slides from offscreen top to current position", () => {
      const result = applySlide(makeAnim(), { direction: "up" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(256);
      expect((kfs[0].s as number[])[1]).toBe(-512);
      expect((kfs[1].s as number[])[1]).toBe(256);
    });
  });

  describe("slide in from down", () => {
    it("slides from offscreen bottom to current position", () => {
      const result = applySlide(makeAnim(), { direction: "down" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[1]).toBe(512 + 512);
      expect((kfs[1].s as number[])[1]).toBe(256);
    });
  });

  describe("slide out", () => {
    it("slides from current position to offscreen", () => {
      const result = applySlide(makeAnim(), { direction: "left", out: true });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(256);
      expect((kfs[0].s as number[])[1]).toBe(256);
      expect((kfs[1].s as number[])[0]).toBe(-512);
      expect((kfs[1].s as number[])[1]).toBe(256);
    });

    it("uses ease-in as default easing for out", () => {
      const result = applySlide(makeAnim(), { direction: "right", out: true });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      const o = kfs[0].o as { x: number[]; y: number[] };
      expect(o.x[0]).toBe(0.42);
      expect(o.y[0]).toBe(0);
    });
  });

  describe("default easing", () => {
    it("uses ease-out for slide in", () => {
      const result = applySlide(makeAnim(), { direction: "left" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      const o = kfs[0].o as { x: number[]; y: number[] };
      expect(o.x[0]).toBe(0);
      expect(o.y[0]).toBe(0);
      const i = kfs[0].i as { x: number[]; y: number[] };
      expect(i.x[0]).toBe(0.58);
    });
  });

  describe("layer targeting", () => {
    it("only affects named layer", () => {
      const result = applySlide(makeAnim(), { direction: "left", layer: "Layer 1" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const p1 = getPosition(layers[0]);
      expect(p1.a).toBe(1);
      const p2 = getPosition(layers[1]);
      expect(p2.a).toBe(0);
    });

    it("returns unchanged if layer not found", () => {
      const anim = makeAnim();
      const result = applySlide(anim, { direction: "left", layer: "Nonexistent" });
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(getPosition(layers[0]).a).toBe(0);
    });
  });

  describe("stagger", () => {
    it("offsets each layer's slide start", () => {
      const result = applySlide(makeAnim(), { direction: "left", stagger: 200 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs0 = getKfs(layers[0]);
      const kfs1 = getKfs(layers[1]);
      expect(kfs0[0].t).toBe(0);
      expect(kfs1[0].t).toBe(6);
    });
  });

  describe("custom easing", () => {
    it("applies specified easing curve", () => {
      const result = applySlide(makeAnim(), { direction: "left", easing: "bounce" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      const o = kfs[0].o as { x: number[]; y: number[] };
      expect(o.x[0]).toBe(0.34);
    });
  });

  describe("custom distance", () => {
    it("uses custom distance instead of canvas width", () => {
      const result = applySlide(makeAnim(), { direction: "left", distance: 100 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(-100);
    });

    it("uses custom distance for right direction", () => {
      const result = applySlide(makeAnim(), { direction: "right", distance: 200 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(512 + 200);
    });
  });

  describe("custom from/to frame range", () => {
    it("uses from/to as frame range override", () => {
      const result = applySlide(makeAnim(), { direction: "left", from: 10, to: 40 });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect(kfs[0].t).toBe(10);
      expect(kfs[1].t).toBe(40);
    });
  });

  describe("edge cases", () => {
    it("returns unchanged animation when no layers exist", () => {
      const result = applySlide({ fr: 30, ip: 0, op: 60, w: 512, h: 512 }, { direction: "left" });
      expect(result.layers).toBeUndefined();
    });

    it("handles empty layers array", () => {
      const result = applySlide(makeAnim([]), { direction: "left" });
      expect((result.layers as unknown[]).length).toBe(0);
    });

    it("does not mutate the input", () => {
      const anim = makeAnim();
      const original = JSON.stringify(anim);
      applySlide(anim, { direction: "left" });
      expect(JSON.stringify(anim)).toBe(original);
    });

    it("single layer animation works", () => {
      const anim = makeAnim([{ nm: "Solo", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [100, 100, 0] } } }]);
      const result = applySlide(anim, { direction: "right" });
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers.length).toBe(1);
      const p = getPosition(layers[0]);
      expect(p.a).toBe(1);
    });

    it("handles layer without ks property", () => {
      const anim = makeAnim([{ nm: "bare", ty: 4, ip: 0, op: 60 } as Record<string, unknown>]);
      const result = applySlide(anim, { direction: "left" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const ks = layers[0].ks as Record<string, unknown>;
      expect(ks.p).toBeDefined();
    });

    it("handles animations with existing animated position", () => {
      const anim = makeAnim([{
        nm: "Animated",
        ty: 4,
        ip: 0,
        op: 60,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0, 0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
              { t: 30, s: [300, 400, 0] },
            ],
          },
        },
      }]);
      const result = applySlide(anim, { direction: "left" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[1].s as number[])[0]).toBe(300);
      expect((kfs[1].s as number[])[1]).toBe(400);
    });

    it("uses default canvas size when w/h missing", () => {
      const anim = {
        fr: 30, ip: 0, op: 60,
        layers: [{ nm: "L", ty: 4, ip: 0, op: 60, ks: { p: { a: 0, k: [0, 0, 0] } } }],
      };
      const result = applySlide(anim as Record<string, unknown>, { direction: "left" });
      const layers = result.layers as Array<Record<string, unknown>>;
      const kfs = getKfs(layers[0]);
      expect((kfs[0].s as number[])[0]).toBe(-512);
    });
  });
});
