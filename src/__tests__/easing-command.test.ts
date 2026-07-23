import { describe, it, expect } from "vitest";
import { applyEasing, EASING_PRESETS } from "@/lib/easing";
import { parseCommand } from "@/lib/commands";

describe("parseCommand /easing", () => {
  it("parses valid presets", () => {
    expect(parseCommand("/easing ease-in")).toEqual({ type: "easing", preset: "ease-in" });
    expect(parseCommand("/easing bounce")).toEqual({ type: "easing", preset: "bounce" });
    expect(parseCommand("/easing linear")).toEqual({ type: "easing", preset: "linear" });
  });

  it("is case-insensitive", () => {
    expect(parseCommand("/easing Ease-In-Out")).toEqual({ type: "easing", preset: "ease-in-out" });
  });

  it("returns error for unknown preset", () => {
    const result = parseCommand("/easing unknown");
    expect(result).toMatchObject({ type: "error" });
  });

  it("returns error with no arguments", () => {
    const result = parseCommand("/easing");
    expect(result).toMatchObject({ type: "error" });
  });
});

describe("applyEasing", () => {
  const animationWithKeyframes = {
    w: 512,
    h: 512,
    fr: 30,
    ip: 0,
    op: 60,
    layers: [
      {
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0], o: { x: [0.5, 0.5], y: [0, 0] }, i: { x: [0.5, 0.5], y: [1, 1] } },
              { t: 30, s: [100, 100], o: { x: [0.5, 0.5], y: [0, 0] }, i: { x: [0.5, 0.5], y: [1, 1] } },
              { t: 60, s: [200, 200] },
            ],
          },
          o: {
            a: 1,
            k: [
              { t: 0, s: [100], o: { x: 0.5, y: 0 }, i: { x: 0.5, y: 1 } },
              { t: 60, s: [0] },
            ],
          },
        },
        shapes: [],
      },
    ],
  };

  it("applies easing to multi-dimensional keyframes", () => {
    const { result, keyframeCount } = applyEasing(animationWithKeyframes, "ease-in-out");
    expect(keyframeCount).toBe(3);
    const layers = (result as Record<string, unknown>).layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as { k: Record<string, unknown>[] };
    expect(p.k[0].o).toEqual({ x: [0.42, 0.42], y: [0, 0] });
    expect(p.k[0].i).toEqual({ x: [0.58, 0.58], y: [1, 1] });
  });

  it("applies easing to scalar keyframes", () => {
    const { result } = applyEasing(animationWithKeyframes, "bounce");
    const layers = (result as Record<string, unknown>).layers as Record<string, unknown>[];
    const ks = layers[0].ks as Record<string, unknown>;
    const o = ks.o as { k: Record<string, unknown>[] };
    expect(o.k[0].o).toEqual({ x: 0.34, y: 1.56 });
    expect(o.k[0].i).toEqual({ x: 0.64, y: 1 });
  });

  it("returns 0 keyframes for static animation", () => {
    const staticAnim = {
      w: 100, h: 100, fr: 30, ip: 0, op: 30,
      layers: [{ ty: 4, ks: { p: { a: 0, k: [50, 50] } }, shapes: [] }],
    };
    const { keyframeCount } = applyEasing(staticAnim, "linear");
    expect(keyframeCount).toBe(0);
  });

  it("does not modify the original animation", () => {
    const original = JSON.parse(JSON.stringify(animationWithKeyframes));
    applyEasing(animationWithKeyframes, "elastic");
    expect(animationWithKeyframes).toEqual(original);
  });

  it("skips last keyframe without handles", () => {
    const { keyframeCount } = applyEasing(animationWithKeyframes, "sharp");
    // 2 keyframes with handles in position + 1 scalar with handles = 3
    expect(keyframeCount).toBe(3);
  });

  it("handles all presets without error", () => {
    for (const preset of EASING_PRESETS) {
      const { result } = applyEasing(animationWithKeyframes, preset);
      expect(result).toBeDefined();
    }
  });
});
