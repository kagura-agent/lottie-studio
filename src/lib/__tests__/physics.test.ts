import { describe, it, expect } from "vitest";
import {
  generatePhysicsKeyframes,
  VALID_PHYSICS_EFFECTS,
  PhysicsCommandOptions,
} from "@/lib/physics";

describe("physics engine", () => {
  describe("exports", () => {
    it("exports VALID_PHYSICS_EFFECTS with all 5 effects", () => {
      expect(VALID_PHYSICS_EFFECTS).toEqual(["gravity", "bounce", "throw", "pendulum", "float"]);
    });
  });

  describe("gravity", () => {
    it("generates valid keyframe array", () => {
      const kf = generatePhysicsKeyframes("gravity", { effect: "gravity", duration: 1000 }, 0, 30);
      expect(kf.length).toBeGreaterThan(1);
      expect(kf[0]).toHaveProperty("t");
      expect(kf[0]).toHaveProperty("s");
    });

    it("y increases quadratically", () => {
      const kf = generatePhysicsKeyframes("gravity", { effect: "gravity", duration: 1000 }, 0, 30);
      const yValues = kf.map((k) => k.s[1]);
      expect(yValues[0]).toBe(0);
      for (let i = 2; i < yValues.length; i++) {
        expect(yValues[i]).toBeGreaterThan(yValues[i - 1]);
      }
      const midRatio = yValues[15] / yValues[30];
      expect(midRatio).toBeCloseTo(0.25, 1);
    });
  });

  describe("bounce", () => {
    it("generates valid keyframe array", () => {
      const kf = generatePhysicsKeyframes("bounce", { effect: "bounce", duration: 2000 }, 0, 30);
      expect(kf.length).toBeGreaterThan(1);
    });

    it("each bounce is lower than previous (y reaches floor then rebounds less)", () => {
      const kf = generatePhysicsKeyframes("bounce", { effect: "bounce", duration: 3000, bounces: 5, damping: 0.4 }, 0, 30);
      const yValues = kf.map((k) => k.s[1]);
      const floorY = 200;
      const bounceHeights: number[] = [];
      let wasAtFloor = false;
      let minY = floorY;
      for (const y of yValues) {
        if (y >= floorY) {
          if (!wasAtFloor && minY < floorY) {
            bounceHeights.push(floorY - minY);
          }
          wasAtFloor = true;
          minY = floorY;
        } else {
          wasAtFloor = false;
          if (y < minY) minY = y;
        }
      }
      for (let i = 1; i < bounceHeights.length; i++) {
        expect(bounceHeights[i]).toBeLessThan(bounceHeights[i - 1]);
      }
    });
  });

  describe("throw", () => {
    it("generates valid keyframe array", () => {
      const kf = generatePhysicsKeyframes("throw", { effect: "throw", duration: 1500 }, 0, 30);
      expect(kf.length).toBeGreaterThan(1);
    });

    it("follows parabolic arc (x linear, y parabolic)", () => {
      const kf = generatePhysicsKeyframes("throw", { effect: "throw", duration: 2000, angle: 45, force: 200 }, 0, 30);
      const xValues = kf.map((k) => k.s[0]);
      // x should increase roughly linearly
      for (let i = 1; i < xValues.length; i++) {
        expect(xValues[i]).toBeGreaterThan(xValues[i - 1]);
      }
      // y should first decrease (go up) then increase (come down)
      const yValues = kf.map((k) => k.s[1]);
      expect(yValues[0]).toBe(0);
      const minYIdx = yValues.indexOf(Math.min(...yValues));
      expect(minYIdx).toBeGreaterThan(0);
      expect(minYIdx).toBeLessThan(yValues.length - 1);
    });
  });

  describe("pendulum", () => {
    it("generates valid keyframe array", () => {
      const kf = generatePhysicsKeyframes("pendulum", { effect: "pendulum", duration: 2000 }, 0, 30);
      expect(kf.length).toBeGreaterThan(1);
      expect(kf[0].s).toHaveLength(1);
    });

    it("oscillates with decay", () => {
      const kf = generatePhysicsKeyframes("pendulum", { effect: "pendulum", duration: 3000, damping: 0.5 }, 0, 30);
      const values = kf.map((k) => k.s[0]);
      // First value should be the max (theta0)
      expect(Math.abs(values[0])).toBeGreaterThan(Math.abs(values[values.length - 1]));
      // Should cross zero (oscillation)
      const signs = values.map((v) => Math.sign(v));
      const signChanges = signs.filter((s, i) => i > 0 && s !== signs[i - 1]).length;
      expect(signChanges).toBeGreaterThan(2);
    });
  });

  describe("float", () => {
    it("generates valid keyframe array", () => {
      const kf = generatePhysicsKeyframes("float", { effect: "float", duration: 2000 }, 0, 30);
      expect(kf.length).toBeGreaterThan(1);
    });

    it("y decreases (moves up) with lateral wobble", () => {
      const kf = generatePhysicsKeyframes("float", { effect: "float", duration: 2000, force: 50 }, 0, 30);
      const yValues = kf.map((k) => k.s[1]);
      // y should decrease over time (negative = up)
      expect(yValues[yValues.length - 1]).toBeLessThan(yValues[0]);
      // x should have some variation (lateral drift)
      const xValues = kf.map((k) => k.s[0]);
      const hasPositive = xValues.some((x) => x > 0.1);
      const hasNegative = xValues.some((x) => x < -0.1);
      expect(hasPositive || hasNegative).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles zero duration gracefully", () => {
      const kf = generatePhysicsKeyframes("gravity", { effect: "gravity", duration: 0 }, 0, 30);
      expect(kf.length).toBeGreaterThanOrEqual(1);
    });

    it("all effects produce arrays with t and s fields", () => {
      for (const effect of VALID_PHYSICS_EFFECTS) {
        const kf = generatePhysicsKeyframes(effect, { effect, duration: 1000 } as PhysicsCommandOptions, 0, 30);
        expect(kf.length).toBeGreaterThan(0);
        for (const frame of kf) {
          expect(typeof frame.t).toBe("number");
          expect(Array.isArray(frame.s)).toBe(true);
        }
      }
    });
  });
});
