import { describe, it, expect } from "vitest";
import { staggerAnimation } from "../stagger";

function makeLottie(layerCount: number, fr = 30, op = 60) {
  const layers = Array.from({ length: layerCount }, (_, i) => ({
    nm: `Layer ${i}`,
    ip: 0,
    op,
    ty: 4,
  }));
  return { v: "5.7.0", fr, ip: 0, op, w: 100, h: 100, layers };
}

describe("staggerAnimation", () => {
  it("applies incremental delay in normal order", () => {
    const result = staggerAnimation(makeLottie(3), 200, "normal") as any;
    // delayFrames = 200 * 30 / 1000 = 6
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[0].op).toBe(60);
    expect(result.layers[1].ip).toBe(6);
    expect(result.layers[1].op).toBe(66);
    expect(result.layers[2].ip).toBe(12);
    expect(result.layers[2].op).toBe(72);
  });

  it("extends animation op to accommodate shifted layers", () => {
    const result = staggerAnimation(makeLottie(3), 200, "normal") as any;
    expect(result.op).toBe(72);
  });

  it("applies delay in reverse order", () => {
    const result = staggerAnimation(makeLottie(3), 100, "reverse") as any;
    // delayFrames = 100 * 30 / 1000 = 3
    // reverse indices: [2, 1, 0] → rank 0→layer2, rank 1→layer1, rank 2→layer0
    expect(result.layers[2].ip).toBe(0);
    expect(result.layers[1].ip).toBe(3);
    expect(result.layers[0].ip).toBe(6);
  });

  it("applies random order with unique offsets for all layers", () => {
    const result = staggerAnimation(makeLottie(5), 100, "random") as any;
    const ips = result.layers.map((l: any) => l.ip);
    const unique = new Set(ips);
    expect(unique.size).toBe(5);
  });

  it("returns unchanged when only 1 layer", () => {
    const input = makeLottie(1);
    const result = staggerAnimation(input, 200, "normal") as any;
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[0].op).toBe(60);
  });

  it("handles 0 delay (no-op offsets)", () => {
    const result = staggerAnimation(makeLottie(3), 0, "normal") as any;
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[1].ip).toBe(0);
    expect(result.layers[2].ip).toBe(0);
  });

  it("does not mutate the original object", () => {
    const input = makeLottie(3);
    const originalIp = (input.layers[1] as any).ip;
    staggerAnimation(input, 200, "normal");
    expect((input.layers[1] as any).ip).toBe(originalIp);
  });

  it("works with non-30fps animations", () => {
    const result = staggerAnimation(makeLottie(2, 60, 120), 500, "normal") as any;
    // delayFrames = 500 * 60 / 1000 = 30
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[1].ip).toBe(30);
    expect(result.layers[1].op).toBe(150);
  });
});
