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

  it("returns warn when flashes per second is 3 (>2 but <=3)", () => {
    // 3 transitions in a 1-second window: warn
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Flasher",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 3, s: [0] },
              { t: 6, s: [100] },
              { t: 9, s: [0] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("3 luminance changes");
  });

  it("uses .e fallback when .s is missing on opacity keyframe", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Flasher",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, e: [100] },
              { t: 2, s: [0] },
              { t: 4, e: [100] },
              { t: 6, s: [0] },
              { t: 8, e: [100] },
              { t: 10, s: [0] },
              { t: 12, e: [100] },
              { t: 14, s: [0] },
              { t: 16, e: [100] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("fail");
  });

  it("does not count small opacity changes (<= 25) as transitions", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Subtle",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [90] },
              { t: 2, s: [80] },
              { t: 4, s: [70] },
              { t: 6, s: [60] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("pass");
  });

  it("skips layers with fewer than 3 opacity keyframes", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        nm: "TwoKfs",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 2, s: [0] },
            ],
          },
        },
      }],
    });

    const result = flashDetection(animation);
    expect(result.status).toBe("pass");
  });

  it("handles animation with no layers or fr", () => {
    const result = flashDetection({});
    expect(result.status).toBe("pass");
  });

  it("handles endVal fallback when next keyframe has no .s (uses current .s)", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 2, e: [0] },
              { t: 4, s: [100] },
              { t: 6, e: [0] },
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

  it("returns 0 for zero duration", () => {
    const animation = makeAnimation({ ip: 0, op: 0, layers: [{ ty: 4, ks: {} }] });
    expect(motionIntensityScore(animation)).toBe(0);
  });

  it("returns 0 for empty layers", () => {
    const animation = makeAnimation({ layers: [] });
    expect(motionIntensityScore(animation)).toBe(0);
  });

  it("returns 0 for negative duration", () => {
    const animation = makeAnimation({ ip: 60, op: 0, layers: [{ ty: 4, ks: {} }] });
    expect(motionIntensityScore(animation)).toBe(0);
  });

  it("handles missing animation dimensions", () => {
    const animation = {
      ip: 0,
      op: 60,
      fr: 30,
      layers: [{
        ty: 4,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] },
        },
      }],
    };
    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(0);
  });

  it("handles position keyframes with missing coordinate values", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [] },
              { t: 60, s: [] },
            ],
          },
        },
      }],
    });
    const score = motionIntensityScore(animation);
    expect(score).toBe(0);
  });

  it("handles scale keyframes with missing values using defaults", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          s: {
            a: 1,
            k: [
              { t: 0, s: [] },
              { t: 60, s: [] },
            ],
          },
        },
      }],
    });
    const score = motionIntensityScore(animation);
    expect(score).toBe(0);
  });

  it("handles missing fr defaulting to 30", () => {
    const animation = {
      ip: 0,
      op: 60,
      layers: [{
        ty: 4,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] },
        },
      }],
    };
    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(0);
  });

  it("uses .e fallback for position keyframes when .s is missing", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, e: [0, 0] },
              { t: 30, s: [200, 200] },
              { t: 60, s: [400, 400] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(0);
  });

  it("uses .e fallback for rotation when next .s is missing", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          r: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [180] },
              { t: 60, e: [360] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(0);
  });

  it("uses .e fallback for scale when next .s is missing", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          s: {
            a: 1,
            k: [
              { t: 0, s: [50, 50], e: [200, 200] },
              { t: 60, e: [300, 300] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBeGreaterThan(0);
  });

  it("caps displacement, rotation, scale scores and overall at 100", () => {
    const animation = makeAnimation({
      op: 90,
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0] },
              { t: 10, s: [5000, 5000] },
              { t: 20, s: [0, 0] },
              { t: 30, s: [5000, 5000] },
              { t: 40, s: [0, 0] },
              { t: 50, s: [5000, 5000] },
              { t: 60, s: [0, 0] },
              { t: 70, s: [5000, 5000] },
              { t: 80, s: [0, 0] },
              { t: 90, s: [5000, 5000] },
            ],
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 30, s: [3600] },
              { t: 60, s: [7200] },
              { t: 90, s: [10800] },
            ],
          },
          s: {
            a: 1,
            k: [
              { t: 0, s: [0, 0] },
              { t: 30, s: [1000, 1000] },
              { t: 60, s: [0, 0] },
              { t: 90, s: [1000, 1000] },
            ],
          },
        },
      }],
    });

    const score = motionIntensityScore(animation);
    expect(score).toBe(100);
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

  it("skips layers without ks", () => {
    const anim = makeAnimation({
      layers: [{ ty: 4, nm: "NoKs" }],
    });
    const reduced = generateReducedMotion(anim);
    expect(reduced.layers![0].ks).toBeUndefined();
  });

  it("skips properties where a !== 1 or k is not array", () => {
    const anim = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: { a: 0, k: [100, 100] },
          r: { a: 1, k: 45 },
          s: { a: 0, k: [100, 100] },
        },
      }],
    });
    const reduced = generateReducedMotion(anim);
    const layer = reduced.layers![0];
    expect(layer.ks!.p!.a).toBe(0);
    expect(layer.ks!.r!.k).toBe(45);
  });

  it("uses .e fallback when lastKf.s is missing for position/rotation/scale", () => {
    const anim = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, e: [100, 200] }] },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, e: [90] }] },
          s: { a: 1, k: [{ t: 0, s: [50, 50] }, { t: 60, e: [150, 150] }] },
        },
      }],
    });
    const reduced = generateReducedMotion(anim);
    const layer = reduced.layers![0];
    expect(layer.ks!.p!.k).toEqual([100, 200]);
    expect(layer.ks!.r!.k).toBe(90);
    expect(layer.ks!.s!.k).toEqual([150, 150]);
  });

  it("falls back to defaults when lastKf has neither .s nor .e", () => {
    const anim = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60 }] },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60 }] },
          s: { a: 1, k: [{ t: 0, s: [50, 50] }, { t: 60 }] },
        },
      }],
    });
    const reduced = generateReducedMotion(anim);
    const layer = reduced.layers![0];
    expect(layer.ks!.p!.k).toEqual([0, 0]);
    expect(layer.ks!.r!.k).toBe(0);
    expect(layer.ks!.s!.k).toEqual([100, 100]);
  });

  it("handles animation with no layers property", () => {
    const anim = { fr: 30, ip: 0, op: 60, w: 512, h: 512 };
    const reduced = generateReducedMotion(anim);
    expect(reduced.layers).toBeUndefined();
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

  it("labels unknown layer types", () => {
    const animation = makeAnimation({
      layers: [{ ty: 99, ks: {} }],
    });
    const desc = generateDescription(animation);
    expect(desc).toContain("unknown");
  });

  it("uses singular 'layer' for single layer", () => {
    const animation = makeAnimation({
      layers: [{ ty: 4, ks: {} }],
    });
    const desc = generateDescription(animation);
    expect(desc).toMatch(/1 shape layer,/);
    expect(desc).not.toContain("layers");
  });

  it("describes static animation with no animated properties", () => {
    const animation = makeAnimation({
      layers: [{ ty: 4, ks: { p: { a: 0, k: [0, 0] } } }],
    });
    const desc = generateDescription(animation);
    expect(desc).toContain("Static animation with no animated properties");
  });

  it("handles layers without ks", () => {
    const animation = makeAnimation({
      layers: [{ ty: 4 }],
    });
    const desc = generateDescription(animation);
    expect(desc).toContain("shape");
  });

  it("handles layer with no ty", () => {
    const animation = makeAnimation({
      layers: [{ ks: {} }],
    });
    const desc = generateDescription(animation);
    expect(desc).toContain("unknown");
  });

  it("handles animation with missing fr/ip/op", () => {
    const desc = generateDescription({ layers: [{ ty: 4, ks: {} }] });
    expect(desc).toContain("0.0s");
  });

  it("handles animation with no layers", () => {
    const desc = generateDescription({});
    expect(desc).toContain("Animation with");
  });

  it("lists all 4 motion types when present", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
          s: { a: 1, k: [{ t: 0, s: [50, 50] }, { t: 60, s: [100, 100] }] },
          o: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [100] }] },
        },
      }],
    });
    const desc = generateDescription(animation);
    expect(desc).toContain("position movement");
    expect(desc).toContain("rotation");
    expect(desc).toContain("scaling");
    expect(desc).toContain("opacity changes");
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

  it("returns warn status when motion score is moderate (>40, <=70)", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0] },
              { t: 20, s: [400, 400] },
              { t: 40, s: [0, 0] },
              { t: 60, s: [400, 400] },
            ],
          },
        },
      }],
    });

    const result = analyzeAccessibility(animation);
    expect(result.motionScore).toBeGreaterThan(40);
    expect(result.status).toBe("warn");
    expect(result.reducedMotion).toBeDefined();
  });

  it("returns fail status when motion score is high (>70)", () => {
    const animation = makeAnimation({
      op: 90,
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0] },
              { t: 10, s: [5000, 5000] },
              { t: 20, s: [0, 0] },
              { t: 30, s: [5000, 5000] },
              { t: 40, s: [0, 0] },
              { t: 50, s: [5000, 5000] },
              { t: 60, s: [0, 0] },
              { t: 70, s: [5000, 5000] },
              { t: 80, s: [0, 0] },
              { t: 90, s: [5000, 5000] },
            ],
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 30, s: [3600] },
              { t: 60, s: [7200] },
              { t: 90, s: [10800] },
            ],
          },
        },
      }],
    });

    const result = analyzeAccessibility(animation);
    expect(result.motionScore).toBeGreaterThan(70);
    expect(result.status).toBe("fail");
    expect(result.reducedMotion).toBeDefined();
  });

  it("returns fail when flash check fails even if motion is low", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
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

    const result = analyzeAccessibility(animation);
    expect(result.status).toBe("fail");
  });

  it("returns warn when flash check warns", () => {
    const animation = makeAnimation({
      layers: [{
        ty: 4,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 3, s: [0] },
              { t: 6, s: [100] },
              { t: 9, s: [0] },
            ],
          },
        },
      }],
    });

    const result = analyzeAccessibility(animation);
    expect(result.status).toBe("warn");
  });
});
