import { describe, it, expect } from "vitest";
import { validateStructure } from "../validation";

function makeLottie(overrides: Record<string, unknown> = {}) {
  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      {
        ty: 4,
        nm: "Shape",
        ind: 0,
        ip: 0,
        op: 60,
        ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256] } },
        shapes: [
          { ty: "rc", s: { a: 0, k: [100, 100] } },
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
        ],
      },
    ],
    assets: [],
    ...overrides,
  };
}

describe("validateStructure", () => {
  it("returns valid for a minimal correct animation", () => {
    const result = validateStructure(makeLottie());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  describe("invalid parent references", () => {
    it("detects parent referencing non-existent index", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "Child", ind: 0, ip: 0, op: 60, parent: 99, ks: {}, shapes: [{ ty: "fl" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_parent_reference" }));
    });

    it("passes when parent index exists", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "Parent", ind: 1, ip: 0, op: 60, ks: {}, shapes: [{ ty: "fl" }] },
          { ty: 4, nm: "Child", ind: 2, ip: 0, op: 60, parent: 1, ks: {}, shapes: [{ ty: "fl" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues.filter((i) => i.code === "invalid_parent_reference")).toHaveLength(0);
    });
  });

  describe("out-of-bounds timing", () => {
    it("detects layer timing outside animation range", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "Late", ind: 0, ip: 0, op: 120, ks: {}, shapes: [{ ty: "fl" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "out_of_bounds_timing" }));
    });

    it("passes when timing is within bounds", () => {
      const result = validateStructure(makeLottie());
      expect(result.issues.filter((i) => i.code === "out_of_bounds_timing")).toHaveLength(0);
    });
  });

  describe("duplicate layer indices", () => {
    it("detects multiple layers with same ind", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "A", ind: 0, ip: 0, op: 60, ks: {}, shapes: [{ ty: "fl" }] },
          { ty: 4, nm: "B", ind: 0, ip: 0, op: 60, ks: {}, shapes: [{ ty: "fl" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "duplicate_layer_index" }));
    });

    it("passes with unique indices", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "A", ind: 0, ip: 0, op: 60, ks: {}, shapes: [{ ty: "fl" }] },
          { ty: 4, nm: "B", ind: 1, ip: 0, op: 60, ks: {}, shapes: [{ ty: "fl" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues.filter((i) => i.code === "duplicate_layer_index")).toHaveLength(0);
    });
  });

  describe("invalid easing values", () => {
    it("detects bezier x outside 0-1", () => {
      const anim = makeLottie({
        layers: [
          {
            ty: 4, nm: "Eased", ind: 0, ip: 0, op: 60,
            shapes: [{ ty: "fl" }],
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, s: [0, 0], e: [100, 100], o: { x: [1.5], y: [0] }, i: { x: [0.5], y: [1] } },
                  { t: 60, s: [100, 100] },
                ],
              },
            },
          },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_easing_value" }));
    });

    it("passes with valid easing", () => {
      const anim = makeLottie({
        layers: [
          {
            ty: 4, nm: "Eased", ind: 0, ip: 0, op: 60,
            shapes: [{ ty: "fl" }],
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, s: [0, 0], e: [100, 100], o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
                  { t: 60, s: [100, 100] },
                ],
              },
            },
          },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues.filter((i) => i.code === "invalid_easing_value")).toHaveLength(0);
    });
  });

  describe("empty shape groups", () => {
    it("detects shape layer with no fill or stroke", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "Empty", ind: 0, ip: 0, op: 60, ks: {}, shapes: [{ ty: "rc" }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "empty_shape_group" }));
    });

    it("passes when fill exists", () => {
      const result = validateStructure(makeLottie());
      expect(result.issues.filter((i) => i.code === "empty_shape_group")).toHaveLength(0);
    });
  });

  describe("missing required properties", () => {
    it("detects layer missing ty", () => {
      const anim = makeLottie({
        layers: [{ nm: "NoType", ind: 0, ip: 0, op: 60, ks: {} }],
      });
      const result = validateStructure(anim);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_layer_type" }));
    });

    it("detects shape missing ty", () => {
      const anim = makeLottie({
        layers: [
          { ty: 4, nm: "BadShape", ind: 0, ip: 0, op: 60, ks: {}, shapes: [{ c: { a: 0, k: [1, 0, 0] } }] },
        ],
      });
      const result = validateStructure(anim);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_shape_type" }));
    });

    it("passes with all types present", () => {
      const result = validateStructure(makeLottie());
      expect(result.issues.filter((i) => i.code === "missing_layer_type" || i.code === "missing_shape_type")).toHaveLength(0);
    });
  });

  describe("orphan precomp references", () => {
    it("detects precomp referencing missing asset", () => {
      const anim = makeLottie({
        layers: [
          { ty: 0, nm: "Precomp", ind: 0, ip: 0, op: 60, refId: "missing_comp", ks: {} },
        ],
        assets: [],
      });
      const result = validateStructure(anim);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: "orphan_precomp_reference" }));
    });

    it("passes when asset exists", () => {
      const anim = makeLottie({
        layers: [
          { ty: 0, nm: "Precomp", ind: 0, ip: 0, op: 60, refId: "comp_1", ks: {} },
        ],
        assets: [{ id: "comp_1", layers: [] }],
      });
      const result = validateStructure(anim);
      expect(result.issues.filter((i) => i.code === "orphan_precomp_reference")).toHaveLength(0);
    });
  });
});
