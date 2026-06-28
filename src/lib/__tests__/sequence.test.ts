import { describe, it, expect } from "vitest";
import { sequenceLayers, offsetKeyframes } from "../sequence";
import { parseCommand } from "../commands";

describe("sequenceLayers", () => {
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

  describe("basic append (temporal offset)", () => {
    it("offsets source layers ip/op by target duration", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "Target", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "Source", ip: 0, op: 60 }],
      });

      const result = sequenceLayers(target, source) as { layers: { nm: string; ip: number; op: number }[] };
      expect(result.layers).toHaveLength(2);
      const sourceLayer = result.layers.find((l) => l.nm === "Source")!;
      // Target duration = 60 - 0 = 60, so source ip/op shift by 60
      expect(sourceLayer.ip).toBe(60);
      expect(sourceLayer.op).toBe(120);
    });

    it("does not mutate original objects", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "Original", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "New", ip: 0, op: 60 }],
      });

      sequenceLayers(target, source);
      expect((target as { layers: unknown[] }).layers).toHaveLength(1);
      expect((source as { layers: unknown[] }).layers).toHaveLength(1);
    });

    it("handles source with non-zero ip", () => {
      const target = makeAnimation({
        ip: 0,
        op: 60,
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        ip: 10,
        op: 40,
        layers: [{ ind: 0, nm: "S", ip: 10, op: 40 }],
      });

      const result = sequenceLayers(target, source) as { layers: { nm: string; ip: number; op: number }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      // timeOffset = target.op - target.ip = 60 - 0 = 60
      expect(sourceLayer.ip).toBe(70); // 10 + 60
      expect(sourceLayer.op).toBe(100); // 40 + 60
    });
  });

  describe("keyframe t values offset by target duration", () => {
    it("offsets keyframe t values in ks", () => {
      const target = makeAnimation({
        ip: 0,
        op: 60,
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
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

      const result = sequenceLayers(target, source) as { layers: { nm: string; ks: { o: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      expect(sourceLayer.ks.o.k[0].t).toBe(60); // 0 + 60
      expect(sourceLayer.ks.o.k[1].t).toBe(90); // 30 + 60
      expect(sourceLayer.ks.o.k[2].t).toBe(120); // 60 + 60
    });

    it("offsets keyframe t values in shapes", () => {
      const target = makeAnimation({
        ip: 0,
        op: 60,
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
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

      const result = sequenceLayers(target, source) as { layers: { nm: string; shapes: { w: { k: { t: number }[] } }[] }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      expect(sourceLayer.shapes[0].w.k[0].t).toBe(60); // 0 + 60
      expect(sourceLayer.shapes[0].w.k[1].t).toBe(90); // 30 + 60
    });

    it("offsets keyframe t values in effects", () => {
      const target = makeAnimation({
        ip: 0,
        op: 60,
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = makeAnimation({
        layers: [
          {
            ind: 0,
            nm: "S",
            ip: 0,
            op: 60,
            ef: [
              {
                v: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [1] }] },
              },
            ],
          },
        ],
      });

      const result = sequenceLayers(target, source) as { layers: { nm: string; ef: { v: { k: { t: number }[] } }[] }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      expect(sourceLayer.ef[0].v.k[0].t).toBe(60); // 0 + 60
      expect(sourceLayer.ef[0].v.k[1].t).toBe(120); // 60 + 60
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

      const result = sequenceLayers(target, source) as { layers: { ind: number; nm: string }[] };
      expect(result.layers).toHaveLength(5);
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

      const result = sequenceLayers(target, source) as { layers: { ind: number; nm: string }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "X");
      expect(sourceLayer!.ind).toBe(8); // 2 + (5 + 1)
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

      const result = sequenceLayers(target, source) as { layers: { ind: number; nm: string; parent?: number }[] };
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

      const result = sequenceLayers(target, source) as { layers: { nm: string; parent?: number }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S");
      expect(sourceLayer!.parent).toBeUndefined();
    });
  });

  describe("frame rate normalization", () => {
    it("scales timing when source has different frame rate (30fps into 60fps)", () => {
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

      const result = sequenceLayers(target, source) as { layers: { nm: string; ip: number; op: number; ks: { o: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      // frRatio = 60/30 = 2, timeOffset = 120 - 0 = 120
      // ip = 0*2 + 120 = 120, op = 60*2 + 120 = 240
      expect(sourceLayer.ip).toBe(120);
      expect(sourceLayer.op).toBe(240);
      // Keyframes: first scaled by frRatio, then offset by timeOffset
      expect(sourceLayer.ks.o.k[0].t).toBe(120); // 0*2 + 120
      expect(sourceLayer.ks.o.k[1].t).toBe(180); // 30*2 + 120
      expect(sourceLayer.ks.o.k[2].t).toBe(240); // 60*2 + 120
    });

    it("does not scale when frame rates match", () => {
      const target = makeAnimation({ fr: 30, ip: 0, op: 60 });
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

      const result = sequenceLayers(target, source) as { layers: { nm: string; ip: number; op: number; ks: { o: { k: { t: number }[] } } }[] };
      const sourceLayer = result.layers.find((l) => l.nm === "S")!;
      // timeOffset = 60 - 0 = 60
      expect(sourceLayer.ip).toBe(70); // 10 + 60
      expect(sourceLayer.op).toBe(110); // 50 + 60
      expect(sourceLayer.ks.o.k[0].t).toBe(70); // 10 + 60
      expect(sourceLayer.ks.o.k[1].t).toBe(110); // 50 + 60
    });
  });

  describe("duration extension", () => {
    it("extends target.op additively by source duration", () => {
      const target = makeAnimation({ fr: 30, ip: 0, op: 60 }); // 2 seconds
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 90, // 3 seconds
        layers: [{ ind: 0, nm: "S", ip: 0, op: 90 }],
      });

      const result = sequenceLayers(target, source) as { op: number };
      // result.op = target.op + (source.op - source.ip) * frRatio = 60 + 90 = 150
      expect(result.op).toBe(150);
    });

    it("extends with frame rate conversion", () => {
      const target = makeAnimation({ fr: 60, ip: 0, op: 120 }); // 2 seconds at 60fps
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 90, // 3 seconds at 30fps
        layers: [{ ind: 0, nm: "S", ip: 0, op: 90 }],
      });

      const result = sequenceLayers(target, source) as { op: number };
      // sourceDuration in target frames = 90 * (60/30) = 180
      // result.op = 120 + 180 = 300
      expect(result.op).toBe(300);
    });

    it("always extends even when source is short", () => {
      const target = makeAnimation({ fr: 30, ip: 0, op: 120 }); // 4 seconds
      const source = makeAnimation({
        fr: 30,
        ip: 0,
        op: 30, // 1 second
        layers: [{ ind: 0, nm: "S", ip: 0, op: 30 }],
      });

      const result = sequenceLayers(target, source) as { op: number };
      // result.op = 120 + 30 = 150 (additive, not max like compose)
      expect(result.op).toBe(150);
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

      const result = sequenceLayers(target, source) as { assets: { id: string }[] };
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

      const result = sequenceLayers(target, source) as { assets: { id: string }[] };
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

      const result = sequenceLayers(target, source) as { assets: { id: string }[] };
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

      const result = sequenceLayers(target, source) as { layers: { nm: string }[]; op: number };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("T");
      expect(result.op).toBe(60); // unchanged
    });

    it("returns target unchanged when source layers is undefined", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512 };

      const result = sequenceLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(1);
    });

    it("handles target with no layers (empty array)", () => {
      const target = makeAnimation({ layers: [], ip: 0, op: 60 });
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = sequenceLayers(target, source) as { layers: { ind: number; nm: string; ip: number; op: number }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("S");
      // Offset from empty target (max 0) + 1 = 1
      expect(result.layers[0].ind).toBe(1);
      // timeOffset = 60 - 0 = 60
      expect(result.layers[0].ip).toBe(60);
      expect(result.layers[0].op).toBe(120);
    });

    it("handles target with undefined layers", () => {
      const target = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512 };
      const source = makeAnimation({
        layers: [{ ind: 0, nm: "S", ip: 0, op: 60 }],
      });

      const result = sequenceLayers(target, source) as { layers: { ind: number; nm: string; ip: number }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("S");
    });

    it("handles source animation that is null-like (empty object)", () => {
      const target = makeAnimation({
        layers: [{ ind: 0, nm: "T", ip: 0, op: 60 }],
      });
      const source = {};

      const result = sequenceLayers(target, source) as { layers: { nm: string }[] };
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].nm).toBe("T");
    });
  });
});

describe("offsetKeyframes", () => {
  it("adds offset to keyframe t values", () => {
    const obj = { a: 1, k: [{ t: 0, s: [100] }, { t: 30, s: [50] }] };
    offsetKeyframes(obj, 60);
    expect(obj.k[0].t).toBe(60);
    expect(obj.k[1].t).toBe(90);
  });

  it("recurses into nested objects", () => {
    const obj = {
      p: { a: 1, k: [{ t: 10, s: [0, 0] }] },
      o: { a: 1, k: [{ t: 20, s: [100] }] },
    };
    offsetKeyframes(obj, 5);
    expect(obj.p.k[0].t).toBe(15);
    expect(obj.o.k[0].t).toBe(25);
  });

  it("handles null/undefined gracefully", () => {
    expect(() => offsetKeyframes(null, 10)).not.toThrow();
    expect(() => offsetKeyframes(undefined, 10)).not.toThrow();
  });
});

describe("parseCommand - /sequence", () => {
  it("parses /sequence with id", () => {
    const result = parseCommand("/sequence abc123");
    expect(result).toEqual({ type: "sequence", id: "abc123" });
  });

  it("parses /sequence with UUID-like id", () => {
    const result = parseCommand("/sequence 550e8400-e29b-41d4-a716-446655440000");
    expect(result).toEqual({ type: "sequence", id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("returns error for /sequence with no id", () => {
    const result = parseCommand("/sequence");
    expect(result).toEqual({ type: "error", message: "Usage: /sequence <animation-id>" });
  });

  it("takes first word as id when spaces present", () => {
    const result = parseCommand("/sequence abc123 extra stuff");
    expect(result).toEqual({ type: "sequence", id: "abc123" });
  });
});
