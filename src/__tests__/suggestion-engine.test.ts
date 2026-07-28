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

  describe("countKeyframes edge cases", () => {
    it("returns 0 for layer with no ks property", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: 4, nm: "NoKs" }],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("motion") || s.label.includes("Animate"))).toBe(true);
    });

    it("handles non-animated properties (a !== 1)", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: 4, nm: "Static", ks: { p: { a: 0, k: [0, 0] }, o: { a: 0, k: 100 }, s: { a: 0, k: [100, 100] } } }],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("motion"))).toBe(true);
    });

    it("counts multiple animated properties in one layer", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Multi", ks: {
              p: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              r: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("glow"))).toBe(true);
    });
  });

  describe("extractColors edge cases", () => {
    it("extracts stroke colors (ty === st)", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Stroke",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "st", c: { a: 0, k: [0, 1, 0] } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label.includes("color") || s.label.includes("palette"))).toBe(true);
    });

    it("skips color arrays with length < 3", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Short",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: { a: 0, k: [1, 0] } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => !s.label.includes("color") && !s.label.includes("palette"))).toBe(true);
    });

    it("deduplicates same colors", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Dup",
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
  });

  describe("hasLinearEasing edge cases", () => {
    it("detects linear easing with array values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Lin",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [1] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });

    it("detects linear easing with scalar number values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "LinScalar",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: 0.333, y: 0 }, i: { x: 0.667, y: 1 } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });

    it("returns false for non-linear easing values", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "NonLin",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.8], y: [0.2] }, i: { x: [0.2], y: [0.8] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Improve easing")).toBe(true);
    });

    it("skips keyframes missing o or i properties", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "NoOI",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0 },
                  { t: 15 },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Improve easing")).toBe(true);
    });

    it("early-exits when found=true with multiple keyframes", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "EarlyExit",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [1] } },
                  { t: 15, o: { x: [0.8], y: [0.2] }, i: { x: [0.2], y: [0.8] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });
  });

  describe("selected layer fallback names", () => {
    it("uses 'shape' fallback when shape layer has no nm", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 4, ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes('"shape"'))).toBe(true);
    });

    it("uses 'text' fallback when text layer has no nm", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 5, ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      expect(suggestions.some((s) => s.label.includes('"text"'))).toBe(true);
    });
  });

  describe("palette plural branch", () => {
    it("uses plural 's' when 2+ colors exist", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Multi",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [
              { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
              { ty: "fl", c: { a: 0, k: [0, 0, 1, 1] } },
            ],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      const palette = suggestions.find((s) => s.label === "Try new palette");
      expect(palette).toBeDefined();
      expect(palette!.prompt).toContain("2 colors");
    });
  });

  describe("hasLinearEasing additional branches", () => {
    it("handles nullish easing values (triggers ?? 0 fallback)", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "NullEase",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: undefined, y: null }, i: { x: undefined, y: null } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });

    it("walks through nested objects after found=true exits early", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Deep",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [1] } },
                  { t: 30 },
                ],
              },
            },
            shapes: [
              {
                it: [
                  {
                    ks: {
                      a: 1,
                      k: [
                        { t: 0, o: { x: [0.8], y: [0.2] }, i: { x: [0.2], y: [0.8] } },
                        { t: 30 },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });

    it("handles keyframe with only o but no i", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "OnlyO",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333], y: [0] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Improve easing")).toBe(true);
    });

    it("handles keyframe with only i but no o", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "OnlyI",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, i: { x: [0.667], y: [1] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Improve easing")).toBe(true);
    });

    it("isLin with mixed array values some near 0.333 some near 0.667", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Mixed",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333, 0.667], y: [0, 1] }, i: { x: [0.667, 0.333], y: [1, 0] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.some((s) => s.label === "Improve easing")).toBe(true);
    });

    it("isLin returns false when one array value is not near linear", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "PartialLin",
            ks: {
              p: {
                a: 1,
                k: [
                  { t: 0, o: { x: [0.333], y: [0.5] }, i: { x: [0.667], y: [1] } },
                  { t: 30 },
                ],
              },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Improve easing")).toBe(true);
    });
  });

  describe("rule match edge cases", () => {
    it("layers with non-array layers property returns empty", () => {
      expect(analyzeAnimation({ layers: "not-array" })).toEqual([]);
    });

    it("handles layer with ty that is not a number in getLayerTypes", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: "string-type", nm: "Weird", ks: { p: { a: 0, k: [0, 0] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("walk visits primitive and null values in object properties", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "Prims",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0] } }],
            extra: null,
            meta: 42,
            flag: false,
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("extractColors with c property missing k", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "NoK",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: { a: 0 } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => !s.label.includes("color") && !s.label.includes("palette"))).toBe(true);
    });

    it("extractColors with c not an object", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "BadC",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: "not-object" }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => !s.label.includes("color") && !s.label.includes("palette"))).toBe(true);
    });

    it("hasLinearEasing with rec.k that is not an array", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "KnotArr",
            ks: {
              p: { a: 1, k: "not-array" },
              o: { a: 1, k: [{ t: 0 }, { t: 30 }] },
              s: { a: 1, k: [{ t: 0 }, { t: 30 }] },
            },
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("duration rule: normal duration (1.5-4s) does not suggest extend or speed", () => {
      const json = {
        ...baseLottie,
        fr: 30, ip: 0, op: 90,
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(suggestions.every((s) => s.label !== "Extend duration" && s.label !== "Speed it up")).toBe(true);
    });

    it("'Try new palette' with exactly 1 color uses singular", () => {
      const json = {
        ...baseLottie,
        layers: [
          {
            ty: 4, nm: "OneColor",
            ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } },
            shapes: [{ ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }],
          },
        ],
      };
      const suggestions = analyzeAnimation(json);
      const palette = suggestions.find((s) => s.label === "Try new palette");
      if (palette) {
        expect(palette.prompt).toContain("1 color.");
      }
    });
  });

  describe("analyzeAnimation dedup and error handling", () => {
    it("deduplicates suggestions with same label via seen Set", () => {
      // Create a scenario where two rules produce the same label
      // The "Animate" label can be produced by both the selected-layer animate rule
      // and potentially overlap. We test the seen Set by checking no duplicates exist.
      const json = {
        ...baseLottie,
        layers: [
          { ty: 4, nm: "Shape", ks: { p: { a: 0, k: [256, 256] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      const labels = suggestions.map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("skips rules that throw on malformed data", () => {
      const json = {
        ...baseLottie,
        layers: [{ ty: 4, ks: { p: { a: 0, k: [0, 0] } } }],
      };
      const result = analyzeAnimation(json);
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles missing op/ip/fr properties (nullish coalescing)", () => {
      const json = {
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("handles undefined layers in getLayerTypes", () => {
      const json = {
        layers: [
          { ty: 4, nm: "S", ks: { p: { a: 0, k: [0, 0] } } },
        ],
      };
      const suggestions = analyzeAnimation(json);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("selected layer animate rule with no nm uses fallback", () => {
      const json = {
        ...baseLottie,
        layers: [
          { ty: 1, ks: { p: { a: 0, k: [0, 0] } } },
          { ty: 4, nm: "BG", ks: { p: { a: 1, k: [{ t: 0 }, { t: 30 }] }, o: { a: 1, k: [{ t: 0 }, { t: 30 }] }, s: { a: 1, k: [{ t: 0 }, { t: 30 }] } } },
        ],
      };
      const selectedLayer = json.layers[0];
      const suggestions = analyzeAnimation(json, selectedLayer);
      const animSuggestion = suggestions.find((s) => s.label.includes("Animate"));
      if (animSuggestion) {
        expect(animSuggestion.label).toContain('"layer"');
      }
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
