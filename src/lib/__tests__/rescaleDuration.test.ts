import { describe, it, expect } from "vitest";
import { rescaleDuration } from "../rescaleDuration";

describe("rescaleDuration", () => {
  const baseLottie = {
    v: "5.7.1",
    fr: 30,
    ip: 0,
    op: 60, // 2 seconds at 30fps
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
          p: {
            a: 1,
            k: [
              { t: 0, s: [256, 256], e: [256, 100], i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 } },
              { t: 30, s: [256, 100], e: [256, 256], i: { x: 0.5, y: 1 }, o: { x: 0.5, y: 0 } },
              { t: 60, s: [256, 256] },
            ],
          },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          a: { a: 0, k: [0, 0] },
        },
        shapes: [],
      },
    ],
  };

  it("doubles duration from 2s to 4s", () => {
    const result = rescaleDuration(baseLottie, 4000);

    // op should be 4s * 30fps = 120
    expect(result.op).toBe(120);
    expect(result.ip).toBe(0);

    // Layer ip/op scaled
    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[0].op).toBe(120);

    // Keyframe t values doubled
    const kf = result.layers[0].ks.p.k;
    expect(kf[0].t).toBe(0);
    expect(kf[1].t).toBe(60);
    expect(kf[2].t).toBe(120);
  });

  it("halves duration from 2s to 1s", () => {
    const result = rescaleDuration(baseLottie, 1000);

    expect(result.op).toBe(30);
    expect(result.layers[0].op).toBe(30);

    const kf = result.layers[0].ks.p.k;
    expect(kf[0].t).toBe(0);
    expect(kf[1].t).toBe(15);
    expect(kf[2].t).toBe(30);
  });

  it("preserves easing curves", () => {
    const result = rescaleDuration(baseLottie, 4000);

    const kf = result.layers[0].ks.p.k;
    expect(kf[0].i).toEqual({ x: 0.5, y: 1 });
    expect(kf[0].o).toEqual({ x: 0.5, y: 0 });
    expect(kf[0].s).toEqual([256, 256]);
    expect(kf[0].e).toEqual([256, 100]);
  });

  it("handles ms input (500ms)", () => {
    const result = rescaleDuration(baseLottie, 500);

    // 0.5s * 30fps = 15 frames
    expect(result.op).toBe(15);
  });

  it("handles multiple layers", () => {
    const multiLayer = {
      ...baseLottie,
      layers: [
        {
          ty: 4,
          ip: 0,
          op: 60,
          ks: { o: { a: 0, k: 100 } },
          shapes: [],
        },
        {
          ty: 4,
          ip: 15,
          op: 45,
          ks: { o: { a: 0, k: 50 } },
          shapes: [],
        },
      ],
    };

    const result = rescaleDuration(multiLayer, 4000);

    expect(result.layers[0].ip).toBe(0);
    expect(result.layers[0].op).toBe(120);
    expect(result.layers[1].ip).toBe(30);
    expect(result.layers[1].op).toBe(90);
  });

  it("handles animation with no keyframes (static properties)", () => {
    const staticLottie = {
      fr: 24,
      ip: 0,
      op: 48, // 2 seconds at 24fps
      layers: [
        {
          ty: 4,
          ip: 0,
          op: 48,
          ks: {
            o: { a: 0, k: 100 },
            p: { a: 0, k: [256, 256] },
            s: { a: 0, k: [100, 100] },
          },
          shapes: [],
        },
      ],
    };

    const result = rescaleDuration(staticLottie, 4000);

    // 4s * 24fps = 96 frames
    expect(result.op).toBe(96);
    expect(result.layers[0].op).toBe(96);
    // Static values unchanged
    expect(result.layers[0].ks.p.k).toEqual([256, 256]);
  });

  it("handles single frame animation", () => {
    const singleFrame = {
      fr: 30,
      ip: 0,
      op: 1,
      layers: [{ ty: 4, ip: 0, op: 1, ks: {}, shapes: [] }],
    };

    const result = rescaleDuration(singleFrame, 2000);
    expect(result.op).toBe(60);
    expect(result.layers[0].op).toBe(60);
  });

  it("does not mutate the original object", () => {
    const original = JSON.parse(JSON.stringify(baseLottie));
    rescaleDuration(baseLottie, 4000);
    expect(baseLottie).toEqual(original);
  });

  it("handles zero op gracefully (returns unchanged)", () => {
    const zeroOp = { fr: 30, ip: 0, op: 0, layers: [] };
    const result = rescaleDuration(zeroOp, 2000);
    expect(result.op).toBe(0);
  });

  it("handles fractional frame values", () => {
    const result = rescaleDuration(baseLottie, 1500);
    // 1.5s * 30fps = 45 frames
    expect(result.op).toBe(45);
  });
});
