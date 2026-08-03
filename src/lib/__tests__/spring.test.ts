import { describe, it, expect } from "vitest";
import {
  generateSpringKeyframes,
  resolveSpringOptions,
  SPRING_PRESETS,
  SPRING_PRESET_VALUES,
} from "../spring";

describe("generateSpringKeyframes", () => {
  describe("underdamped (oscillating)", () => {
    it("oscillates before settling with default-like params", () => {
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 170,
        damping: 12,
        mass: 1,
      });
      // Should overshoot the target at some point
      const overshoots = (frames as number[]).some((v) => v > 100);
      expect(overshoots).toBe(true);
    });

    it("first frame equals startValue and last frame equals endValue", () => {
      const frames = generateSpringKeyframes(10, 50, {
        stiffness: 170,
        damping: 12,
        mass: 1,
      }) as number[];
      expect(frames[0]).toBe(10);
      expect(frames[frames.length - 1]).toBeCloseTo(50, 1);
    });
  });

  describe("critically damped", () => {
    it("approaches target without overshoot", () => {
      // Critical damping: damping² = 4 * stiffness * mass
      // stiffness=100, mass=1 → damping=20
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 100,
        damping: 20,
        mass: 1,
      }) as number[];
      // No value should exceed the target
      const overshoots = frames.some((v) => v > 100.01);
      expect(overshoots).toBe(false);
      expect(frames[frames.length - 1]).toBeCloseTo(100, 1);
    });
  });

  describe("overdamped", () => {
    it("slowly approaches target without overshoot", () => {
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 100,
        damping: 50,
        mass: 1,
      }) as number[];
      const overshoots = frames.some((v) => v > 100.01);
      expect(overshoots).toBe(false);
      expect(frames[frames.length - 1]).toBeCloseTo(100, 1);
    });
  });

  describe("scalar input", () => {
    it("returns array of numbers for scalar start/end", () => {
      const frames = generateSpringKeyframes(0, 1, {
        stiffness: 170,
        damping: 12,
        mass: 1,
      });
      expect(typeof frames[0]).toBe("number");
      expect(typeof frames[frames.length - 1]).toBe("number");
    });
  });

  describe("array input", () => {
    it("returns array of arrays for array start/end", () => {
      const frames = generateSpringKeyframes([0, 0], [100, 200], {
        stiffness: 170,
        damping: 12,
        mass: 1,
      });
      expect(Array.isArray(frames[0])).toBe(true);
      expect(frames[0]).toEqual([0, 0]);
      const last = frames[frames.length - 1] as number[];
      expect(last[0]).toBeCloseTo(100, 1);
      expect(last[1]).toBeCloseTo(200, 1);
    });
  });

  describe("settling threshold", () => {
    it("terminates when amplitude < 0.1% of displacement", () => {
      const frames = generateSpringKeyframes(0, 1000, {
        stiffness: 300,
        damping: 20,
        mass: 1,
      }) as number[];
      // Should settle well before 300 frames (10s at 30fps)
      expect(frames.length).toBeLessThan(300);
      expect(frames.length).toBeGreaterThan(2);
    });
  });

  describe("safety cap", () => {
    it("caps at fps * 10 frames", () => {
      // Very low damping = takes forever to settle
      const fps = 30;
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 1,
        damping: 0.01,
        mass: 1,
      }, fps);
      // Should not exceed 300 frames + possible final snap frame
      expect(frames.length).toBeLessThanOrEqual(fps * 10 + 1);
    });
  });

  describe("edge cases", () => {
    it("handles zero displacement", () => {
      const frames = generateSpringKeyframes(50, 50, {
        stiffness: 170,
        damping: 12,
        mass: 1,
      }) as number[];
      expect(frames[0]).toBe(50);
      expect(frames[frames.length - 1]).toBeCloseTo(50, 1);
    });

    it("handles very high damping", () => {
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 100,
        damping: 1000,
        mass: 1,
      }) as number[];
      expect(frames[frames.length - 1]).toBeCloseTo(100, 0);
    });

    it("handles very low stiffness", () => {
      const frames = generateSpringKeyframes(0, 100, {
        stiffness: 0.1,
        damping: 5,
        mass: 1,
      }) as number[];
      expect(frames[frames.length - 1]).toBeCloseTo(100, 0);
    });
  });
});

describe("resolveSpringOptions", () => {
  it("returns default values when no options provided", () => {
    const result = resolveSpringOptions({});
    expect(result).toEqual({ stiffness: 170, damping: 12, mass: 1 });
  });

  it("applies preset values", () => {
    const result = resolveSpringOptions({ preset: "snappy" });
    expect(result).toEqual({ stiffness: 300, damping: 20, mass: 1 });
  });

  it("custom values override preset", () => {
    const result = resolveSpringOptions({
      preset: "snappy",
      stiffness: 500,
    });
    expect(result.stiffness).toBe(500);
    expect(result.damping).toBe(20); // from preset
  });

  it("custom values without preset", () => {
    const result = resolveSpringOptions({
      stiffness: 200,
      damping: 15,
      mass: 2,
    });
    expect(result).toEqual({ stiffness: 200, damping: 15, mass: 2 });
  });
});

describe("SPRING_PRESETS", () => {
  it("contains all 4 presets", () => {
    expect(SPRING_PRESETS).toHaveLength(4);
    expect(SPRING_PRESETS).toContain("snappy");
    expect(SPRING_PRESETS).toContain("bouncy");
    expect(SPRING_PRESETS).toContain("gentle");
    expect(SPRING_PRESETS).toContain("wobbly");
  });

  it("each preset produces valid spring config", () => {
    for (const preset of SPRING_PRESETS) {
      const config = SPRING_PRESET_VALUES[preset];
      expect(config.stiffness).toBeGreaterThan(0);
      expect(config.damping).toBeGreaterThan(0);
    }
  });

  it("each preset generates different animation characteristics", () => {
    const frameCounts = SPRING_PRESETS.map((preset) => {
      const opts = resolveSpringOptions({ preset });
      const frames = generateSpringKeyframes(0, 100, opts);
      return frames.length;
    });
    // Not all presets should produce the same frame count
    const unique = new Set(frameCounts);
    expect(unique.size).toBeGreaterThan(1);
  });
});
