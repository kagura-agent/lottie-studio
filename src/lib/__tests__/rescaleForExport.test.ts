import { describe, it, expect } from "vitest";
import { rescaleForExport } from "../rescaleForExport";

describe("rescaleForExport", () => {
  const baseLottie = {
    v: "5.7.1",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      {
        ty: 4,
        nm: "Shape Layer",
        ip: 0,
        op: 60,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [256, 256, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
          a: { a: 0, k: [0, 0, 0] },
        },
      },
    ],
  };

  it("should not mutate the original data", () => {
    const original = JSON.parse(JSON.stringify(baseLottie));
    rescaleForExport(baseLottie, { targetWidth: 1080, targetHeight: 1080 });
    expect(baseLottie).toEqual(original);
  });

  it("should set target dimensions on the output", () => {
    const result = rescaleForExport(baseLottie, {
      targetWidth: 1080,
      targetHeight: 1920,
    });
    expect(result.animationData.w).toBe(1080);
    expect(result.animationData.h).toBe(1920);
  });

  describe("contain mode (default)", () => {
    it("should scale to fit within bounds for landscape target", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 1024,
        targetHeight: 512,
      });
      // 512x512 into 1024x512: scale = min(1024/512, 512/512) = min(2, 1) = 1
      expect(result.scale).toBe(1);
      // offsetX = (1024 - 512*1) / 2 = 256
      expect(result.offsetX).toBe(256);
      expect(result.offsetY).toBe(0);
    });

    it("should scale to fit within bounds for portrait target", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 512,
        targetHeight: 1024,
      });
      // 512x512 into 512x1024: scale = min(512/512, 1024/512) = min(1, 2) = 1
      expect(result.scale).toBe(1);
      expect(result.offsetX).toBe(0);
      // offsetY = (1024 - 512*1) / 2 = 256
      expect(result.offsetY).toBe(256);
    });

    it("should scale down for smaller target", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 128,
        targetHeight: 128,
      });
      // 512x512 into 128x128: scale = min(128/512, 128/512) = 0.25
      expect(result.scale).toBe(0.25);
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
    });

    it("should scale up for larger target", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 1080,
        targetHeight: 1080,
      });
      // 512x512 into 1080x1080: scale = min(1080/512, 1080/512) ≈ 2.109375
      expect(result.scale).toBeCloseTo(2.109375);
      expect(result.offsetX).toBeCloseTo(0);
      expect(result.offsetY).toBeCloseTo(0);
    });

    it("should transform layer position for contain with offset", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 1080,
        targetHeight: 1920,
      });
      // 512x512 into 1080x1920: scale = min(1080/512, 1920/512) = min(2.109, 3.75) = 2.109375
      const scale = 1080 / 512;
      const offsetX = 0; // (1080 - 512*2.109375) / 2 = 0
      const offsetY = (1920 - 512 * scale) / 2;

      const layer = result.animationData.layers[0];
      // Position was [256, 256], now [256*scale + offsetX, 256*scale + offsetY]
      expect(layer.ks.p.k[0]).toBeCloseTo(256 * scale + offsetX);
      expect(layer.ks.p.k[1]).toBeCloseTo(256 * scale + offsetY);
    });

    it("should multiply layer scale", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 256,
        targetHeight: 256,
      });
      // 512x512 into 256x256: scale = 0.5
      const layer = result.animationData.layers[0];
      // Original scale was [100, 100], now [100*0.5, 100*0.5] = [50, 50]
      expect(layer.ks.s.k[0]).toBeCloseTo(50);
      expect(layer.ks.s.k[1]).toBeCloseTo(50);
    });
  });

  describe("cover mode", () => {
    it("should scale to fill bounds completely", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 1024,
        targetHeight: 512,
        fit: "cover",
      });
      // 512x512 into 1024x512: scale = max(1024/512, 512/512) = max(2, 1) = 2
      expect(result.scale).toBe(2);
      // offsetX = (1024 - 512*2) / 2 = 0
      expect(result.offsetX).toBe(0);
      // offsetY = (512 - 512*2) / 2 = -256
      expect(result.offsetY).toBe(-256);
    });
  });

  describe("stretch mode", () => {
    it("should stretch to fill target exactly", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 1024,
        targetHeight: 256,
        fit: "stretch",
      });
      // scaleX = 1024/512 = 2, scaleY = 256/512 = 0.5
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);

      const layer = result.animationData.layers[0];
      // Position [256, 256] -> [256*2, 256*0.5] = [512, 128]
      expect(layer.ks.p.k[0]).toBeCloseTo(512);
      expect(layer.ks.p.k[1]).toBeCloseTo(128);
      // Scale [100, 100] -> [100*2, 100*0.5] = [200, 50]
      expect(layer.ks.s.k[0]).toBeCloseTo(200);
      expect(layer.ks.s.k[1]).toBeCloseTo(50);
    });
  });

  describe("animated properties", () => {
    it("should handle animated position keyframes", () => {
      const animatedLottie = {
        ...baseLottie,
        layers: [
          {
            ty: 4,
            nm: "Animated Layer",
            ip: 0,
            op: 60,
            ks: {
              o: { a: 0, k: 100 },
              p: {
                a: 1,
                k: [
                  { t: 0, s: [100, 200], e: [300, 400], i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 } },
                  { t: 30, s: [300, 400], e: [100, 200], i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 } },
                  { t: 60, s: [100, 200] },
                ],
              },
              s: {
                a: 1,
                k: [
                  { t: 0, s: [100, 100], e: [150, 150], i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 } },
                  { t: 60, s: [150, 150] },
                ],
              },
              r: { a: 0, k: 0 },
              a: { a: 0, k: [0, 0, 0] },
            },
          },
        ],
      };

      const result = rescaleForExport(animatedLottie, {
        targetWidth: 256,
        targetHeight: 256,
      });
      // scale = 0.5, offset = 0
      const layer = result.animationData.layers[0];

      // Check first keyframe start position
      expect(layer.ks.p.k[0].s[0]).toBeCloseTo(50); // 100 * 0.5
      expect(layer.ks.p.k[0].s[1]).toBeCloseTo(100); // 200 * 0.5
      // Check first keyframe end position
      expect(layer.ks.p.k[0].e[0]).toBeCloseTo(150); // 300 * 0.5
      expect(layer.ks.p.k[0].e[1]).toBeCloseTo(200); // 400 * 0.5

      // Check scale keyframes (multiplied by 0.5)
      expect(layer.ks.s.k[0].s[0]).toBeCloseTo(50); // 100 * 0.5
      expect(layer.ks.s.k[0].e[0]).toBeCloseTo(75); // 150 * 0.5
    });
  });

  describe("edge cases", () => {
    it("should handle animation with no layers", () => {
      const noLayers = { ...baseLottie, layers: [] };
      const result = rescaleForExport(noLayers, {
        targetWidth: 128,
        targetHeight: 128,
      });
      expect(result.animationData.w).toBe(128);
      expect(result.animationData.h).toBe(128);
      expect(result.animationData.layers).toEqual([]);
    });

    it("should handle same dimensions (1:1 scale)", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 512,
        targetHeight: 512,
      });
      expect(result.scale).toBe(1);
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
      // Position should be unchanged
      const layer = result.animationData.layers[0];
      expect(layer.ks.p.k[0]).toBe(256);
      expect(layer.ks.p.k[1]).toBe(256);
      // Scale should be unchanged
      expect(layer.ks.s.k[0]).toBe(100);
      expect(layer.ks.s.k[1]).toBe(100);
    });

    it("should handle layers without ks (transform)", () => {
      const noKs = {
        ...baseLottie,
        layers: [{ ty: 0, nm: "Null", ip: 0, op: 60 }],
      };
      // Should not throw
      const result = rescaleForExport(noKs, {
        targetWidth: 256,
        targetHeight: 256,
      });
      expect(result.animationData.w).toBe(256);
    });

    it("should preserve non-transform properties", () => {
      const result = rescaleForExport(baseLottie, {
        targetWidth: 128,
        targetHeight: 128,
      });
      expect(result.animationData.v).toBe("5.7.1");
      expect(result.animationData.fr).toBe(30);
      expect(result.animationData.ip).toBe(0);
      expect(result.animationData.op).toBe(60);
      expect(result.animationData.layers[0].ty).toBe(4);
      expect(result.animationData.layers[0].nm).toBe("Shape Layer");
    });
  });
});
