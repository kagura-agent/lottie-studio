import { describe, it, expect } from "vitest";
import { generateParticleAnimation, VALID_PARTICLE_TYPES } from "../particle";

describe("generateParticleAnimation", () => {
  it("generates valid Lottie structure for each particle type", () => {
    for (const type of VALID_PARTICLE_TYPES) {
      const result = generateParticleAnimation(type, {}) as Record<string, unknown>;
      expect(result.v).toBe("5.7.4");
      expect(result.fr).toBe(30);
      expect(result.w).toBe(512);
      expect(result.h).toBe(512);
      expect(result.ip).toBe(0);
      expect(typeof result.op).toBe("number");
      expect(Array.isArray(result.layers)).toBe(true);
      expect((result.layers as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("respects count option", () => {
    const result = generateParticleAnimation("confetti", { count: 10 }) as Record<string, unknown>;
    expect((result.layers as unknown[]).length).toBe(10);
  });

  it("caps count at 100", () => {
    const result = generateParticleAnimation("confetti", { count: 200 }) as Record<string, unknown>;
    expect((result.layers as unknown[]).length).toBe(100);
  });

  it("defaults to 30 particles", () => {
    const result = generateParticleAnimation("snow", {}) as Record<string, unknown>;
    expect((result.layers as unknown[]).length).toBe(30);
  });

  it("stays under 50KB with default count", () => {
    for (const type of VALID_PARTICLE_TYPES) {
      const result = generateParticleAnimation(type, {});
      const size = JSON.stringify(result).length;
      expect(size).toBeLessThan(50000);
    }
  });

  it("applies speed option to frame count", () => {
    const slow = generateParticleAnimation("snow", { speed: "slow" }) as Record<string, unknown>;
    const fast = generateParticleAnimation("snow", { speed: "fast" }) as Record<string, unknown>;
    expect(slow.op).toBeGreaterThan(fast.op as number);
  });

  it("generates layers with shape groups", () => {
    const result = generateParticleAnimation("stars", { count: 5 }) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    for (const layer of layers) {
      expect(layer.ty).toBe(4);
      expect(Array.isArray(layer.shapes)).toBe(true);
      const shapes = layer.shapes as Array<Record<string, unknown>>;
      expect(shapes[0].ty).toBe("gr");
    }
  });

  it("uses burst direction for fireworks by default", () => {
    const result = generateParticleAnimation("fireworks", {}) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    const ks = layers[0].ks as Record<string, unknown>;
    const p = ks.p as Record<string, unknown>;
    expect(p.a).toBe(1);
    const keyframes = p.k as Array<Record<string, unknown>>;
    expect(keyframes[0].s).toEqual([256, 256]);
  });

  it("handles hex color", () => {
    const result = generateParticleAnimation("bubbles", { count: 1, color: "#ff0000" }) as Record<string, unknown>;
    const layers = result.layers as Array<Record<string, unknown>>;
    const shapes = layers[0].shapes as Array<Record<string, unknown>>;
    const group = shapes[0] as Record<string, unknown>;
    const items = group.it as Array<Record<string, unknown>>;
    const fill = items.find(i => i.ty === "fl") as Record<string, unknown>;
    const c = fill.c as Record<string, unknown>;
    const k = c.k as number[];
    expect(k[0]).toBeCloseTo(1, 1);
    expect(k[1]).toBeCloseTo(0, 1);
    expect(k[2]).toBeCloseTo(0, 1);
  });
});
