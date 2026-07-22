import { describe, it, expect } from "vitest";
import { mirrorAnimation } from "@/lib/mirror";

type Keyframe = { t: number; s?: number[]; e?: number[] };

interface LottieResult {
  w?: number;
  h?: number;
  ip: number;
  op: number;
  fr: number;
  layers: Array<{
    ip?: number;
    op?: number;
    ks?: {
      p?: { a: number; k: number[] | Array<{ t: number; s?: number[]; e?: number[] }> };
      s?: { a: number; k: number[] | Array<{ t: number; s?: number[]; e?: number[] }> };
      r?: { a: number; k: number };
      o?: { a: number; k: number };
      a?: { a: number; k: number[] };
    };
  }>;
}

describe("mirrorAnimation", () => {
  const baseLottie = {
    w: 200,
    h: 100,
    ip: 0,
    op: 60,
    fr: 30,
    layers: [
      {
        ip: 0,
        op: 60,
        ks: {
          p: { a: 0, k: [50, 25, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
          a: { a: 0, k: [0, 0, 0] },
        },
      },
    ],
  };

  describe("horizontal mirror", () => {
    it("negates the x scale for static properties", () => {
      const result = mirrorAnimation(baseLottie, "horizontal") as LottieResult;
      expect(result.layers[0]!.ks!.s!.k[0]).toBe(-100);
      expect(result.layers[0]!.ks!.s!.k[1]).toBe(100);
      expect(result.layers[0]!.ks!.s!.k[2]).toBe(100);
    });

    it("mirrors x position relative to composition center", () => {
      const result = mirrorAnimation(baseLottie, "horizontal") as LottieResult;
      // center = 200/2 = 100; newX = 100*2 - 50 = 150
      expect(result.layers[0]!.ks!.p!.k[0]).toBe(150);
      expect(result.layers[0]!.ks!.p!.k[1]).toBe(25);
    });

    it("does not modify y scale or y position", () => {
      const result = mirrorAnimation(baseLottie, "horizontal") as LottieResult;
      expect(result.layers[0]!.ks!.s!.k[1]).toBe(100);
      expect(result.layers[0]!.ks!.p!.k[1]).toBe(25);
    });

    it("handles animated scale keyframes", () => {
      const input = {
        w: 200,
        h: 100,
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              s: {
                a: 1,
                k: [
                  { t: 0, s: [100, 100, 100], e: [50, 100, 100] },
                  { t: 30, s: [50, 100, 100], e: [100, 100, 100] },
                  { t: 60, s: [100, 100, 100] },
                ],
              },
              p: { a: 0, k: [100, 50, 0] },
            },
          },
        ],
      };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      const kf = result.layers[0]!.ks!.s!.k as Keyframe[];
      expect(kf[0]!.s![0]).toBe(-100);
      expect(kf[0]!.e![0]).toBe(-50);
      expect(kf[1]!.s![0]).toBe(-50);
      expect(kf[1]!.e![0]).toBe(-100);
      expect(kf[2]!.s![0]).toBe(-100);
      // Y values unchanged
      expect(kf[0]!.s![1]).toBe(100);
      expect(kf[1]!.s![1]).toBe(100);
    });

    it("handles animated position keyframes", () => {
      const input = {
        w: 400,
        h: 200,
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, s: [100, 50, 0], e: [300, 50, 0] },
                  { t: 60, s: [300, 50, 0] },
                ],
              },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
        ],
      };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      const kf = result.layers[0]!.ks!.p!.k as Keyframe[];
      // center = 200; newX = 200*2 - 100 = 300
      expect(kf[0]!.s![0]).toBe(300);
      expect(kf[0]!.e![0]).toBe(100);
      expect(kf[1]!.s![0]).toBe(100);
      // Y unchanged
      expect(kf[0]!.s![1]).toBe(50);
    });
  });

  describe("vertical mirror", () => {
    it("negates the y scale for static properties", () => {
      const result = mirrorAnimation(baseLottie, "vertical") as LottieResult;
      expect(result.layers[0]!.ks!.s!.k[0]).toBe(100);
      expect(result.layers[0]!.ks!.s!.k[1]).toBe(-100);
    });

    it("mirrors y position relative to composition center", () => {
      const result = mirrorAnimation(baseLottie, "vertical") as LottieResult;
      // center = 100/2 = 50; newY = 50*2 - 25 = 75
      expect(result.layers[0]!.ks!.p!.k[0]).toBe(50); // x unchanged
      expect(result.layers[0]!.ks!.p!.k[1]).toBe(75);
    });

    it("does not modify x scale or x position", () => {
      const result = mirrorAnimation(baseLottie, "vertical") as LottieResult;
      expect(result.layers[0]!.ks!.s!.k[0]).toBe(100);
      expect(result.layers[0]!.ks!.p!.k[0]).toBe(50);
    });

    it("handles animated scale keyframes", () => {
      const input = {
        w: 200,
        h: 100,
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              s: {
                a: 1,
                k: [
                  { t: 0, s: [100, 80, 100] },
                  { t: 60, s: [100, 120, 100] },
                ],
              },
              p: { a: 0, k: [100, 50, 0] },
            },
          },
        ],
      };
      const result = mirrorAnimation(input, "vertical") as LottieResult;
      const kf = result.layers[0]!.ks!.s!.k as Keyframe[];
      expect(kf[0]!.s![1]).toBe(-80);
      expect(kf[1]!.s![1]).toBe(-120);
      // X unchanged
      expect(kf[0]!.s![0]).toBe(100);
    });
  });

  describe("edge cases", () => {
    it("handles missing layers gracefully", () => {
      const input = { w: 200, h: 100, ip: 0, op: 60, fr: 30 };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      expect(result).toEqual(input);
    });

    it("handles empty layers array", () => {
      const input = { w: 200, h: 100, ip: 0, op: 60, fr: 30, layers: [] };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      expect(result.layers).toEqual([]);
    });

    it("handles layers without ks property", () => {
      const input = {
        w: 200,
        h: 100,
        ip: 0,
        op: 60,
        fr: 30,
        layers: [{ ip: 0, op: 60 }],
      };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      expect(result.layers[0]).toEqual({ ip: 0, op: 60 });
    });

    it("does not mutate the original object", () => {
      const input = JSON.parse(JSON.stringify(baseLottie));
      mirrorAnimation(input, "horizontal");
      expect(input.layers[0]!.ks.s.k[0]).toBe(100);
      expect(input.layers[0]!.ks.p.k[0]).toBe(50);
    });

    it("defaults to 512 when w/h are missing", () => {
      const input = {
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              p: { a: 0, k: [100, 100, 0] },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
        ],
      };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      // center = 512/2 = 256; newX = 256*2 - 100 = 412
      expect(result.layers[0]!.ks!.p!.k[0]).toBe(412);
    });

    it("handles multiple layers", () => {
      const input = {
        w: 200,
        h: 200,
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              p: { a: 0, k: [50, 50, 0] },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
          {
            ip: 0,
            op: 60,
            ks: {
              p: { a: 0, k: [150, 75, 0] },
              s: { a: 0, k: [80, 80, 100] },
            },
          },
        ],
      };
      const result = mirrorAnimation(input, "horizontal") as LottieResult;
      // Layer 0: center=100, newX = 200 - 50 = 150
      expect(result.layers[0]!.ks!.p!.k[0]).toBe(150);
      expect(result.layers[0]!.ks!.s!.k[0]).toBe(-100);
      // Layer 1: center=100, newX = 200 - 150 = 50
      expect(result.layers[1]!.ks!.p!.k[0]).toBe(50);
      expect(result.layers[1]!.ks!.s!.k[0]).toBe(-80);
    });
  });
});
