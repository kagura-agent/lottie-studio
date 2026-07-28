import { describe, it, expect } from "vitest";
import { convertLottieToCss, buildCssPreviewSrcdoc } from "../lib/lottie-to-css";

function makeAnim(overrides: Partial<any> = {}): any {
  return { w: 400, h: 400, ip: 0, op: 60, fr: 30, layers: [], ...overrides };
}

function makeKeyframe(t: number, s: number[], opts: any = {}): any {
  return { t, s, ...opts };
}

describe("getUnsupportedReasons (via convertLottieToCss)", () => {
  it("rejects precomp layers", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 0, ks: {} }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Precomposition layers are not supported in CSS animations");
  });

  it("rejects image layers", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 2, ks: {} }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Image layers are not supported in CSS animations");
  });

  it("rejects layers with masks", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 4, hasMask: true, ks: {} }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Layer masks are not supported in CSS animations");
  });

  it("rejects matte layers", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 4, tt: 1, ks: {} }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Matte/track matte effects are not supported in CSS animations");
  });

  it("rejects layers with effects", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 4, ef: [{}], ks: {} }] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Layer effects are not supported in CSS animations");
  });

  it("rejects path morphing (animated shape)", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: {}, shapes: [{ ty: "sh", ks: { a: 1, k: [] } }] }],
    }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Path morphing is not supported in CSS animations");
  });

  it("rejects trim paths", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: {}, shapes: [{ ty: "tm" }] }],
    }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Trim paths are not supported in CSS animations");
  });

  it("rejects nested trim paths in shape groups", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: {}, shapes: [{ ty: "gr", it: [{ ty: "tm" }] }] }],
    }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Trim paths are not supported in CSS animations");
  });

  it("rejects nested path morphing in shape groups", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: {}, shapes: [{ ty: "gr", it: [{ ty: "sh", ks: { a: 1, k: [] } }] }] }],
    }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Path morphing is not supported in CSS animations");
  });

  it("deduplicates unsupported reasons", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [
        { ty: 0, ks: {} },
        { ty: 0, ks: {} },
      ],
    }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const precompReasons = result.reasons.filter((r) => r.includes("Precomposition"));
      expect(precompReasons).toHaveLength(1);
    }
  });

  it("allows empty effects array", () => {
    const result = convertLottieToCss(makeAnim({ layers: [{ ty: 4, ef: [], ks: { p: { a: 0, k: [0, 0] } } }] }));
    expect(result.success).toBe(true);
  });

  it("allows non-animated shapes (no path morphing)", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { p: { a: 0, k: [0, 0] } }, shapes: [{ ty: "sh", ks: { a: 0, k: {} } }] }],
    }));
    expect(result.success).toBe(true);
  });
});

