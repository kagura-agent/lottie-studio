import { describe, it, expect } from "vitest";
import { analyzeAnimation } from "../suggestion-engine";

function makeLottie(overrides: Record<string, unknown> = {}) {
  return {
    layers: [],
    fr: 30,
    ip: 0,
    op: 90,
    w: 512,
    h: 512,
    ...overrides,
  };
}

function shapeLayer(nm = "Shape", extras: Record<string, unknown> = {}): Record<string, unknown> {
  return { ty: 4, nm, ks: {}, ...extras };
}

function textLayer(nm = "Text", extras: Record<string, unknown> = {}): Record<string, unknown> {
  return { ty: 5, nm, ks: {}, ...extras };
}

function animatedLayer(nm = "Animated", keyframeCount = 3): Record<string, unknown> {
  const ks: Record<string, unknown> = {};
  for (let i = 0; i < keyframeCount; i++) {
    ks[`p${i}`] = { a: 1, k: [] };
  }
  return { ty: 4, nm, ks };
}

function fillShape(r: number, g: number, b: number) {
  return { ty: "fl", c: { k: [r, g, b, 1] } };
}

function strokeShape(r: number, g: number, b: number) {
  return { ty: "st", c: { k: [r, g, b, 1] } };
}

function linearKeyframe() {
  return {
    o: { x: [0.333], y: [0] },
    i: { x: [0.667], y: [1] },
    t: 0,
    s: [0],
  };
}

