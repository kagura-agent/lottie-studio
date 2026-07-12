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
