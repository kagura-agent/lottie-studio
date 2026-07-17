import { describe, it, expect } from "vitest";
import { retime } from "@/lib/retime";
import type { LottieJson } from "@/lib/retime";

function makeLottie(overrides: Partial<LottieJson> = {}): LottieJson {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    layers: [
      {
        ip: 0,
        op: 60,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [100] }, { t: 30, s: [50] }, { t: 60, s: [100] }] },
          p: { a: 0, k: [100, 100] },
        },
      },
    ],
    ...overrides,
  };
}

describe("retime", () => {
  it("scales a 2s animation to 4s", () => {
    const input = makeLottie();
    const result = retime(input, 4000);
    expect(result.op).toBe(120);
    expect(result.fr).toBe(30);
    expect(result.layers![0].ip).toBe(0);
    expect(result.layers![0].op).toBe(120);
    const kf = (result.layers![0] as any).ks.o.k;
    expect(kf[0].t).toBe(0);
    expect(kf[1].t).toBe(60);
    expect(kf[2].t).toBe(120);
  });

  it("scales down to sub-second (500ms)", () => {
    const input = makeLottie();
    const result = retime(input, 500);
    expect(result.op).toBe(15);
    expect(result.layers![0].op).toBe(15);
  });

  it("handles no keyframes (static properties only)", () => {
    const input: LottieJson = {
      fr: 30,
      ip: 0,
      op: 60,
      layers: [{ ip: 0, op: 60, ks: { o: { a: 0, k: 100 } } }],
    };
    const result = retime(input, 4000);
    expect(result.op).toBe(120);
    expect(result.layers![0].op).toBe(120);
  });

  it("handles single keyframe", () => {
    const input: LottieJson = {
      fr: 30,
      ip: 0,
      op: 60,
      layers: [{ ip: 0, op: 60, ks: { o: { a: 1, k: [{ t: 30, s: [100] }] } } }],
    };
    const result = retime(input, 1000);
    expect(result.op).toBe(30);
    const kf = (result.layers![0] as any).ks.o.k;
    expect(kf[0].t).toBe(15);
  });

  it("scales nested keyframes in shape groups", () => {
    const input: LottieJson = {
      fr: 30,
      ip: 0,
      op: 90,
      layers: [{
        ip: 0,
        op: 90,
        shapes: [{
          ty: "gr",
          it: [{
            ty: "fl",
            o: { a: 1, k: [{ t: 0, s: [100] }, { t: 45, s: [0] }, { t: 90, s: [100] }] },
          }],
        }],
      }],
    };
    const result = retime(input, 6000);
    expect(result.op).toBe(180);
    const kf = (result.layers![0] as any).shapes[0].it[0].o.k;
    expect(kf[0].t).toBe(0);
    expect(kf[1].t).toBe(90);
    expect(kf[2].t).toBe(180);
  });

  it("scales markers", () => {
    const input = makeLottie({ markers: [{ tm: 15 }, { tm: 45 }] });
    const result = retime(input, 4000);
    expect(result.markers![0].tm).toBe(30);
    expect(result.markers![1].tm).toBe(90);
  });

  it("returns unchanged if target matches current duration", () => {
    const input = makeLottie();
    const result = retime(input, 2000);
    expect(result.op).toBe(60);
  });

  it("does not mutate the original", () => {
    const input = makeLottie();
    retime(input, 4000);
    expect(input.op).toBe(60);
  });

  it("preserves easing curves", () => {
    const input: LottieJson = {
      fr: 30,
      ip: 0,
      op: 60,
      layers: [{
        ip: 0,
        op: 60,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [0], o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } }, { t: 60, s: [100] }] },
        },
      }],
    };
    const result = retime(input, 4000);
    const kf = (result.layers![0] as any).ks.o.k[0];
    expect(kf.o).toEqual({ x: [0.42], y: [0] });
    expect(kf.i).toEqual({ x: [0.58], y: [1] });
  });
});