describe("analyzeAnimation", () => {
  describe("invalid input", () => {
    it("returns empty for null", () => {
      expect(analyzeAnimation(null)).toEqual([]);
    });

    it("returns empty for undefined", () => {
      expect(analyzeAnimation(undefined)).toEqual([]);
    });

    it("returns empty for non-object", () => {
      expect(analyzeAnimation("string")).toEqual([]);
      expect(analyzeAnimation(42)).toEqual([]);
    });

    it("returns empty when layers is missing", () => {
      expect(analyzeAnimation({ fr: 30 })).toEqual([]);
    });

    it("returns empty when layers is not an array", () => {
      expect(analyzeAnimation({ layers: "not-array" })).toEqual([]);
    });
  });

  describe("selected layer rules", () => {
    it("suggests restyle for shape layer (ty=4)", () => {
      const json = makeLottie({ layers: [shapeLayer("Star")] });
      const result = analyzeAnimation(json, shapeLayer("Star"));
      expect(result[0].label).toContain("Restyle");
      expect(result[0].label).toContain("Star");
    });

    it("suggests text animation for text layer (ty=5)", () => {
      const json = makeLottie({ layers: [textLayer("Title")] });
      const result = analyzeAnimation(json, textLayer("Title"));
      expect(result[0].label).toContain("Animate");
      expect(result[0].label).toContain("Title");
    });

    it("suggests animate for static layer (no keyframes)", () => {
      const layer = shapeLayer("Box");
      const json = makeLottie({ layers: [layer, animatedLayer("Other", 5)] });
      const result = analyzeAnimation(json, layer);
      const animateSuggestion = result.find((s) => s.label.includes("Animate") && s.label.includes("Box"));
      expect(animateSuggestion).toBeDefined();
    });
  });

  describe("animation-level rules", () => {
    it("suggests 'Add more motion' for low-keyframe animation", () => {
      const json = makeLottie({ layers: [shapeLayer(), animatedLayer("A", 1)] });
      const result = analyzeAnimation(json);
      const motion = result.find((s) => s.label === "Add more motion");
      expect(motion).toBeDefined();
    });

    it("suggests color variety for single-color animation", () => {
      const layer = {
        ty: 4,
        nm: "Shape",
        ks: {},
        shapes: [fillShape(1, 0, 0)],
      };
      const json = makeLottie({ layers: [layer, animatedLayer("A", 5)] });
      const result = analyzeAnimation(json);
      const colorSuggestion = result.find((s) => s.label === "Add color variety");
      expect(colorSuggestion).toBeDefined();
    });

    it("suggests 'Improve easing' when linear easing is detected", () => {
      const layer = {
        ty: 4,
        nm: "Shape",
        ks: {
          p: { a: 1, k: [linearKeyframe(), linearKeyframe()] },
        },
        shapes: [fillShape(1, 0, 0), fillShape(0, 1, 0)],
      };
      const json = makeLottie({ layers: [layer] });
      const result = analyzeAnimation(json);
      const easing = result.find((s) => s.label === "Improve easing");
      expect(easing).toBeDefined();
    });

    it("suggests 'Extend duration' for short animations (<1.5s)", () => {
      const json = makeLottie({
        layers: [animatedLayer("A", 5)],
        fr: 30,
        ip: 0,
        op: 30,
      });
      const result = analyzeAnimation(json);
      const extend = result.find((s) => s.label === "Extend duration");
      expect(extend).toBeDefined();
    });

    it("suggests 'Speed it up' for long animations (>4s)", () => {
      const json = makeLottie({
        layers: [animatedLayer("A", 5)],
        fr: 30,
        ip: 0,
        op: 180,
      });
      const result = analyzeAnimation(json);
      const speed = result.find((s) => s.label === "Speed it up");
      expect(speed).toBeDefined();
    });
  });

  describe("limits and deduplication", () => {
    it("returns at most 4 suggestions", () => {
      const layer = {
        ty: 4,
        nm: "S",
        ks: { p: { a: 1, k: [linearKeyframe()] } },
        shapes: [fillShape(1, 0, 0)],
      };
      const json = makeLottie({
        layers: [layer],
        fr: 30,
        ip: 0,
        op: 30,
      });
      const result = analyzeAnimation(json, layer);
      expect(result.length).toBeLessThanOrEqual(4);
    });

    it("has no duplicate labels", () => {
      const json = makeLottie({
        layers: [shapeLayer(), shapeLayer()],
      });
      const result = analyzeAnimation(json);
      const labels = result.map((s) => s.label);
      expect(labels.length).toBe(new Set(labels).size);
    });
  });

  describe("extractColors (via analyzeAnimation)", () => {
    it("finds fill colors in nested shapes", () => {
      const layer = {
        ty: 4,
        nm: "Shape",
        ks: {},
        shapes: [fillShape(1, 0, 0)],
      };
      const json = makeLottie({ layers: [layer, animatedLayer("A", 5)] });
      const result = analyzeAnimation(json);
      const colorSuggestion = result.find((s) => s.label === "Add color variety" || s.label === "Try new palette");
      expect(colorSuggestion).toBeDefined();
    });

    it("finds stroke colors", () => {
      const layer = {
        ty: 4,
        nm: "Shape",
        ks: {},
        shapes: [strokeShape(0, 0, 1)],
      };
      const json = makeLottie({ layers: [layer, animatedLayer("A", 5)] });
      const result = analyzeAnimation(json);
      const colorSuggestion = result.find((s) => s.label === "Add color variety" || s.label === "Try new palette");
      expect(colorSuggestion).toBeDefined();
    });

    it("deduplicates identical colors", () => {
      const layer = {
        ty: 4,
        nm: "Shape",
        ks: {},
        shapes: [fillShape(1, 0, 0), fillShape(1, 0, 0)],
      };
      const json = makeLottie({ layers: [layer, animatedLayer("A", 5)] });
      const result = analyzeAnimation(json);
      const variety = result.find((s) => s.label === "Add color variety");
      expect(variety).toBeDefined();
    });
  });

  describe("hasLinearEasing (via analyzeAnimation)", () => {
    it("detects linear bezier handles on keyframes", () => {
      const layer = {
        ty: 4,
        nm: "S",
        ks: {
          p: { a: 1, k: [linearKeyframe()] },
        },
        shapes: [fillShape(1, 0, 0), fillShape(0, 1, 0)],
      };
      const json = makeLottie({ layers: [layer] });
      const result = analyzeAnimation(json);
      const easing = result.find((s) => s.label === "Improve easing");
      expect(easing).toBeDefined();
    });

    it("does not trigger for non-linear easing", () => {
      const layer = {
        ty: 4,
        nm: "S",
        ks: {
          p: {
            a: 1,
            k: [
              {
                o: { x: [0.42], y: [0] },
                i: { x: [0.58], y: [1] },
                t: 0,
                s: [0],
              },
            ],
          },
        },
        shapes: [fillShape(1, 0, 0), fillShape(0, 1, 0)],
      };
      const json = makeLottie({ layers: [layer] });
      const result = analyzeAnimation(json);
      const easing = result.find((s) => s.label === "Improve easing");
      expect(easing).toBeUndefined();
    });
  });

  describe("getLayerTypes (via analyzeAnimation)", () => {
    it("detects shape layers for glow suggestion", () => {
      const json = makeLottie({
        layers: [animatedLayer("A", 5), animatedLayer("B", 5), animatedLayer("C", 5)],
      });
      const result = analyzeAnimation(json);
      const glow = result.find((s) => s.label === "Add glow effect");
      expect(glow).toBeDefined();
    });

    it("detects text layers for enhance text suggestion", () => {
      const json = makeLottie({
        layers: [textLayer(), animatedLayer("A", 5), animatedLayer("B", 5), animatedLayer("C", 5)],
      });
      const result = analyzeAnimation(json);
      const enhance = result.find((s) => s.label === "Enhance text");
      expect(enhance).toBeDefined();
    });
  });

  describe("countKeyframes (via analyzeAnimation)", () => {
    it("counts animated properties (a=1)", () => {
      const json = makeLottie({ layers: [animatedLayer("A", 0)] });
      const result = analyzeAnimation(json);
      const motion = result.find((s) => s.label === "Add more motion");
      expect(motion).toBeDefined();
    });

    it("does not count static properties", () => {
      const json = makeLottie({
        layers: [
          {
            ty: 4,
            nm: "S",
            ks: { p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } },
          },
        ],
      });
      const result = analyzeAnimation(json);
      const motion = result.find((s) => s.label === "Add more motion");
      expect(motion).toBeDefined();
    });
  });
});
