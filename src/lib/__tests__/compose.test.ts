import { describe, it, expect } from "vitest";
import { composeLayers } from "../compose";

describe("composeLayers", () => {
  const makeAnimation = (overrides = {}) => ({
    v: "5.7.1",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [],
    assets: [],
    ...overrides,
  });

  describe("basic merge with no conflicts", () => {
    it("merges source layers into target", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "Target Layer", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "Source Layer", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(2);
      expect(result.layers[0].nm).toBe("Target Layer");
      expect(result.layers[1].nm).toBe("Source Layer");
    });

    it("does not mutate original objects", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "Original", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "New", ip: 0, op: 60 }],
      });

      composeLayers(target, source);
      expect((target as { layers: unknown[] }).layers).toHaveLength(1);
      expect((source as { layers: unknown[] }).layers).toHaveLength(1);
    });
  });

  describe("layer index conflict resolution", () => {
    it("offsets source layer indices to avoid conflicts", () => {
      const target = makeAnimation({
        layers: [
          { ind: 0, nm: "A", ip: 0, op: 60 },
          { ind: 1, nm: "B", ip: 0, op: 60 },
          { ind: 2, nm: "C", ip: 0, op: 60 },
        ],
      });
      const source = makeAnimation({
        layers: [
          { ind: 0, nm: "X", ip: 0, op: 60 },
          { ind: 1, nm: "Y", ip: 0, op: 60 },
        ],
      });

      const result = composeLayers(target, source) as { layers: { ind: number; nm: string }[] };
      expect(result.layers).toHaveLength(5);
      // Source layers should have ind offset by max(target ind) + 1 = 3
      const sourceLayers = result.layers.filter((l) => l.nm === "X" || l.nm === "Y");
      expect(sourceLayers[0].ind).toBe(3); // 0 + 3
      expect(sourceLayers[1].ind).toBe(4); // 1 + 3
    });

    it("handles non-sequential target indices", () => {
      const target = makeAnimation({
        layers: [
          { ind: 0, nm: "A", ip: 0, op: 60 },
          { ind: 5, nm: "B", ip: 0, op: 60 },
        ],
      });
      const source = makeAnimation({
        layers: [{ ind: 2, nm: "X", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { layers: { ind: number; nm: string }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "X");
      expect(sourceLayer!.ind).toBe(8); // 2 + (5 + 1) = 8
    });
  });

  describe("parent reference adjustment", () => {
    it("adjusts parent references by the same offset", () => {
      const target = makeAnimation({
        layers: [
          { ind: 0, nm: "Target", ip: 0, op: 60 },
          { ind: 1, nm: "Target Child", parent: 0, ip: 0, op: 60 },
        ],
      });
      const source = makeAnimation({
        layers: [
          { ind: 0, nm: "Source Parent", ip: 0, op: 60 },
          { ind: 1, nm: "Source Child", parent: 0, ip: 0, op: 60 },
        ],
      });

      const result = composeLayers(target, source) as { layers: { ind: number; nm: string; parent?: number }[] };
      const sourceParent = result.layers.find((l) => l.nm === "Source Parent");
      const sourceChild = result.layers.find((l) => l.nm === "Source Child");
      // Offset = max(1) + 1 = 2
      expect(sourceParent!.ind).toBe(2);
      expect(sourceChild!.ind).toBe(3);
      expect(sourceChild!.parent).toBe(2); // parent 0 + offset 2
    });

    it("does not touch layers without parent", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { layers: { nm: string; parent?: number }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S");
      expect(sourceLayer!.parent).toBeUndefined();
    });
  });

  describe("frame rate normalization", () => {
    it("scales keyframe timings when source has different frame rate (30fps into 60fps)", () => {
      const target = makeAnimation({ fr: 60, op: 120 }); // 60fps, 2 seconds
      const source = makeAnimation({
        fr: 30,
        op: 60, // 30fps, 2 seconds
        layers: [
          {
            ind: 0,
            nm: "S",
            ip: 0,
            op: 60,
            ks: {
              o: { a: 1, k: [{ t: 0, s: [100] }, { t: 30, s: [50] }, { t: 60, s: [100] }] },
            },
          },
        ],
      });

      const result = composeLayers(target, source) as { layers: { nm: string; ip: number; op: number; ks: { o: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      // frRatio = 60/30 = 2
      expect(sourceLayer.ip).toBe(0);
      expect(sourceLayer.op).toBe(120); // 60 * 2
      expect(sourceLayer.ks.o.k[0].t).toBe(0);
      expect(sourceLayer.ks.o.k[1].t).toBe(60); // 30 * 2
      expect(sourceLayer.ks.o.k[2].t).toBe(120); // 60 * 2
    });

    it("scales down when source is higher fps (60fps into 30fps)", () => {
      const target = makeAnimation({ fr: 30, op: 60 });
      const source = makeAnimation({
        fr: 60,
        op: 120,
        layers: [
          {
            ind: 0,
            nm: "S",
            ip: 0,
            op: 120,
            ks: {
              p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 60, s: [100, 100] }] },
            },
          },
        ],
      });

      const result = composeLayers(target, source) as { layers: { nm: string; ip: number; op: number; ks: { p: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      // frRatio = 30/60 = 0.5
      expect(sourceLayer.ip).toBe(0);
      expect(sourceLayer.op).toBe(60); // 120 * 0.5
      expect(sourceLayer.ks.p.k[0].t).toBe(0);
      expect(sourceLayer.ks.p.k[1].t).toBe(30); // 60 * 0.5
    });

    it("does not scale when frame rates match", () => {
      const target = makeAnimation({ fr: 30, op: 60 });
      const source = makeAnimation({
        fr: 30,
        op: 60,
        layers: [
          {
            ind: 0,
            nm: "S",
            ip: 10,
            op: 50,
            ks: {
              o: { a: 1, k: [{ t: 10, s: [100] }, { t: 50, s: [0] }] },
            },
          },
        ],
      });

      const result = composeLayers(target, source) as { layers: { nm: string; ip: number; op: number; ks: { o: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      expect(sourceLayer.ip).toBe(10);
      expect(sourceLayer.op).toBe(50);
      expect(sourceLayer.ks.o.k[0].t).toBe(10);
      expect(sourceLayer.ks.o.k[1].t).toBe(50);
    });
  });

  describe("duration extension", () => {
    it("extends target duration when source is longer", () => {
      const target = makeAnimation({ fr: 30, ip: 0, op: 60 }); // 2 seconds
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 150, // 5 seconds
        layers: [{ ind: 0, nm: "S", ip: 0, op: 150 }],
      });

      const result = composeLayers(target, source) as { op: number };
      expect(result.op).toBe(150);
    });

    it("extends target duration considering frame rate conversion", () => {
      const target = makeAnimation({ fr: 60, ip: 0, op: 120 }); // 2 seconds at 60fps
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 90, // 3 seconds at 30fps
        layers: [{ ind: 0, nm: "S", ip: 0, op: 90 }],
      });

      const result = composeLayers(target, source) as { op: number };
      // Source duration in target frames: 90 * (60/30) = 180
      // 180 > 120, so extend
      expect(result.op).toBe(180);
    });

    it("does not reduce target duration when source is shorter", () => {
      const target = makeAnimation({ fr: 30, ip: 0, op: 120 }); // 4 seconds
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 30, // 1 second
        layers: [{ ind: 0, nm: "S", ip: 0, op: 30 }],
      });

      const result = composeLayers(target, source) as { op: number };
      expect(result.op).toBe(120); // unchanged
    });
  });

  describe("asset/precomp merging", () => {
    it("merges assets from source into target", () => {
      const target = makeAnimation({
        assets: [{ id: "asset1", layers: [] }],
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        assets: [{ id: "asset2", layers: [] }],
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { assets: { id: string }[] };
      expect(result.assets).toHaveLength(2);
      expect(result.assets.map((a) => a.id)).toContain("asset1");
      expect(result.assets.map((a) => a.id)).toContain("asset2");
    });

    it("does not duplicate assets with same id", () => {
      const target = makeAnimation({
        assets: [{ id: "shared", layers: [{ ind: 0 }] }],
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        assets: [{ id: "shared", layers: [{ ind: 1 }] }],
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { assets: { id: string }[] };
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe("shared");
    });

    it("creates assets array in target if not present", () => {
      const target = makeAnimation({ layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }] });
      delete (target as Record<string, unknown>).assets;
      const source = makeAnimation({
        assets: [{ id: "new_asset", layers: [] }],
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { assets: { id: string }[] };
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe("new_asset");
    });
  });

  describe("edge cases", () => {
    it("returns target unchanged when source has no layers", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({ layers: [] });

      const result = composeLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("T");
    });

    it("returns target unchanged when source layers is undefined", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512 };

      const result = composeLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(1);
    });

    it("handles target with no layers", () => {
      const target = makeAnimation({ layers: [] });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { layers: { ind: number; nm: string }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("S");
      // Offset from empty target (max 0) + 1 = 1
      expect(result.layers[0].ind).toBe(1);
    });

    it("handles target with undefined layers", () => {
      const target = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512 };
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = composeLayers(target, source) as { layers: { ind: number; nm: string }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("S");
    });

    it("handles source animation that is null-like (empty object)", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = {};

      const result = composeLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("T");
    });

    it("scales shape keyframes when frame rates differ", () => {
      const target = makeAnimation({ fr: 60, op: 120 });
      const source = makeAnimation({
        fr: 30,
        op: 60,
        layers: [
          {
            ind: 0,
            nm: "S",
            ip: 0,
            op: 60,
            shapes: [
              {
                ty: "st",
                w: { a: 1, k: [{ t: 0, s: [2] }, { t: 30, s: [5] }] },
              },
            ],
          },
        ],
      });

      const result = composeLayers(target, source) as { layers: { shapes: { w: { k: { t: number }[] } }[] }[] };
      const sourceLayer = result.layers[result.layers.length - 1];
      expect(sourceLayer.shapes[0].w.k[0].t).toBe(0);
      expect(sourceLayer.shapes[0].w.k[1].t).toBe(60); // 30 * 2
    });
  });
});
