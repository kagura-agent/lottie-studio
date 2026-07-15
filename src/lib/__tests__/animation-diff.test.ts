import { describe, it, expect } from "vitest";
import { summarizeChanges } from "../animation-diff";

describe("summarizeChanges", () => {
  const base = {
    ip: 0,
    op: 60,
    fr: 30,
    layers: [
      {
        nm: "circle",
        ty: 4,
        ks: { p: { a: 0, k: [100, 100, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } },
        shapes: [
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
          { ty: "el", s: { a: 0, k: [50, 50] } },
        ],
      },
    ],
  };

  it("returns null for identical objects", () => {
    expect(summarizeChanges(base, { ...base })).toBeNull();
  });

  it("returns null for empty animations", () => {
    expect(summarizeChanges({}, {})).toBeNull();
  });

  it("detects added layers", () => {
    const next = {
      ...base,
      layers: [
        ...base.layers,
        { nm: "shadow", ty: 4, ks: {}, shapes: [] },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain('+1 layer "shadow"');
  });

  it("detects removed layers", () => {
    const next = { ...base, layers: [] };
    const result = summarizeChanges(base, next);
    expect(result).toContain('-1 layer "circle"');
  });

  it("detects multiple added layers", () => {
    const next = {
      ...base,
      layers: [
        ...base.layers,
        { nm: "bg", ty: 4, ks: {}, shapes: [] },
        { nm: "fg", ty: 4, ks: {}, shapes: [] },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("+2 layers");
  });

  it("detects duration changes", () => {
    const next = { ...base, op: 90 };
    const result = summarizeChanges(base, next);
    expect(result).toContain("duration 60→90f");
  });

  it("detects frame rate changes", () => {
    const next = { ...base, fr: 60 };
    const result = summarizeChanges(base, next);
    expect(result).toContain("30→60 fps");
  });

  it("detects color changes", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          shapes: [
            { ty: "fl", c: { a: 0, k: [0, 0.4, 1, 1] } },
            { ty: "el", s: { a: 0, k: [50, 50] } },
          ],
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("fill #ff0000→#0066ff");
  });

  it("detects position changes", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          ks: { ...base.layers[0].ks, p: { a: 0, k: [200, 200, 0] } },
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("position changed");
  });

  it("detects scale changes", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          ks: { ...base.layers[0].ks, s: { a: 0, k: [200, 200, 100] } },
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("scale changed");
  });

  it("detects rotation changes", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          ks: { ...base.layers[0].ks, r: { a: 0, k: 45 } },
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("rotation changed");
  });

  it("detects added effects", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          ef: [{ ty: 0, nm: "blur" }],
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("+1 effect");
  });

  it("detects added shapes", () => {
    const next = {
      ...base,
      layers: [
        {
          ...base.layers[0],
          shapes: [
            ...base.layers[0].shapes,
            { ty: "rc", s: { a: 0, k: [30, 30] } },
          ],
        },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain("+1 shape");
  });

  it("uses middle dot separator", () => {
    const next = {
      ...base,
      op: 90,
      fr: 60,
      layers: [
        ...base.layers,
        { nm: "shadow", ty: 4, ks: {}, shapes: [] },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain(" · ");
  });

  it("caps at 3 changes with +N more suffix", () => {
    const next = {
      ...base,
      op: 90,
      fr: 60,
      layers: [
        {
          ...base.layers[0],
          ks: { ...base.layers[0].ks, p: { a: 0, k: [300, 300, 0] } },
          shapes: [
            { ty: "fl", c: { a: 0, k: [0, 1, 0, 1] } },
            ...base.layers[0].shapes,
            { ty: "rc", s: { a: 0, k: [30, 30] } },
          ],
          ef: [{ ty: 0, nm: "blur" }],
        },
        { nm: "new", ty: 4, ks: {}, shapes: [] },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).not.toBeNull();
    const parts = result!.split(" · ");
    expect(parts.length).toBeLessThanOrEqual(4); // 3 changes + "+N more"
    expect(parts[parts.length - 1]).toMatch(/^\+\d+ more$/);
  });

  it("detects renamed layers", () => {
    const next = {
      ...base,
      layers: [
        { ...base.layers[0], nm: "dot" },
      ],
    };
    const result = summarizeChanges(base, next);
    expect(result).toContain('renamed "circle" → "dot"');
  });
});
