import { describe, it, expect } from "vitest";
import {
  generateShakeKeyframes,
  resolveShakeOptions,
  ShakeOptions,
  VALID_SHAKE_AXES,
} from "@/lib/shake";

describe("resolveShakeOptions", () => {
  it("fills in defaults when no options given", () => {
    expect(resolveShakeOptions({})).toEqual({ intensity: 10, frequency: 12, decay: 0.85 });
  });

  it("respects provided overrides", () => {
    expect(resolveShakeOptions({ intensity: 5, frequency: 20, decay: 0.5 })).toEqual({
      intensity: 5,
      frequency: 20,
      decay: 0.5,
    });
  });
});

describe("VALID_SHAKE_AXES", () => {
  it("includes x, y, both, rotation", () => {
    expect(VALID_SHAKE_AXES).toEqual(["x", "y", "both", "rotation"]);
  });
});

describe("generateShakeKeyframes", () => {
  const defaultOpts: ShakeOptions = { intensity: 10, frequency: 12, decay: 0.85 };

  it("generates keyframes spanning from start to end frame", () => {
    const frames = generateShakeKeyframes(0, 30, 30, defaultOpts);
    expect(frames[0].t).toBe(0);
    expect(frames[frames.length - 1].t).toBe(30);
    expect(frames.length).toBeGreaterThan(2);
  });

  it("decays in amplitude over time", () => {
    const frames = generateShakeKeyframes(0, 60, 30, defaultOpts);
    const quarter = Math.floor(frames.length / 4);
    const earlyPeak = Math.max(...frames.slice(0, quarter).map((f) => Math.abs(f.s[0])));
    const latePeak = Math.max(...frames.slice(-quarter).map((f) => Math.abs(f.s[0])));
    expect(latePeak).toBeLessThan(earlyPeak);
  });

  it("respects the frequency parameter (matches the decay/sine formula)", () => {
    const opts: ShakeOptions = { intensity: 10, frequency: 5, decay: 0.85 };
    const frames = generateShakeKeyframes(0, 30, 30, opts);
    for (const kf of frames) {
      const timeSeconds = (kf.t - 0) / 30;
      const expected = opts.intensity * Math.exp(-opts.decay * timeSeconds) * Math.sin(2 * Math.PI * opts.frequency * timeSeconds);
      expect(kf.s[0]).toBeCloseTo(expected, 5);
    }
  });

  it("a higher frequency produces more oscillations than a lower one", () => {
    const lowFreq = generateShakeKeyframes(0, 60, 30, { intensity: 10, frequency: 2, decay: 0.85 });
    const highFreq = generateShakeKeyframes(0, 60, 30, { intensity: 10, frequency: 20, decay: 0.85 });

    const countSignChanges = (frames: { s: number[] }[]) => {
      let count = 0;
      for (let i = 1; i < frames.length; i++) {
        if (Math.sign(frames[i].s[0]) !== Math.sign(frames[i - 1].s[0]) && frames[i].s[0] !== 0) {
          count++;
        }
      }
      return count;
    };

    expect(countSignChanges(highFreq)).toBeGreaterThan(countSignChanges(lowFreq));
  });

  it("different seeds produce different sequences", () => {
    const a = generateShakeKeyframes(0, 30, 30, { ...defaultOpts, seed: 1 });
    const b = generateShakeKeyframes(0, 30, 30, { ...defaultOpts, seed: 2 });
    expect(a.map((f) => f.s[0])).not.toEqual(b.map((f) => f.s[0]));
  });

  it("the same seed produces the same sequence", () => {
    const a = generateShakeKeyframes(0, 30, 30, { ...defaultOpts, seed: 7 });
    const b = generateShakeKeyframes(0, 30, 30, { ...defaultOpts, seed: 7 });
    expect(a).toEqual(b);
  });

  it("handles zero duration by returning a single resting keyframe", () => {
    const frames = generateShakeKeyframes(10, 10, 30, defaultOpts);
    expect(frames).toEqual([{ t: 10, s: [0] }]);
  });

  it("handles a very short single-frame duration", () => {
    const frames = generateShakeKeyframes(0, 1, 30, defaultOpts);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0].t).toBe(0);
    expect(frames[frames.length - 1].t).toBe(1);
  });
});
