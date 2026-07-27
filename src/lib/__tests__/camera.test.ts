import { describe, it, expect } from "vitest";
import { applyCamera, CameraMovement, VALID_CAMERA_MOVEMENTS } from "../camera";

function makeAnimation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      {
        ty: 4,
        nm: "Shape Layer 1",
        ind: 1,
        ip: 0,
        op: 60,
        ks: {
          p: { a: 0, k: [256, 256, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      },
      {
        ty: 4,
        nm: "Shape Layer 2",
        ind: 2,
        ip: 0,
        op: 60,
        ks: {
          p: { a: 0, k: [128, 128, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      },
    ],
    ...overrides,
  };
}

function makeEmptyAnimation(): Record<string, unknown> {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [],
  };
}

function makeAnimationWithParent(): Record<string, unknown> {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      {
        ty: 4,
        nm: "Parent Layer",
        ind: 1,
        ip: 0,
        op: 60,
        ks: { p: { a: 0, k: [256, 256, 0] } },
      },
      {
        ty: 4,
        nm: "Child Layer",
        ind: 2,
        ip: 0,
        op: 60,
        parent: 1,
        ks: { p: { a: 0, k: [0, 0, 0] } },
      },
    ],
  };
}

describe("camera", () => {
  describe("VALID_CAMERA_MOVEMENTS", () => {
    it("contains all expected movements", () => {
      expect(VALID_CAMERA_MOVEMENTS).toContain("zoom-in");
      expect(VALID_CAMERA_MOVEMENTS).toContain("zoom-out");
      expect(VALID_CAMERA_MOVEMENTS).toContain("pan-left");
      expect(VALID_CAMERA_MOVEMENTS).toContain("pan-right");
      expect(VALID_CAMERA_MOVEMENTS).toContain("pan-up");
      expect(VALID_CAMERA_MOVEMENTS).toContain("pan-down");
      expect(VALID_CAMERA_MOVEMENTS).toContain("shake");
      expect(VALID_CAMERA_MOVEMENTS).toContain("ken-burns");
      expect(VALID_CAMERA_MOVEMENTS).toHaveLength(8);
    });
  });

  describe("wrapper layer creation", () => {
    it("creates a null layer (ty: 3) with index 0", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      expect(wrapper.ty).toBe(3);
      expect(wrapper.ind).toBe(0);
      expect(wrapper.nm).toBe("Camera Wrapper");
    });

    it("wrapper spans full animation duration (ip to op)", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      expect(wrapper.ip).toBe(0);
      expect(wrapper.op).toBe(60);
    });

    it("wrapper has anchor point at animation center", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const a = ks.a as Record<string, unknown>;
      expect(a.k).toEqual([256, 256, 0]);
    });

    it("wrapper uses custom point when specified", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { point: [100, 200] }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const a = ks.a as Record<string, unknown>;
      expect(a.k).toEqual([100, 200, 0]);
    });
  });

  describe("layer index shifting", () => {
    it("shifts all existing layer indices up by 1", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      // Original layers had ind 1 and 2, now should be 2 and 3
      expect(layers[1].ind).toBe(2);
      expect(layers[2].ind).toBe(3);
    });

    it("total layer count increases by 1", () => {
      const anim = makeAnimation();
      const originalCount = (anim.layers as unknown[]).length;
      const result = applyCamera(anim, "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      expect(layers).toHaveLength(originalCount + 1);
    });
  });

  describe("parent assignment", () => {
    it("sets parent of all top-level layers to wrapper index (0)", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      // Layers at index 1 and 2 (original layers) should have parent = 0
      expect(layers[1].parent).toBe(0);
      expect(layers[2].parent).toBe(0);
    });

    it("preserves existing parent relationships (shifted)", () => {
      const result = applyCamera(makeAnimationWithParent(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      // Original: Child (ind:2, parent:1) → after shift: Child (ind:3, parent:2)
      // Parent Layer (ind:1) → after shift: (ind:2, parent:0 since it was top-level)
      const parentLayer = layers.find(l => l.nm === "Parent Layer");
      const childLayer = layers.find(l => l.nm === "Child Layer");
      expect(parentLayer!.parent).toBe(0); // top-level → assigned to wrapper
      expect(childLayer!.parent).toBe(2); // was 1, shifted to 2
    });
  });

  describe("zoom-in movement", () => {
    it("animates scale from [100,100] to [130,130] at default intensity", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      expect(s.a).toBe(1);
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes).toHaveLength(2);
      expect(keyframes[0].s).toEqual([100, 100, 100]);
      expect(keyframes[1].s).toEqual([130, 130, 100]);
    });

    it("scales with intensity", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { intensity: 2.0 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([100, 100, 100]);
      expect(keyframes[1].s).toEqual([160, 160, 100]); // 100 + 30*2
    });

    it("uses correct start and end frames", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { from: 10, to: 40 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].t).toBe(10);
      expect(keyframes[1].t).toBe(40);
    });
  });

  describe("zoom-out movement", () => {
    it("animates scale from [130,130] to [100,100] at default intensity", () => {
      const result = applyCamera(makeAnimation(), "zoom-out", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([130, 130, 100]);
      expect(keyframes[1].s).toEqual([100, 100, 100]);
    });
  });

  describe("pan-left movement", () => {
    it("animates position from center to left offset", () => {
      const result = applyCamera(makeAnimation(), "pan-left", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      expect(p.a).toBe(1);
      const keyframes = p.k as Array<Record<string, unknown>>;
      expect(keyframes).toHaveLength(2);
      // From: anchorX + 0 = 256, anchorY + 0 = 256
      expect(keyframes[0].s).toEqual([256, 256, 0]);
      // To: anchorX + (-100*1) = 156, anchorY + 0 = 256
      expect(keyframes[1].s).toEqual([156, 256, 0]);
    });

    it("scales with intensity", () => {
      const result = applyCamera(makeAnimation(), "pan-left", { intensity: 1.5 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      // To: anchorX + (-100*1.5) = 106, anchorY + 0 = 256
      expect(keyframes[1].s).toEqual([106, 256, 0]);
    });
  });

  describe("pan-right movement", () => {
    it("animates position from center to right offset", () => {
      const result = applyCamera(makeAnimation(), "pan-right", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([256, 256, 0]);
      // To: anchorX + 100*1 = 356
      expect(keyframes[1].s).toEqual([356, 256, 0]);
    });
  });

  describe("pan-up movement", () => {
    it("animates position upward", () => {
      const result = applyCamera(makeAnimation(), "pan-up", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([256, 256, 0]);
      // To: anchorX + 0 = 256, anchorY + (-80*1) = 176
      expect(keyframes[1].s).toEqual([256, 176, 0]);
    });
  });

  describe("pan-down movement", () => {
    it("animates position downward", () => {
      const result = applyCamera(makeAnimation(), "pan-down", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([256, 256, 0]);
      // To: anchorX + 0 = 256, anchorY + 80*1 = 336
      expect(keyframes[1].s).toEqual([256, 336, 0]);
    });
  });

  describe("shake movement", () => {
    it("produces multiple rapid keyframes", () => {
      const result = applyCamera(makeAnimation(), "shake", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      expect(p.a).toBe(1);
      const keyframes = p.k as Array<Record<string, unknown>>;
      expect(keyframes.length).toBeGreaterThan(4);
    });

    it("first and last keyframes return to center", () => {
      const result = applyCamera(makeAnimation(), "shake", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      const first = keyframes[0].s as number[];
      const last = keyframes[keyframes.length - 1].s as number[];
      // Center: anchorX=256, anchorY=256, offset=0
      expect(first).toEqual([256, 256, 0]);
      expect(last).toEqual([256, 256, 0]);
    });

    it("is deterministic (same input → same output)", () => {
      const anim = makeAnimation();
      const result1 = applyCamera(anim, "shake", {});
      const result2 = applyCamera(anim, "shake", {});
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it("intensity affects shake amplitude", () => {
      const anim = makeAnimation();
      const low = applyCamera(anim, "shake", { intensity: 0.5 }) as Record<string, unknown>;
      const high = applyCamera(anim, "shake", { intensity: 2.0 }) as Record<string, unknown>;
      const lowLayers = low.layers as Array<Record<string, unknown>>;
      const highLayers = high.layers as Array<Record<string, unknown>>;
      const lowKf = ((lowLayers[0].ks as Record<string, unknown>).p as Record<string, unknown>).k as Array<Record<string, unknown>>;
      const highKf = ((highLayers[0].ks as Record<string, unknown>).p as Record<string, unknown>).k as Array<Record<string, unknown>>;

      // Find max deviation from center (256)
      const maxDevLow = Math.max(...lowKf.map(kf => {
        const s = kf.s as number[];
        return Math.abs(s[0] - 256) + Math.abs(s[1] - 256);
      }));
      const maxDevHigh = Math.max(...highKf.map(kf => {
        const s = kf.s as number[];
        return Math.abs(s[0] - 256) + Math.abs(s[1] - 256);
      }));
      expect(maxDevHigh).toBeGreaterThan(maxDevLow);
    });
  });

  describe("ken-burns movement", () => {
    it("combines slow zoom and position drift", () => {
      const result = applyCamera(makeAnimation(), "ken-burns", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      expect(s.a).toBe(1);
      expect(p.a).toBe(1);
    });

    it("scale goes from 100 to 115 at default intensity", () => {
      const result = applyCamera(makeAnimation(), "ken-burns", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].s).toEqual([100, 100, 100]);
      expect(keyframes[1].s).toEqual([115, 115, 100]);
    });

    it("position drifts subtly", () => {
      const result = applyCamera(makeAnimation(), "ken-burns", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const p = ks.p as Record<string, unknown>;
      const keyframes = p.k as Array<Record<string, unknown>>;
      // Start at center
      expect(keyframes[0].s).toEqual([256, 256, 0]);
      // End: anchorX + (-20*1) = 236, anchorY + (-10*1) = 246
      expect(keyframes[1].s).toEqual([236, 246, 0]);
    });
  });

  describe("easing application", () => {
    it("applies ease-in-out by default", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].o).toEqual({ x: [0.42], y: [0] });
      expect(keyframes[0].i).toEqual({ x: [0.58], y: [1] });
    });

    it("applies specified easing preset", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { easing: "bounce" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].o).toEqual({ x: [0.34], y: [1.56] });
      expect(keyframes[0].i).toEqual({ x: [0.64], y: [1] });
    });

    it("falls back to ease-in-out for unknown easing", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { easing: "nonexistent" }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].o).toEqual({ x: [0.42], y: [0] });
      expect(keyframes[0].i).toEqual({ x: [0.58], y: [1] });
    });
  });

  describe("intensity scaling", () => {
    it("clamps intensity below 0.1 to 0.1", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { intensity: 0.01 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      // 100 + 30*0.1 = 103
      expect(keyframes[1].s).toEqual([103, 103, 100]);
    });

    it("clamps intensity above 2.0 to 2.0", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", { intensity: 5.0 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      // 100 + 30*2 = 160
      expect(keyframes[1].s).toEqual([160, 160, 100]);
    });
  });

  describe("empty animation", () => {
    it("handles empty layers array gracefully", () => {
      const result = applyCamera(makeEmptyAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      // Should still add the wrapper
      expect(layers).toHaveLength(1);
      expect(layers[0].ty).toBe(3);
      expect(layers[0].ind).toBe(0);
    });
  });

  describe("does not modify existing layer transforms", () => {
    it("original layer transforms remain unchanged", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const layer1 = layers[1];
      const ks = layer1.ks as Record<string, unknown>;
      expect(ks.p).toEqual({ a: 0, k: [256, 256, 0] });
      expect(ks.s).toEqual({ a: 0, k: [100, 100, 100] });
    });
  });

  describe("duration option", () => {
    it("uses specified duration in seconds to compute end frame", () => {
      // fr=30, from=0, duration=1s → end frame = 30
      const result = applyCamera(makeAnimation(), "zoom-in", { duration: 1 }) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].t).toBe(0);
      expect(keyframes[1].t).toBe(30);
    });

    it("defaults to full animation duration", () => {
      const result = applyCamera(makeAnimation(), "zoom-in", {}) as Record<string, unknown>;
      const layers = result.layers as Array<Record<string, unknown>>;
      const wrapper = layers[0];
      const ks = wrapper.ks as Record<string, unknown>;
      const s = ks.s as Record<string, unknown>;
      const keyframes = s.k as Array<Record<string, unknown>>;
      expect(keyframes[0].t).toBe(0);
      expect(keyframes[1].t).toBe(60);
    });
  });

  describe("all movement types produce valid output", () => {
    const movements: CameraMovement[] = [...VALID_CAMERA_MOVEMENTS];
    for (const movement of movements) {
      it(`${movement} produces a valid result with wrapper layer`, () => {
        const result = applyCamera(makeAnimation(), movement, {}) as Record<string, unknown>;
        const layers = result.layers as Array<Record<string, unknown>>;
        expect(layers[0].ty).toBe(3);
        expect(layers[0].ind).toBe(0);
        expect(layers).toHaveLength(3); // wrapper + 2 original
      });
    }
  });
});
