import { describe, it, expect } from "vitest";
import { convertLottieToCss } from "../lottie-to-css";

function makeLottie(overrides: Record<string, unknown> = {}) {
  return {
    w: 400,
    h: 400,
    ip: 0,
    op: 60,
    fr: 30,
    layers: [],
    ...overrides,
  };
}

function makeLayer(overrides: Record<string, unknown> = {}) {
  return {
    ty: 4, // shape layer
    nm: "Test Layer",
    ks: {
      p: { a: 0, k: [200, 200] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: [0] },
      o: { a: 0, k: [100] },
    },
    ...overrides,
  };
}

function makeAnimatedProperty(keyframes: Array<{
  t: number;
  s: number[];
  e?: number[];
  i?: { x: number | number[]; y: number | number[] };
  o?: { x: number | number[]; y: number | number[] };
}>) {
  return { a: 1, k: keyframes };
}

describe("convertLottieToCss", () => {
  describe("position animation", () => {
    it("generates valid CSS with translateX/Y keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0, y: 0 } },
                { t: 30, s: [200, 100], i: { x: 1, y: 1 } },
                { t: 60, s: [400, 200], i: { x: 1, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("translateX(");
      expect(result.css).toContain("translateY(");
      expect(result.html).toContain("layer-0");
    });
  });

  describe("rotation animation", () => {
    it("generates valid CSS with rotate keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: { a: 0, k: [200, 200] },
              s: { a: 0, k: [100, 100] },
              r: makeAnimatedProperty([
                { t: 0, s: [0], o: { x: 0, y: 0 } },
                { t: 60, s: [360], i: { x: 1, y: 1 } },
              ]),
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("rotate(");
      expect(result.css).toContain("deg");
    });
  });

  describe("opacity animation", () => {
    it("generates valid CSS with opacity keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: { a: 0, k: [200, 200] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: makeAnimatedProperty([
                { t: 0, s: [0], o: { x: 0, y: 0 } },
                { t: 60, s: [100], i: { x: 1, y: 1 } },
              ]),
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("opacity:");
    });
  });

  describe("scale animation", () => {
    it("generates valid CSS with scale keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: { a: 0, k: [200, 200] },
              s: makeAnimatedProperty([
                { t: 0, s: [50, 50], o: { x: 0, y: 0 } },
                { t: 60, s: [150, 150], i: { x: 1, y: 1 } },
              ]),
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("scale(");
    });
  });

  describe("multi-property animation", () => {
    it("combines position + rotation in same keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0, y: 0 } },
                { t: 60, s: [200, 200], i: { x: 1, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: makeAnimatedProperty([
                { t: 0, s: [0], o: { x: 0, y: 0 } },
                { t: 60, s: [180], i: { x: 1, y: 1 } },
              ]),
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("translateX(");
      expect(result.css).toContain("rotate(");
    });
  });

  describe("unsupported features", () => {
    it("returns failure for layer with hasMask", () => {
      const anim = makeLottie({
        layers: [makeLayer({ hasMask: true })],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Layer masks are not supported in CSS animations");
    });

    it("returns failure for layer with effects", () => {
      const anim = makeLottie({
        layers: [makeLayer({ ef: [{ ty: 0 }] })],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Layer effects are not supported in CSS animations");
    });

    it("returns failure for trim path in shapes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            shapes: [{ ty: "tm" }],
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Trim paths are not supported in CSS animations");
    });

    it("returns failure for precomposition layers", () => {
      const anim = makeLottie({
        layers: [makeLayer({ ty: 0 })],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Precomposition layers are not supported in CSS animations");
    });

    it("returns failure for image layers", () => {
      const anim = makeLottie({
        layers: [makeLayer({ ty: 2 })],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Image layers are not supported in CSS animations");
    });

    it("returns failure for matte layers", () => {
      const anim = makeLottie({
        layers: [makeLayer({ tt: 1 })],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reasons).toContain("Matte/track matte effects are not supported in CSS animations");
    });
  });

  describe("easing", () => {
    it("produces linear keyword for linear easing", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0, y: 0 } },
                { t: 60, s: [200, 200], i: { x: 1, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Linear easing should NOT produce animation-timing-function (it's the default)
      expect(result.css).not.toContain("cubic-bezier");
    });

    it("produces cubic-bezier for custom tangents", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0.42, y: 0 } },
                { t: 60, s: [200, 200], i: { x: 0.58, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("cubic-bezier(0.42, 0, 0.58, 1)");
    });
  });

  describe("static-only animation", () => {
    it("returns success with simple CSS and no @keyframes", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            ks: {
              p: { a: 0, k: [100, 50] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [45] },
              o: { a: 0, k: [80] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).not.toContain("@keyframes");
      expect(result.css).toContain("rotate(45deg)");
      expect(result.css).toContain("opacity: 0.8");
      expect(result.css).toContain("translateX(100px)");
      expect(result.css).toContain("translateY(50px)");
    });
  });

  describe("multi-layer animation", () => {
    it("generates multiple @keyframes rules", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({
            nm: "Layer A",
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0, y: 0 } },
                { t: 60, s: [200, 200], i: { x: 1, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
          makeLayer({
            nm: "Layer B",
            ks: {
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: makeAnimatedProperty([
                { t: 0, s: [0], o: { x: 0, y: 0 } },
                { t: 60, s: [360], i: { x: 1, y: 1 } },
              ]),
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("@keyframes layer-0");
      expect(result.css).toContain("@keyframes layer-1");
      expect(result.html).toContain("layer-0");
      expect(result.html).toContain("layer-1");
      expect(result.html).toContain("Layer A");
      expect(result.html).toContain("Layer B");
    });
  });

  describe("container and structure", () => {
    it("generates .lottie-animation container with correct dimensions", () => {
      const anim = makeLottie({
        w: 800,
        h: 600,
        layers: [makeLayer()],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("width: 800px");
      expect(result.css).toContain("height: 600px");
      expect(result.css).toContain("position: relative");
      expect(result.html).toContain('class="lottie-animation"');
    });

    it("calculates correct animation duration", () => {
      // 60 frames at 30fps = 2s
      const anim = makeLottie({
        ip: 0,
        op: 60,
        fr: 30,
        layers: [
          makeLayer({
            ks: {
              p: makeAnimatedProperty([
                { t: 0, s: [0, 0], o: { x: 0, y: 0 } },
                { t: 60, s: [200, 200], i: { x: 1, y: 1 } },
              ]),
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: [0] },
              o: { a: 0, k: [100] },
            },
          }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.css).toContain("2s");
    });
  });

  describe("null layer filtering", () => {
    it("excludes null layers (ty=3) from output", () => {
      const anim = makeLottie({
        layers: [
          makeLayer({ ty: 3, nm: "Null Layer" }), // null layer
          makeLayer({ nm: "Visible Layer" }),
        ],
      });

      const result = convertLottieToCss(anim);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.html).not.toContain("Null Layer");
      expect(result.html).toContain("Visible Layer");
    });
  });
});