describe("convertLottieToCss", () => {
  it("rejects invalid format (missing layers)", () => {
    const result = convertLottieToCss({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons).toContain("Invalid Lottie animation format");
  });

  it("rejects missing fr", () => {
    const result = convertLottieToCss({ layers: [], op: 60, ip: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects missing op", () => {
    const result = convertLottieToCss({ layers: [], fr: 30, ip: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects missing ip", () => {
    const result = convertLottieToCss({ layers: [], fr: 30, op: 60 });
    expect(result.success).toBe(false);
  });

  it("handles empty layers", () => {
    const result = convertLottieToCss(makeAnim({ layers: [] }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain(".lottie-animation");
      expect(result.html).toContain("lottie-animation");
    }
  });

  it("filters out null layers (ty=3)", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [
        { ty: 3, ks: { p: { a: 0, k: [10, 10] } } },
        { ty: 4, ks: { p: { a: 0, k: [5, 5] } } },
      ],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.html).not.toContain("layer-1");
      expect(result.html).toContain("layer-0");
    }
  });

  it("skips layers without ks", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4 }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.html).not.toContain("layer-0");
    }
  });

  it("generates static-only layer with position", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { p: { a: 0, k: [10, 20] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("translateX(10px)");
      expect(result.css).toContain("translateY(20px)");
    }
  });

  it("generates static-only layer with scale", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { s: { a: 0, k: [50, 200] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("scale(0.5, 2)");
    }
  });

  it("generates static-only layer with rotation", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { r: { a: 0, k: [45] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("rotate(45deg)");
    }
  });

  it("generates static-only layer with opacity", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { o: { a: 0, k: [50] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("opacity: 0.5");
    }
  });

  it("does not add transform for zero position", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { p: { a: 0, k: [0, 0] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).not.toContain("translateX");
    }
  });

  it("does not add transform for 100% scale", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { s: { a: 0, k: [100, 100] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).not.toContain("scale");
    }
  });

  it("does not add opacity for 100", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { o: { a: 0, k: [100] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).not.toContain("opacity:");
    }
  });

  it("generates animated position keyframes", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              makeKeyframe(0, [0, 0], { o: { x: 0.5, y: 0 }, e: [100, 100] }),
              makeKeyframe(30, [100, 100], { o: { x: 0.5, y: 0 }, e: [200, 200] }),
              makeKeyframe(60, [200, 200]),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("translateX(0px)");
      expect(result.css).toContain("translateY(0px)");
      expect(result.css).toContain("animation:");
    }
  });

  it("generates animated scale keyframes", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          s: {
            a: 1,
            k: [
              makeKeyframe(0, [100, 100]),
              makeKeyframe(60, [200, 200]),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("scale(");
    }
  });

  it("generates animated rotation keyframes", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          r: {
            a: 1,
            k: [
              makeKeyframe(0, [0]),
              makeKeyframe(60, [360]),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("rotate(");
    }
  });

  it("generates animated opacity keyframes", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          o: {
            a: 1,
            k: [
              makeKeyframe(0, [100]),
              makeKeyframe(60, [0]),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("opacity:");
    }
  });

  it("uses layer name in HTML comment", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, nm: "My Shape", ks: { p: { a: 0, k: [1, 1] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.html).toContain("<!-- My Shape -->");
    }
  });

  it("uses default layer name when nm is absent", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { p: { a: 0, k: [1, 1] } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.html).toContain("<!-- Layer 0 -->");
    }
  });

  it("uses default dimensions when w/h missing", () => {
    const result = convertLottieToCss({ w: 0, h: 0, ip: 0, op: 60, fr: 30, layers: [{ ty: 4, ks: { p: { a: 0, k: [1, 1] } } }] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("400px");
    }
  });
});

describe("formatEasing", () => {
  it("returns linear when no easing tangents", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              makeKeyframe(0, [0, 0]),
              makeKeyframe(60, [100, 100]),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).not.toContain("animation-timing-function");
    }
  });

  it("generates cubic-bezier for non-linear easing", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              makeKeyframe(0, [0, 0], { o: { x: 0.42, y: 0 } }),
              makeKeyframe(60, [100, 100], { i: { x: 0.58, y: 1 } }),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("cubic-bezier(0.42, 0, 0.58, 1)");
    }
  });

  it("returns linear for 0,0,1,1 tangents", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              makeKeyframe(0, [0, 0], { o: { x: 0, y: 0 } }),
              makeKeyframe(60, [100, 100], { i: { x: 1, y: 1 } }),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).not.toContain("cubic-bezier");
    }
  });

  it("handles array tangent values", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{
        ty: 4,
        ks: {
          p: {
            a: 1,
            k: [
              makeKeyframe(0, [0, 0], { o: { x: [0.42], y: [0] } }),
              makeKeyframe(60, [100, 100], { i: { x: [0.58], y: [1] } }),
            ],
          },
        },
      }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("cubic-bezier(0.42, 0, 0.58, 1)");
    }
  });
});

describe("generateKeyframesCss — totalFrames=0 edge case", () => {
  it("uses 0% for all keyframes when totalFrames is 0", () => {
    const result = convertLottieToCss({ w: 400, h: 400, ip: 0, op: 0, fr: 30, layers: [{
      ty: 4,
      ks: {
        p: {
          a: 1,
          k: [
            makeKeyframe(0, [0, 0]),
            makeKeyframe(10, [100, 100]),
          ],
        },
      },
    }] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("0%");
    }
  });
});

describe("getStaticValue — scalar k value (line 125)", () => {
  it("handles scalar k value in property", () => {
    const result = convertLottieToCss(makeAnim({
      layers: [{ ty: 4, ks: { r: { a: 0, k: 45 } } }],
    }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.css).toContain("rotate(45deg)");
    }
  });
});

describe("buildCssPreviewSrcdoc", () => {
  it("generates valid HTML document with correct dimensions", () => {
    const html = buildCssPreviewSrcdoc("<div>test</div>", ".test{}", 800, 600);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("aspect-ratio: 800 / 600");
    expect(html).toContain(".test{}");
    expect(html).toContain("<div>test</div>");
    expect(html).toContain("linear-gradient(45deg");
  });

  it("includes checkerboard background pattern", () => {
    const html = buildCssPreviewSrcdoc("", "", 100, 100);
    expect(html).toContain("linear-gradient(45deg");
    expect(html).toContain("background-size: 16px 16px");
  });
});
