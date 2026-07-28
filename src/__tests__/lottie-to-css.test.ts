import { describe, it, expect } from "vitest";
import { convertLottieToCss, buildCssPreviewSrcdoc } from "@/lib/lottie-to-css";

// Helper to create a minimal valid Lottie animation object
function makeAnim(overrides: Partial<Record<string, unknown>> = {}, layers: unknown[] = []) {
  return {
    w: 400,
    h: 400,
    ip: 0,
    op: 60,
    fr: 30,
    layers,
    ...overrides,
  };
}

// Helper to create a basic shape layer (ty=4)
function shapeLayer(ks: unknown = { p: { a: 0, k: [0, 0] } }, extra: Record<string, unknown> = {}) {
  return { ty: 4, nm: "Shape", ks, ...extra };
}

// Helper to create a solid layer (ty=1)
function solidLayer(ks: unknown = { p: { a: 0, k: [0, 0] } }, extra: Record<string, unknown> = {}) {
  return { ty: 1, nm: "Solid", ks, ...extra };
}

describe("convertLottieToCss", () => {
  describe("invalid format rejection", () => {
    it("rejects when layers is missing", () => {
      const result = convertLottieToCss({ fr: 30, op: 60, ip: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Invalid Lottie animation format");
      }
    });

    it("rejects when fr is missing", () => {
      const result = convertLottieToCss({ layers: [], op: 60, ip: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Invalid Lottie animation format");
      }
    });

    it("rejects when op is undefined", () => {
      const result = convertLottieToCss({ layers: [], fr: 30, ip: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Invalid Lottie animation format");
      }
    });

    it("rejects when ip is undefined", () => {
      const result = convertLottieToCss({ layers: [], fr: 30, op: 60 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Invalid Lottie animation format");
      }
    });

    it("rejects completely empty object", () => {
      const result = convertLottieToCss({});
      expect(result.success).toBe(false);
    });
  });

  describe("getUnsupportedReasons", () => {
    it("detects precomp layers (ty=0)", () => {
      const result = convertLottieToCss(makeAnim({}, [{ ty: 0, nm: "Precomp" }]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Precomposition layers are not supported in CSS animations");
      }
    });

    it("detects image layers (ty=2)", () => {
      const result = convertLottieToCss(makeAnim({}, [{ ty: 2, nm: "Image" }]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Image layers are not supported in CSS animations");
      }
    });

    it("detects layer masks", () => {
      const result = convertLottieToCss(makeAnim({}, [{ ty: 4, hasMask: true }]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Layer masks are not supported in CSS animations");
      }
    });

    it("detects matte/track matte", () => {
      const result = convertLottieToCss(makeAnim({}, [{ ty: 4, tt: 1 }]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Matte/track matte effects are not supported in CSS animations");
      }
    });

    it("detects effects", () => {
      const result = convertLottieToCss(makeAnim({}, [{ ty: 4, ef: [{ ty: 21 }] }]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Layer effects are not supported in CSS animations");
      }
    });

    it("does not flag empty effects array", () => {
      const result = convertLottieToCss(makeAnim({}, [shapeLayer({ p: { a: 0, k: [0, 0] } }, { ef: [] })]));
      expect(result.success).toBe(true);
    });

    it("detects path morphing (animated shape path)", () => {
      const layer = {
        ty: 4,
        shapes: [{ ty: "sh", ks: { a: 1, k: [] } }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Path morphing is not supported in CSS animations");
      }
    });

    it("does not flag non-animated shape path", () => {
      const layer = {
        ty: 4,
        ks: { p: { a: 0, k: [0, 0] } },
        shapes: [{ ty: "sh", ks: { a: 0, k: {} } }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(true);
    });

    it("detects trim paths", () => {
      const layer = {
        ty: 4,
        shapes: [{ ty: "tm" }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Trim paths are not supported in CSS animations");
      }
    });

    it("detects nested trim paths in groups", () => {
      const layer = {
        ty: 4,
        shapes: [{ ty: "gr", it: [{ ty: "tm" }] }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Trim paths are not supported in CSS animations");
      }
    });

    it("detects nested path morphing in groups", () => {
      const layer = {
        ty: 4,
        shapes: [{ ty: "gr", it: [{ ty: "sh", ks: { a: 1, k: [] } }] }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons).toContain("Path morphing is not supported in CSS animations");
      }
    });

    it("deduplicates identical unsupported reasons from multiple layers", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          { ty: 0, nm: "Precomp 1" },
          { ty: 0, nm: "Precomp 2" },
          { ty: 2, nm: "Image 1" },
          { ty: 2, nm: "Image 2" },
        ])
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have exactly one of each, not duplicates
        const precompCount = result.reasons.filter((r) =>
          r.includes("Precomposition")
        ).length;
        const imageCount = result.reasons.filter((r) =>
          r.includes("Image layers")
        ).length;
        expect(precompCount).toBe(1);
        expect(imageCount).toBe(1);
      }
    });

    it("returns multiple distinct reasons when multiple unsupported features exist", () => {
      const layer = {
        ty: 4,
        hasMask: true,
        tt: 2,
        ef: [{ ty: 5 }],
        shapes: [{ ty: "tm" }],
      };
      const result = convertLottieToCss(makeAnim({}, [layer]));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reasons.length).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe("static-only layers", () => {
    it("handles layer with no transform offset (defaults)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // No transform property since all are at defaults
        expect(result.css).not.toContain("transform:");
        expect(result.css).not.toContain("opacity:");
      }
    });

    it("generates translateX/Y for position offset", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [50, 100] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("translateX(50px)");
        expect(result.css).toContain("translateY(100px)");
      }
    });

    it("generates scale for non-100% scale", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [50, 200] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("scale(0.5, 2)");
      }
    });

    it("generates rotate for non-zero rotation", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [45] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("rotate(45deg)");
      }
    });

    it("generates opacity for non-100% opacity", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [50] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("opacity: 0.5");
      }
    });

    it("generates combined transforms", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [10, 20] },
            s: { a: 0, k: [50, 50] },
            r: { a: 0, k: [90] },
            o: { a: 0, k: [75] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("translateX(10px)");
        expect(result.css).toContain("translateY(20px)");
        expect(result.css).toContain("scale(0.5, 0.5)");
        expect(result.css).toContain("rotate(90deg)");
        expect(result.css).toContain("opacity: 0.75");
      }
    });
  });

  describe("animated layers", () => {
    it("generates @keyframes for animated position", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], e: [100, 100], o: { x: 0.5, y: 0 }, i: { x: 0.5, y: 1 } },
                { t: 30, s: [100, 100], e: [200, 200], o: { x: 0.5, y: 0 }, i: { x: 0.5, y: 1 } },
                { t: 60, s: [200, 200] },
              ],
            },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("@keyframes layer-0");
        expect(result.css).toContain("translateX(0px)");
        expect(result.css).toContain("translateY(0px)");
        expect(result.css).toContain("translateX(100px)");
        expect(result.css).toContain("translateX(200px)");
        expect(result.css).toContain("animation: layer-0");
        expect(result.css).toContain("infinite");
      }
    });

    it("generates @keyframes for animated scale", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: {
              a: 1,
              k: [
                { t: 0, s: [100, 100], e: [200, 200] },
                { t: 60, s: [200, 200] },
              ],
            },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("@keyframes layer-0");
        expect(result.css).toContain("scale(1, 1)");
        expect(result.css).toContain("scale(2, 2)");
      }
    });

    it("generates @keyframes for animated rotation", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: {
              a: 1,
              k: [
                { t: 0, s: [0], e: [360] },
                { t: 60, s: [360] },
              ],
            },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("@keyframes layer-0");
        expect(result.css).toContain("rotate(0deg)");
        expect(result.css).toContain("rotate(360deg)");
      }
    });

    it("generates @keyframes for animated opacity", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: {
              a: 1,
              k: [
                { t: 0, s: [100], e: [0] },
                { t: 60, s: [0] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("@keyframes layer-0");
        expect(result.css).toContain("opacity: 1");
        expect(result.css).toContain("opacity: 0");
      }
    });

    it("combines multiple animated properties into one @keyframes", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 60, s: [100, 100] },
              ],
            },
            s: {
              a: 1,
              k: [
                { t: 0, s: [100, 100] },
                { t: 60, s: [200, 200] },
              ],
            },
            r: {
              a: 1,
              k: [
                { t: 0, s: [0] },
                { t: 60, s: [180] },
              ],
            },
            o: {
              a: 1,
              k: [
                { t: 0, s: [100] },
                { t: 60, s: [50] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("@keyframes layer-0");
        // Should have transform combining translate, scale, rotate
        expect(result.css).toContain("translateX");
        expect(result.css).toContain("scale");
        expect(result.css).toContain("rotate");
        expect(result.css).toContain("opacity");
      }
    });
  });

  describe("formatEasing (tested through keyframes)", () => {
    it("outputs linear when no tangents provided", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 60, s: [100, 100] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // Linear easing should NOT produce animation-timing-function line
        expect(result.css).not.toContain("animation-timing-function");
      }
    });

    it("outputs linear for 0,0,1,1 tangents", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } },
                { t: 60, s: [100, 100], i: { x: 1, y: 1 } },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).not.toContain("cubic-bezier");
      }
    });

    it("outputs cubic-bezier for custom tangents", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], o: { x: 0.42, y: 0 }, i: { x: 0.58, y: 1 } },
                { t: 60, s: [100, 100], i: { x: 0.58, y: 1 } },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("cubic-bezier(0.42, 0, 0.58, 1)");
      }
    });

    it("handles array tangent values (takes first element)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], o: { x: [0.33], y: [0.1] }, i: { x: [0.67], y: [0.9] } },
                { t: 60, s: [100, 100], i: { x: [0.67], y: [0.9] } },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("cubic-bezier(0.33, 0.1, 0.67, 0.9)");
      }
    });
  });

  describe("edge cases", () => {
    it("handles totalFrames=0 (op equals ip)", () => {
      const result = convertLottieToCss(
        makeAnim({ ip: 0, op: 0 }, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 30, s: [100, 100] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // With totalFrames=0, all percentages should be 0%
        expect(result.css).toContain("0%");
      }
    });

    it("skips layers without ks property", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          { ty: 4, nm: "No KS" },
          shapeLayer({
            p: { a: 0, k: [10, 20] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // The first layer without ks is skipped, but the second is included
        expect(result.html).toContain("layer-1");
        // Should not crash
      }
    });

    it("filters out null layers (ty=3)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          { ty: 3, nm: "Null", ks: { p: { a: 0, k: [0, 0] } } },
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // Null layer should not appear in HTML
        expect(result.html).not.toContain("Null");
        expect(result.html).toContain("Shape");
      }
    });

    it("handles animation with no visible layers (all null)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          { ty: 3, nm: "Null 1", ks: { p: { a: 0, k: [0, 0] } } },
          { ty: 3, nm: "Null 2", ks: { p: { a: 0, k: [0, 0] } } },
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.html).toContain("lottie-animation");
      }
    });

    it("uses default dimensions when w/h are 0 or missing", () => {
      const result = convertLottieToCss(
        makeAnim({ w: 0, h: 0 }, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // Should use 400 defaults
        expect(result.css).toContain("400px");
      }
    });

    it("uses layer nm for HTML comment, falls back to Layer N", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          { ty: 4, nm: "My Custom Name", ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [0] }, o: { a: 0, k: [100] } } },
          { ty: 4, ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [0] }, o: { a: 0, k: [100] } } },
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.html).toContain("My Custom Name");
        expect(result.html).toContain("Layer 1");
      }
    });

    it("handles getStaticValue with scalar k value", () => {
      // When k is a single number (not array) for a non-animated property
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [10, 20] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 45 }, // scalar, not array
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // getStaticValue should wrap scalar in array: [45]
        expect(result.css).toContain("rotate(45deg)");
      }
    });

    it("handles missing Y value in position keyframe (defaults to 0)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [50] }, // only X, no Y
                { t: 60, s: [100] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("translateX(50px)");
        expect(result.css).toContain("translateY(0px)");
      }
    });

    it("handles scale keyframe with missing Y value", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: {
              a: 1,
              k: [
                { t: 0, s: [150] }, // only X scale
                { t: 60, s: [200] },
              ],
            },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("scale(1.5, 1)");
      }
    });

    it("handles opacity keyframe with missing value (defaults to 100)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: {
              a: 1,
              k: [
                { t: 0, s: [] }, // empty array
                { t: 60, s: [50] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // (undefined ?? 100) / 100 = 1
        expect(result.css).toContain("opacity: 1");
        expect(result.css).toContain("opacity: 0.5");
      }
    });

    it("handles position only X offset (Y is 0)", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [100, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        // Both X and Y should be included when either is non-zero
        expect(result.css).toContain("translateX(100px)");
        expect(result.css).toContain("translateY(0px)");
      }
    });

    it("percentage keyframe calculation at midpoint", () => {
      // totalFrames = 60, keyframe at t=30 should be 50%
      const result = convertLottieToCss(
        makeAnim({ ip: 0, op: 60 }, [
          shapeLayer({
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 30, s: [50, 50] },
                { t: 60, s: [100, 100] },
              ],
            },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.css).toContain("0%");
        expect(result.css).toContain("50%");
        expect(result.css).toContain("100%");
      }
    });
  });

  describe("HTML output structure", () => {
    it("generates container div with lottie-animation class", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.html).toContain('<div class="lottie-animation">');
        expect(result.html).toContain("</div>");
      }
    });

    it("generates layer div elements with correct classes", () => {
      const result = convertLottieToCss(
        makeAnim({}, [
          shapeLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
          solidLayer({
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          }),
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.html).toContain('class="layer-0"');
        expect(result.html).toContain('class="layer-1"');
      }
    });
  });
});

describe("buildCssPreviewSrcdoc", () => {
  it("generates valid HTML document", () => {
    const result = buildCssPreviewSrcdoc("<div>test</div>", ".test { color: red; }", 800, 600);
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html>");
    expect(result).toContain("</html>");
    expect(result).toContain("<div>test</div>");
    expect(result).toContain(".test { color: red; }");
  });

  it("includes correct aspect ratio dimensions", () => {
    const result = buildCssPreviewSrcdoc("<div></div>", "", 1920, 1080);
    expect(result).toContain("aspect-ratio: 1920 / 1080");
  });

  it("includes checkerboard background styles", () => {
    const result = buildCssPreviewSrcdoc("<div></div>", "", 400, 400);
    expect(result).toContain("background-image");
    expect(result).toContain("linear-gradient(45deg");
    expect(result).toContain("background-size: 16px 16px");
  });

  it("includes lottie-animation class with max constraints", () => {
    const result = buildCssPreviewSrcdoc("<div></div>", "", 400, 400);
    expect(result).toContain("max-width: 100%");
    expect(result).toContain("max-height: 100%");
  });
});
