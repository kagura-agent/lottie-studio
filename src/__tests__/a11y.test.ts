import { describe, it, expect } from "vitest";
import {
  flashDetection,
  motionIntensityScore,
  generateReducedMotion,
  generateDescription,
  analyzeAccessibility,
} from "@/lib/a11y";

function makeAnimation(overrides: Record<string, unknown> = {}) {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [],
    ...overrides,
  };
}

describe("flashDetection", () => {
  it("catches rapid opacity toggling (>3/sec)", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Flasher",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 2, s: [0] },
              { t: 4, s: [100] },
              { t: 6, s: [0] },
              { t: 8, s: [100] },
              { t: 10, s: [0] },
              { t: 12, s: [100] },
              { t: 14, s: [0] },
              { t: 16, s: [100] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("fail");
  });

  it("passes on slow fades", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "SlowFade",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 30, s: [0] },
              { t: 60, s: [100] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("pass");
  });
});

describe("motionIntensityScore", () => {
  it("returns high score for large displacement", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Mover",
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0] },
              { t: 15, s: [500, 500] },
              { t: 30, s: [0, 0] },
              { t: 45, s: [500, 500] },
              { t: 60, s: [0, 0] },
            ],
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 60, s: [720] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(50);
  });

  it("returns low score for subtle animations", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Subtle",
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [250, 250] },
              { t: 60, s: [260, 255] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBeLessThan(20);
  });
});

describe("generateReducedMotion", () => {
  const animation = makeAnimation({
    layers: [{
      ty: 4,
      nm: "Animated",
      ks: {
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [500, 300] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
        s: { a: 1, k: [{ t: 0, s: [50, 50] }, { t: 60, s: [100, 100] }] },
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [100] }] },
      },
    }],
  });

  it("removes position/rotation/scale keyframes", () => {
    const reduced = generateReducedMotion(animation);
    const layer = reduced.layers![0];
    expect(layer.ks!.p!.a).toBe(0);
    expect(layer.ks!.r!.a).toBe(0);
    expect(layer.ks!.s!.a).toBe(0);
  });

  it("preserves opacity fades", () => {
    const reduced = generateReducedMotion(animation);
    const layer = reduced.layers![0];
    expect(layer.ks!.o!.a).toBe(1);
    expect(Array.isArray(layer.ks!.o!.k)).toBe(true);
  });

  it("preserves final visual state (colors, shapes)", () => {
    const reduced = generateReducedMotion(animation);
    const layer = reduced.layers![0];
    expect(layer.ks!.p!.k).toEqual([500, 300]);
    expect(layer.ks!.r!.k).toBe(360);
    expect(layer.ks!.s!.k).toEqual([100, 100]);
  });
});

describe("generateDescription", () => {
  it("identifies layer types correctly", () => {
    const animation = makeAnimation({
      layers: [
        { ty: 4, nm: "Circle", ks: {} },
        { ty: 5, nm: "Title", ks: {} },
        { ty: 1, nm: "BG", ks: {} },
      ],
    });

    const desc = generateDescription(animation);
    expect(desc).toContain("shape");
    expect(desc).toContain("text");
    expect(desc).toContain("solid");
  });
});

describe("analyzeAccessibility", () => {
  it("returns pass for safe animation", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Gentle",
        ks: {
          o: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [100] }] },
        },
      }],
    });

    const result = analyzeAccessibility(animation);
    expect(result.status).toBe("pass");
    expect(result.reducedMotion).toBeUndefined();
  });
});
