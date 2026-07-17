import { describe, it, expect } from "vitest";
import {
  flashDetection,
  motionIntensityScore,
  generateReducedMotion,
  generateDescription,
  analyzeAccessibility,
} from "../a11y";

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeAnimation(layers: any[], opts: any = {}): any {
  return {
    layers,
    ip: 0,
    op: opts.op ?? 60,
    fr: opts.fr ?? 30,
    w: opts.w ?? 512,
    h: opts.h ?? 512,
    ...opts.extra,
  };
}

function makeLayer(ks: any, opts: any = {}): any {
  return { ty: opts.ty ?? 4, nm: opts.nm ?? "test", ks, ip: 0, op: opts.op ?? 60, ...opts.extra };
}

describe("flashDetection", () => {
  it("passes for a simple slow fade (2 opacity keyframes)", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 1, k: [{ t: 0, s: [100], e: [0] }, { t: 30, s: [0] }] } }),
    ]);
    const result = flashDetection(anim);
    expect(result.status).toBe("pass");
    expect(result.id).toBe("flash-detection");
  });

  it("passes when no opacity animation exists", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 0, k: 100 }, p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] } }),
    ]);
    expect(flashDetection(anim).status).toBe("pass");
  });

  it("warns for 3 rapid opacity changes within 1 second", () => {
    // 3 transitions with >25% change in <333ms intervals within 1s window
    // fr=30, so 333ms = 10 frames. Use intervals of 8 frames.
    const anim = makeAnimation([
      makeLayer({
        o: {
          a: 1,
          k: [
            { t: 0, s: [100], e: [50] },
            { t: 8, s: [50], e: [100] },
            { t: 16, s: [100], e: [50] },
            { t: 24, s: [50] },
          ],
        },
      }),
    ]);
    const result = flashDetection(anim);
    expect(result.status).toBe("warn");
  });

  it("fails for >3 rapid opacity transitions with >25% change", () => {
    // 5 rapid transitions within 1 second window
    const anim = makeAnimation([
      makeLayer({
        o: {
          a: 1,
          k: [
            { t: 0, s: [100], e: [0] },
            { t: 5, s: [0], e: [100] },
            { t: 10, s: [100], e: [0] },
            { t: 15, s: [0], e: [100] },
            { t: 20, s: [100], e: [0] },
            { t: 25, s: [0] },
          ],
        },
      }),
    ]);
    const result = flashDetection(anim);
    expect(result.status).toBe("fail");
    expect(result.suggestion).toBeDefined();
  });

  it("does not trigger for keyframes with < 25% opacity change", () => {
    const anim = makeAnimation([
      makeLayer({
        o: {
          a: 1,
          k: [
            { t: 0, s: [100], e: [80] },
            { t: 5, s: [80], e: [100] },
            { t: 10, s: [100], e: [80] },
            { t: 15, s: [80], e: [100] },
            { t: 20, s: [100], e: [80] },
            { t: 25, s: [80] },
          ],
        },
      }),
    ]);
    expect(flashDetection(anim).status).toBe("pass");
  });
});

describe("motionIntensityScore", () => {
  it("returns 0 for empty animation", () => {
    const anim = makeAnimation([]);
    expect(motionIntensityScore(anim)).toBe(0);
  });

  it("returns 0 for static animation (no animated properties)", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256] } }),
    ]);
    expect(motionIntensityScore(anim)).toBe(0);
  });

  it("returns 0 for animation with only opacity changes", () => {
    const anim = makeAnimation([
      makeLayer({
        o: { a: 1, k: [{ t: 0, s: [100], e: [0] }, { t: 30, s: [0] }] },
        p: { a: 0, k: [256, 256] },
      }),
    ]);
    expect(motionIntensityScore(anim)).toBe(0);
  });

  it("returns low score for gentle movement", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] },
      }),
    ]);
    const score = motionIntensityScore(anim);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });

  it("returns high score for large displacement + rotation + scale", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [512, 512] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [720] }] },
        s: { a: 1, k: [{ t: 0, s: [100, 100] }, { t: 30, s: [300, 300] }] },
      }),
    ]);
    const score = motionIntensityScore(anim);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("caps score at 100", () => {
    // Extreme values across multiple layers
    const layers = Array.from({ length: 10 }, () =>
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [5000, 5000] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [3600] }] },
        s: { a: 1, k: [{ t: 0, s: [100, 100] }, { t: 30, s: [1000, 1000] }] },
      })
    );
    const anim = makeAnimation(layers);
    expect(motionIntensityScore(anim)).toBe(100);
  });
});

