import { describe, it, expect } from "vitest";
import { convertLottieToCss, buildCssPreviewSrcdoc } from "@/lib/lottie-to-css";

function makeAnim(overrides: Record<string, unknown> = {}) {
  return { w: 200, h: 200, ip: 0, op: 60, fr: 30, layers: [], ...overrides };
}

function makeLayer(overrides: Record<string, unknown> = {}) {
  return { ty: 4, nm: "Shape", ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [0] }, o: { a: 0, k: [100] } }, ...overrides };
}

function kf(t: number, s: number[], e?: number[], o?: Record<string, unknown>, i?: Record<string, unknown>) {
  const k: Record<string, unknown> = { t, s };
  if (e) k.e = e;
  if (o) k.o = o;
  if (i) k.i = i;
  return k;
}

describe("convertLottieToCss", () => {
  describe("invalid format", () => {
    it("rejects missing layers", () => {
      const r = convertLottieToCss({ fr: 30, op: 60, ip: 0 } as never);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Invalid Lottie animation format");
    });

    it("rejects missing fr", () => {
      const r = convertLottieToCss({ layers: [], op: 60, ip: 0 } as never);
      expect(r.success).toBe(false);
    });

    it("rejects missing op", () => {
      const r = convertLottieToCss({ layers: [], fr: 30, ip: 0 } as never);
      expect(r.success).toBe(false);
    });

    it("rejects missing ip", () => {
      const r = convertLottieToCss({ layers: [], fr: 30, op: 60 } as never);
      expect(r.success).toBe(false);
    });
  });

  describe("getUnsupportedReasons", () => {
    it("detects precomp layers (ty=0)", () => {
      const r = convertLottieToCss(makeAnim({ layers: [{ ty: 0 }] }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Precomposition layers are not supported in CSS animations");
    });

    it("detects image layers (ty=2)", () => {
      const r = convertLottieToCss(makeAnim({ layers: [{ ty: 2 }] }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Image layers are not supported in CSS animations");
    });

    it("detects masks", () => {
      const r = convertLottieToCss(makeAnim({ layers: [{ ty: 4, hasMask: true }] }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Layer masks are not supported in CSS animations");
    });

    it("detects mattes", () => {
      const r = convertLottieToCss(makeAnim({ layers: [{ ty: 4, tt: 1 }] }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Matte/track matte effects are not supported in CSS animations");
    });

    it("detects effects", () => {
      const r = convertLottieToCss(makeAnim({ layers: [{ ty: 4, ef: [{}] }] }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Layer effects are not supported in CSS animations");
    });

    it("skips empty effects array", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer({ ef: [] })] }));
      expect(r.success).toBe(true);
    });

    it("detects path morphing (animated shape path)", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 4, shapes: [{ ty: "sh", ks: { a: 1, k: [] } }] }],
      }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Path morphing is not supported in CSS animations");
    });

    it("does not flag non-animated shape path", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ shapes: [{ ty: "sh", ks: { a: 0, k: {} } }] })],
      }));
      expect(r.success).toBe(true);
    });

    it("detects trim paths", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 4, shapes: [{ ty: "tm" }] }],
      }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Trim paths are not supported in CSS animations");
    });

    it("detects nested trim paths in shape groups", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 4, shapes: [{ ty: "gr", it: [{ ty: "tm" }] }] }],
      }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Trim paths are not supported in CSS animations");
    });

    it("detects nested path morphing in shape groups", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 4, shapes: [{ ty: "gr", it: [{ ty: "sh", ks: { a: 1, k: [] } }] }] }],
      }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons).toContain("Path morphing is not supported in CSS animations");
    });

    it("deduplicates reasons across multiple layers", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 0 }, { ty: 0 }],
      }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.reasons.filter((x: string) => x.includes("Precomposition"))).toHaveLength(1);
    });
  });

  describe("static layers", () => {
    it("converts a basic static layer", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer()] }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain(".layer-0");
        expect(r.html).toContain("layer-0");
      }
    });

    it("applies static position transform", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ ks: { p: { a: 0, k: [50, 30] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [0] }, o: { a: 0, k: [100] } } })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("translateX(50px)");
        expect(r.css).toContain("translateY(30px)");
      }
    });

    it("applies static scale transform", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 75] }, r: { a: 0, k: [0] }, o: { a: 0, k: [100] } } })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("scale(0.5, 0.75)");
    });

    it("applies static rotation transform", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [45] }, o: { a: 0, k: [100] } } })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("rotate(45deg)");
    });

    it("applies static opacity", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: [0] }, o: { a: 0, k: [50] } } })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("opacity: 0.5");
    });

    it("omits transform when all defaults", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer()] }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).not.toMatch(/transform:/);
    });

    it("omits opacity when 100", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer()] }));
      expect(r.success).toBe(true);
      if (r.success) {
        const layerCss = r.css.split("@keyframes").shift()!;
        expect(layerCss).not.toMatch(/opacity:/);
      }
    });
  });

  describe("null layers filtered", () => {
    it("filters null layers (ty=3) from output", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 3, nm: "Null", ks: { p: { a: 0, k: [0, 0] } } }, makeLayer()],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.html).not.toContain("Null");
        expect(r.html).toContain("Shape");
      }
    });
  });

  describe("layers without ks", () => {
    it("skips layers without ks property", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [{ ty: 4, nm: "NoKs" }],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.html).not.toContain("NoKs");
      }
    });
  });

  describe("default w/h", () => {
    it("uses 400x400 when w/h missing", () => {
      const r = convertLottieToCss(makeAnim({ w: 0, h: 0, layers: [makeLayer()] }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("400px");
    });
  });

  describe("animated properties", () => {
    it("generates keyframes for animated position", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0], [100, 100]), kf(60, [100, 100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("@keyframes layer-0");
        expect(r.css).toContain("translateX(0px)");
        expect(r.css).toContain("translateX(100px)");
      }
    });

    it("generates keyframes for animated scale", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 1, k: [kf(0, [100, 100], [50, 50]), kf(60, [50, 50])] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("@keyframes layer-0");
        expect(r.css).toContain("scale(1, 1)");
        expect(r.css).toContain("scale(0.5, 0.5)");
      }
    });

    it("generates keyframes for animated rotation", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 1, k: [kf(0, [0], [360]), kf(60, [360])] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("rotate(0deg)");
        expect(r.css).toContain("rotate(360deg)");
      }
    });

    it("generates keyframes for animated opacity", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 1, k: [kf(0, [100], [0]), kf(60, [0])] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("opacity: 1");
        expect(r.css).toContain("opacity: 0");
      }
    });

    it("combines multiple animated properties", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0]), kf(60, [100, 100])] },
            s: { a: 1, k: [kf(0, [100, 100]), kf(60, [50, 50])] },
            r: { a: 0, k: [0] },
            o: { a: 1, k: [kf(0, [100]), kf(60, [50])] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("@keyframes layer-0");
        expect(r.css).toContain("translateX");
        expect(r.css).toContain("scale(");
        expect(r.css).toContain("opacity:");
      }
    });

    it("handles position keyframe with missing y value", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [50]), kf(60, [100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("translateY(0px)");
    });
  });

  describe("formatEasing", () => {
    it("returns linear when no tangent data", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0]), kf(60, [100, 100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).not.toContain("animation-timing-function");
    });

    it("returns linear for 0,0,1,1 tangents", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: {
              a: 1,
              k: [
                kf(0, [0, 0], [100, 100], { x: 0, y: 0 }, undefined),
                kf(60, [100, 100], undefined, undefined, { x: 1, y: 1 }),
              ],
            },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).not.toContain("cubic-bezier");
    });

    it("generates cubic-bezier with scalar tangents", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], e: [100, 100], o: { x: 0.42, y: 0 }, i: { x: 0, y: 0 } },
                { t: 60, s: [100, 100], i: { x: 0.58, y: 1 } },
              ],
            },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("cubic-bezier(0.42, 0, 0.58, 1)");
    });

    it("generates cubic-bezier with array tangents", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], e: [100, 100], o: { x: [0.33], y: [0.1] }, i: { x: [0], y: [0] } },
                { t: 60, s: [100, 100], i: { x: [0.67], y: [0.9] } },
              ],
            },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("cubic-bezier(0.33, 0.1, 0.67, 0.9)");
    });

    it("last keyframe has no easing (no next keyframe)", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], o: { x: 0.42, y: 0 } },
                { t: 30, s: [50, 50], o: { x: 0.42, y: 0 } },
                { t: 60, s: [100, 100] },
              ],
            },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("100%");
      }
    });
  });

  describe("generateKeyframesCss", () => {
    it("handles totalFrames=0", () => {
      const r = convertLottieToCss({
        w: 200, h: 200, ip: 0, op: 0, fr: 30,
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0]), kf(0, [100, 100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("0%");
    });

    it("calculates correct percentages", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0]), kf(30, [50, 50]), kf(60, [100, 100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("0%");
        expect(r.css).toContain("50%");
        expect(r.css).toContain("100%");
      }
    });
  });

  describe("getStaticValue", () => {
    it("returns scalar k as array", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [10, 20] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 5 },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("rotate(5deg)");
    });

    it("returns default when prop is animated", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
    });
  });

  describe("layer naming", () => {
    it("uses layer nm in HTML comment", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer({ nm: "MyLayer" })] }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.html).toContain("<!-- MyLayer -->");
    });

    it("uses fallback name when nm missing", () => {
      const r = convertLottieToCss(makeAnim({ layers: [makeLayer({ nm: undefined })] }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.html).toContain("<!-- Layer 0 -->");
    });
  });

  describe("container CSS", () => {
    it("sets container width and height", () => {
      const r = convertLottieToCss(makeAnim({ w: 300, h: 150, layers: [makeLayer()] }));
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.css).toContain("width: 300px");
        expect(r.css).toContain("height: 150px");
      }
    });
  });

  describe("animation duration", () => {
    it("calculates correct duration from frames and framerate", () => {
      const r = convertLottieToCss(makeAnim({
        ip: 0, op: 90, fr: 30,
        layers: [makeLayer({
          ks: {
            p: { a: 1, k: [kf(0, [0, 0]), kf(90, [100, 100])] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("3s infinite");
    });
  });

  describe("scale keyframes with missing values", () => {
    it("defaults missing scale values to 100", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 1, k: [{ t: 0, s: [] }, { t: 60, s: [] }] },
            r: { a: 0, k: [0] },
            o: { a: 0, k: [100] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("scale(1, 1)");
    });
  });

  describe("opacity keyframes with missing values", () => {
    it("defaults missing opacity value to 100", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({
          ks: {
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: [0] },
            o: { a: 1, k: [{ t: 0, s: [] }, { t: 60, s: [] }] },
          },
        })],
      }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.css).toContain("opacity: 1");
    });
  });

  describe("shape without ks property in hasPathMorphing", () => {
    it("does not flag shape without ks as morphing", () => {
      const r = convertLottieToCss(makeAnim({
        layers: [makeLayer({ shapes: [{ ty: "sh" }] })],
      }));
      expect(r.success).toBe(true);
    });
  });
});

describe("buildCssPreviewSrcdoc", () => {
  it("returns valid HTML document", () => {
    const result = buildCssPreviewSrcdoc("<div>test</div>", ".test{}", 200, 100);
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<div>test</div>");
    expect(result).toContain(".test{}");
  });

  it("includes aspect ratio with correct dimensions", () => {
    const result = buildCssPreviewSrcdoc("", "", 800, 600);
    expect(result).toContain("aspect-ratio: 800 / 600");
  });

  it("includes checkerboard background", () => {
    const result = buildCssPreviewSrcdoc("", "", 100, 100);
    expect(result).toContain("linear-gradient(45deg");
  });
});
