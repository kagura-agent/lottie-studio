import { describe, it, expect } from "vitest";
import { analyzeAnimation } from "@/lib/suggestion-engine";

const baseLottie = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [] };

describe("suggestion-engine", () => {
  it("returns empty array for null/invalid input", () => {
    expect(analyzeAnimation(null)).toEqual([]);
    expect(analyzeAnimation(undefined)).toEqual([]);
    expect(analyzeAnimation("string")).toEqual([]);
    expect(analyzeAnimation({ noLayers: true })).toEqual([]);
  });

  it("suggests adding elements for animation with no layers", () => {
    const suggestions = analyzeAnimation(baseLottie);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].label).toBe("Add visual elements");
  });

  it("suggests adding motion for simple animations with few keyframes", () => {
    const json = {
      ...baseLottie,
      layers: [{ ty: 4, nm: "Shape", ks: { p: { a: 0, k: [256, 256] } } }],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.label.includes("motion") || s.label.includes("Animate"))).toBe(true);
  });

  it("suggests color variety for single-color animations", () => {
    const json = {
      ...baseLottie,
      layers: [
        {
          ty: 4,
          nm: "Shape",
          ks: { p: { a: 0, k: [256, 256] } },
          shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }],
        },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("color") || s.label.includes("palette"))).toBe(true);
  });

  it("suggests palette change for multi-color animations", () => {
    const json = {
      ...baseLottie,
      layers: [
        {
          ty: 4,
          nm: "Shape",
          ks: { p: { a: 0, k: [256, 256] } },
          shapes: [
            { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
            { ty: "fl", c: { a: 0, k: [0, 0, 1, 1] } },
          ],
        },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("palette"))).toBe(true);
  });

  it("suggests glow effect for shape layers", () => {
    const json = {
      ...baseLottie,
      layers: [
        { ty: 4, nm: "Shape", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("glow"))).toBe(true);
  });

  it("suggests text enhancements for text layers", () => {
    const json = {
      ...baseLottie,
      layers: [
        { ty: 5, nm: "Title", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("text") || s.label.includes("Text"))).toBe(true);
  });

  it("suggests extending duration for short animations", () => {
    const json = {
      ...baseLottie,
      fr: 30,
      ip: 0,
      op: 30, // 1 second
      layers: [
        { ty: 4, nm: "Shape", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("duration") || s.label.includes("Extend"))).toBe(true);
  });

  it("suggests speeding up long animations", () => {
    const json = {
      ...baseLottie,
      fr: 30,
      ip: 0,
      op: 180, // 6 seconds
      layers: [
        { ty: 4, nm: "Shape", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.some((s) => s.label.includes("Speed") || s.label.includes("speed"))).toBe(true);
  });

  it("returns at most 4 suggestions", () => {
    const json = {
      ...baseLottie,
      layers: [
        { ty: 4, nm: "Shape", ks: { p: { a: 0, k: [256, 256] } }, shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }] },
        { ty: 5, nm: "Text", ks: { p: { a: 0, k: [256, 256] } } },
      ],
    };
    const suggestions = analyzeAnimation(json);
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });

  describe("selected layer context", () => {
    it("suggests styling for selected shape layer", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 4, nm: "Circle", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes("Circle"))).toBe(true);
    });

    it("suggests text animation for selected text layer", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 5, nm: "Heading", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions[0].label).toContain("Heading");
    });

    it("suggests animating a static selected layer", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 4, nm: "Icon", ks: { p: { a: 0, k: [100, 100] }, o: { a: 0, k: 100 } } },
          { ty: 4, nm: "BG", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.prompt.includes("Icon"))).toBe(true);
    });
  });

  describe("hasLinearEasing() inner logic", () => {
    it("detects linear easing with array tangent values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [
                { t: 0, o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [1] } },
                { t: 30 },
              ] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("easing"))).toBe(true);
    });

    it("detects linear easing with scalar tangent values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [
                { t: 0, o: { x: 0, y: 0 }, i: { x: 1, y: 1 } },
                { t: 30 },
              ] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("easing"))).toBe(true);
    });

    it("does NOT detect linear for non-linear tangent values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [
                { t: 0, o: { x: 0.5, y: 0.5 }, i: { x: 0.5, y: 0.5 } },
                { t: 30 },
              ] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("easing"))).toBe(false);
    });

    it("skips keyframes with missing o or i fields", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [
                { t: 0, o: { x: 0, y: 0 } },
                { t: 15, i: { x: 1, y: 1 } },
                { t: 30 },
              ] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("easing"))).toBe(false);
    });

    it("early-returns after finding first linear keyframe", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [
                { t: 0, o: { x: 0, y: 0 }, i: { x: 1, y: 1 } },
                { t: 15, o: { x: 0.5, y: 0.5 }, i: { x: 0.5, y: 0.5 } },
                { t: 30 },
              ] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("easing"))).toBe(true);
    });
  });

  describe("extractColors()", () => {
    it("extracts stroke colors (ty=st)", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "st", c: { a: 0, k: [0, 1, 0, 1] } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("color") || s.label.includes("palette"))).toBe(true);
    });

    it("skips color arrays with fewer than 3 elements", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: { a: 0, k: [1, 0] } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("color") || s.label.includes("palette"))).toBe(false);
    });

    it("deduplicates identical colors", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [
              { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
              { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
            ],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Add color variety")).toBe(true);
    });

    it("finds colors nested within groups", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "gr", it: [{ ty: "fl", c: { a: 0, k: [0, 0, 1, 1] } }] }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("color") || s.label.includes("palette"))).toBe(true);
    });
  });

  describe("countKeyframes()", () => {
    it("returns 0 for layer with no ks property", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: 4, nm: "S" }],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes("Animate"))).toBe(true);
    });

    it("returns 0 for layer with only a=0 properties", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: 4, nm: "S", ks: { p: { a: 0, k: [0, 0] }, o: { a: 0, k: 100 } } }],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes("Animate"))).toBe(true);
    });

    it("counts multiple a=1 properties", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S", ks: {
              p: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              r: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes("Animate"))).toBe(false);
    });
  });

  describe("getLayerTypes()", () => {
    it("skips layers without ty field", () => {
      const json = {
        ...baseLottie,
        layers: [{ nm: "NoType" }],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("glow"))).toBe(false);
      expect(suggestions.some((s) => s.label.includes("text") || s.label.includes("Text"))).toBe(false);
    });

    it("skips layers with non-number ty", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: "shape", nm: "BadType" }],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("glow"))).toBe(false);
    });
  });

  describe("analyzeAnimation() catch block", () => {
    it("skips rules that throw on malformed selectedLayer", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
          },
        ],
      };
      const badLayer: Record<string, unknown> = {};
      Object.defineProperty(badLayer, "ty", {
        get() { throw new Error("boom"); },
        enumerable: true,
      });
      const suggestions = analyzeAnimation(json, badLayer);
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe("selected layer with no name (nm)", () => {
    it("uses 'shape' as default for shape layer without nm", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 4, ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json, json.layers[0]);
      expect(suggestions.some((s) => s.label.includes('"shape"'))).toBe(true);
    });

    it("uses 'text' as default for text layer without nm", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 5, ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json, json.layers[0]);
      expect(suggestions.some((s) => s.label.includes('"text"'))).toBe(true);
    });

    it("uses 'layer' as default for static layer without nm", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 1, ks: { p: { a: 0, k: [0, 0] } } },
          { ty: 4, nm: "Other", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes('"layer"'))).toBe(true);
    });
  });

  describe("duration boundary edge cases", () => {
    it("does NOT suggest extending at exactly 1.5s", () => {
      const json = {
        ...baseLottie,
        fr: 30, ip: 0, op: 45,
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("Extend"))).toBe(false);
    });

    it("does NOT suggest speeding up at exactly 4s", () => {
      const json = {
        ...baseLottie,
        fr: 30, ip: 0, op: 120,
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("Speed"))).toBe(false);
    });

    it("falls back to fr=30 when fr is undefined", () => {
      const json = {
        ...baseLottie,
        fr: undefined, ip: 0, op: 30,
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("Extend"))).toBe(true);
    });

    it("handles fr=0 (division by zero gives Infinity duration)", () => {
      const json = {
        ...baseLottie,
        fr: 0, ip: 0, op: 30,
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("Extend"))).toBe(false);
    });
  });

  describe("max 4 suggestions with deduplication", () => {
    it("caps at 4 suggestions even when many rules match", () => {
      const json = {
        ...baseLottie,
        fr: 30, ip: 0, op: 180,
        layers: [
          {
            ty: 4, nm: "S",
            ks: { p: { a: 0, k: [0, 0] } },
            shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }],
          },
          { ty: 5, nm: "T", ks: { p: { a: 0, k: [0, 0] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.length).toBe(4);
      const labels = suggestions.map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe("layers as non-array", () => {
    it("returns empty array when layers is a string", () => {
      expect(analyzeAnimation({ layers: "not-an-array" })).toEqual([]);
    });

    it("returns empty array when layers is an object", () => {
      expect(analyzeAnimation({ layers: { 0: { ty: 4 } } })).toEqual([]);
    });
  });

  describe("nullish fallback branches", () => {
    it("handles missing op and ip for duration calculation", () => {
      const json = {
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("handles missing layers length via ?? 0 in few-layers rule", () => {
      const json = { layers: [], fr: 30, ip: 0, op: 60 };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("visual"))).toBe(true);
    });
  });

  it("all suggestions have emoji, label, and prompt", () => {
    const json = {
      ...baseLottie,
      layers: [
        { ty: 4, nm: "Shape", ks: { p: { a: 0, k: [256, 256] } }, shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }] },
      ],
    };
    const suggestions = analyzeAnimation(json);
    for (const s of suggestions) {
      expect(s.emoji).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.prompt).toBeTruthy();
      expect(s.prompt.length).toBeGreaterThan(10);
    }
  });
});