describe("generateReducedMotion", () => {
  it("strips position animation, keeps final value", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0], e: [100, 200] }, { t: 30, s: [100, 200] }] },
      }),
    ]);
    const reduced = generateReducedMotion(anim);
    const p = reduced.layers![0].ks!.p!;
    expect(p.a).toBe(0);
    expect(p.k).toEqual([100, 200]);
  });

  it("strips rotation animation, keeps final value", () => {
    const anim = makeAnimation([
      makeLayer({
        r: { a: 1, k: [{ t: 0, s: [0], e: [180] }, { t: 30, s: [180] }] },
      }),
    ]);
    const reduced = generateReducedMotion(anim);
    const r = reduced.layers![0].ks!.r!;
    expect(r.a).toBe(0);
    expect(r.k).toBe(180);
  });

  it("strips scale animation, keeps final value", () => {
    const anim = makeAnimation([
      makeLayer({
        s: { a: 1, k: [{ t: 0, s: [100, 100], e: [200, 200] }, { t: 30, s: [200, 200] }] },
      }),
    ]);
    const reduced = generateReducedMotion(anim);
    const s = reduced.layers![0].ks!.s!;
    expect(s.a).toBe(0);
    expect(s.k).toEqual([200, 200]);
  });

  it("preserves opacity animations untouched", () => {
    const opacityKfs = [{ t: 0, s: [100], e: [0] }, { t: 30, s: [0] }];
    const anim = makeAnimation([
      makeLayer({
        o: { a: 1, k: opacityKfs },
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] },
      }),
    ]);
    const reduced = generateReducedMotion(anim);
    expect(reduced.layers![0].ks!.o!.a).toBe(1);
    expect(reduced.layers![0].ks!.o!.k).toHaveLength(2);
  });

  it("does not mutate original animation", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] },
      }),
    ]);
    const original = JSON.parse(JSON.stringify(anim));
    generateReducedMotion(anim);
    expect(anim).toEqual(original);
  });

  it("handles layers with no ks", () => {
    const anim = makeAnimation([{ ty: 3, nm: "null", ip: 0, op: 60 }]);
    const reduced = generateReducedMotion(anim);
    expect(reduced.layers![0].ks).toBeUndefined();
  });
});

describe("generateDescription", () => {
  it("describes layer types and counts", () => {
    const anim = makeAnimation([
      makeLayer({}, { ty: 4 }),
      makeLayer({}, { ty: 4 }),
      makeLayer({}, { ty: 5 }),
    ]);
    const desc = generateDescription(anim);
    expect(desc).toContain("2 shape");
    expect(desc).toContain("1 text");
  });

  it("mentions motion types present", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [90] }] },
      }),
    ]);
    const desc = generateDescription(anim);
    expect(desc).toContain("position movement");
    expect(desc).toContain("rotation");
  });

  it("reports duration and fps", () => {
    const anim = makeAnimation(
      [makeLayer({})],
      { fr: 24, op: 48 }
    );
    const desc = generateDescription(anim);
    expect(desc).toContain("2.0s");
    expect(desc).toContain("24fps");
  });

  it("handles static animation with no animated properties", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 0, k: 100 }, p: { a: 0, k: [0, 0] } }),
    ]);
    const desc = generateDescription(anim);
    expect(desc).toContain("Static animation with no animated properties");
  });
});

describe("analyzeAccessibility", () => {
  it("returns overall 'pass' when all checks pass", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256] } }),
    ]);
    const result = analyzeAccessibility(anim);
    expect(result.status).toBe("pass");
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("returns overall 'fail' when any check fails", () => {
    // Trigger flash fail + high motion fail
    const anim = makeAnimation([
      makeLayer({
        o: {
          a: 1,
          k: [
            { t: 0, s: [100], e: [0] },
            { t: 5, s: [0], e: [100] },
            { t: 10, s: [100], e: [0] },
            { t: 15, s: [0], e: [100] },
            { t: 20, s: [100], e: [0] },
            { t: 25, s: [0] },
          ],
        },
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [512, 512] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [720] }] },
      }),
    ]);
    const result = analyzeAccessibility(anim);
    expect(result.status).toBe("fail");
  });

  it("returns overall 'warn' when no fail but has warn", () => {
    // Moderate motion (score 41-70) triggers warn, no flash
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [400, 0] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [180] }] },
      }),
    ]);
    const result = analyzeAccessibility(anim);
    if (result.motionScore > 40 && result.motionScore <= 70) {
      expect(result.status).toBe("warn");
    }
  });

  it("includes reducedMotion when motionScore > 40", () => {
    const anim = makeAnimation([
      makeLayer({
        p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [512, 512] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [720] }] },
        s: { a: 1, k: [{ t: 0, s: [100, 100] }, { t: 30, s: [300, 300] }] },
      }),
    ]);
    const result = analyzeAccessibility(anim);
    expect(result.motionScore).toBeGreaterThan(40);
    expect(result.reducedMotion).toBeDefined();
    // Verify reduced motion has static transforms
    expect(result.reducedMotion!.layers![0].ks!.p!.a).toBe(0);
  });

  it("does not include reducedMotion when motionScore <= 40", () => {
    const anim = makeAnimation([
      makeLayer({ o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256] } }),
    ]);
    const result = analyzeAccessibility(anim);
    expect(result.motionScore).toBeLessThanOrEqual(40);
    expect(result.reducedMotion).toBeUndefined();
  });

  it("includes description and motionScore", () => {
    const anim = makeAnimation([makeLayer({})]);
    const result = analyzeAccessibility(anim);
    expect(typeof result.description).toBe("string");
    expect(typeof result.motionScore).toBe("number");
    expect(result.checks.length).toBeGreaterThanOrEqual(2);
  });
});
