import { describe, it, expect } from "vitest";
import { rotateAnimation } from "../rotate";

describe("rotateAnimation", () => {
  it("rotates static layer by given degrees", () => {
    const input = {
      layers: [{ ks: { r: { a: 0, k: 0 } } }],
    };
    const result = rotateAnimation(input, 90) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: number };
    expect(r.k).toBe(90);
  });

  it("rotates animated layer keyframes", () => {
    const input = {
      layers: [
        {
          ks: {
            r: {
              a: 1,
              k: [
                { t: 0, s: [10], e: [20] },
                { t: 30, s: [20], e: [30] },
              ],
            },
          },
        },
      ],
    };
    const result = rotateAnimation(input, 45) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: { s: number[]; e: number[] }[] };
    expect(r.k[0].s[0]).toBe(55);
    expect(r.k[0].e[0]).toBe(65);
    expect(r.k[1].s[0]).toBe(65);
    expect(r.k[1].e[0]).toBe(75);
  });

  it("handles layers without ks property", () => {
    const input = { layers: [{ ty: 1 }] };
    const result = rotateAnimation(input, 90) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: number };
    expect(r.k).toBe(90);
  });

  it("handles layers without r property", () => {
    const input = { layers: [{ ks: { p: { a: 0, k: [0, 0] } } }] };
    const result = rotateAnimation(input, 45) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: number };
    expect(r.k).toBe(45);
  });

  it("returns json unchanged when no layers", () => {
    const input = { w: 100, h: 100 };
    const result = rotateAnimation(input, 90);
    expect(result).toEqual({ w: 100, h: 100 });
  });

  it("handles 0 degrees (no-op)", () => {
    const input = { layers: [{ ks: { r: { a: 0, k: 30 } } }] };
    const result = rotateAnimation(input, 0) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: number };
    expect(r.k).toBe(30);
  });

  it("handles negative angles", () => {
    const input = { layers: [{ ks: { r: { a: 0, k: 0 } } }] };
    const result = rotateAnimation(input, -45) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    const r = (layers[0].ks as Record<string, unknown>).r as { a: number; k: number };
    expect(r.k).toBe(-45);
  });

  it("does not mutate the original input", () => {
    const input = { layers: [{ ks: { r: { a: 0, k: 10 } } }] };
    rotateAnimation(input, 90);
    expect((input.layers[0].ks.r as { k: number }).k).toBe(10);
  });

  it("rotates multiple layers", () => {
    const input = {
      layers: [
        { ks: { r: { a: 0, k: 0 } } },
        { ks: { r: { a: 0, k: 45 } } },
      ],
    };
    const result = rotateAnimation(input, 90) as Record<string, unknown>;
    const layers = result.layers as Record<string, unknown>[];
    expect(((layers[0].ks as Record<string, unknown>).r as { k: number }).k).toBe(90);
    expect(((layers[1].ks as Record<string, unknown>).r as { k: number }).k).toBe(135);
  });
});
