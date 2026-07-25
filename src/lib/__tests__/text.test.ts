import { describe, it, expect } from "vitest";
import { generateTextAnimation, VALID_TEXT_PRESETS, TextOptions } from "../text";

type AnyLayer = Record<string, any>;

function getLayers(result: Record<string, unknown>): AnyLayer[] {
  return result.layers as AnyLayer[];
}

function getShapeCount(result: Record<string, unknown>, charIdx = 0): number {
  const layers = getLayers(result);
  return layers[charIdx].shapes.filter((s: any) => s.ty === "sh").length;
}

describe("text animation generator", () => {
  describe("generateTextAnimation", () => {
    it("returns valid Lottie structure", () => {
      const result = generateTextAnimation("Hi");
      expect(result).toHaveProperty("v", "5.7.0");
      expect(result).toHaveProperty("fr", 30);
      expect(result).toHaveProperty("ip", 0);
      expect(result).toHaveProperty("op");
      expect(result).toHaveProperty("w", 512);
      expect(result).toHaveProperty("h", 512);
      expect(result).toHaveProperty("layers");
      expect(Array.isArray(result.layers)).toBe(true);
    });

    it("creates one shape layer per non-space character", () => {
      const result = generateTextAnimation("ABC");
      expect(getLayers(result).length).toBe(3);
    });

    it("skips space characters (no visible shapes)", () => {
      const result = generateTextAnimation("A B");
      expect(getLayers(result).length).toBe(2);
    });

    it("applies custom color", () => {
      const result = generateTextAnimation("X", { color: "#ff0000" });
      const layers = getLayers(result);
      const fill = layers[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(0);
      expect(fill.c.k[2]).toBeCloseTo(0);
    });

    it("respects size option", () => {
      const small = generateTextAnimation("A", { size: 24 });
      const large = generateTextAnimation("A", { size: 96 });
      const smallShape = getLayers(small)[0].shapes.find((s: any) => s.ty === "sh");
      const largeShape = getLayers(large)[0].shapes.find((s: any) => s.ty === "sh");
      const smallMax = Math.max(...smallShape.ks.k.v.map((p: number[]) => Math.abs(p[0]) + Math.abs(p[1])));
      const largeMax = Math.max(...largeShape.ks.k.v.map((p: number[]) => Math.abs(p[0]) + Math.abs(p[1])));
      expect(largeMax).toBeGreaterThan(smallMax);
    });

    it("each layer has ty=4 (shape layer)", () => {
      const result = generateTextAnimation("Test");
      getLayers(result).forEach((l) => expect(l.ty).toBe(4));
    });

    it("handles empty string", () => {
      const result = generateTextAnimation("");
      expect(getLayers(result).length).toBe(0);
    });

    it("handles single character", () => {
      const result = generateTextAnimation("Z");
      expect(getLayers(result).length).toBe(1);
    });

    it("handles long text", () => {
      const result = generateTextAnimation("ABCDEFGHIJKLMNOP");
      expect(getLayers(result).length).toBe(16);
    });

    it("uses default options when none provided", () => {
      const result = generateTextAnimation("A");
      expect(result.fr).toBe(30);
      expect(result.w).toBe(512);
      const layers = getLayers(result);
      const fill = layers[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(1);
    });

    it("layers are in reverse order (last char first)", () => {
      const result = generateTextAnimation("AB");
      const layers = getLayers(result);
      expect(layers[0].nm).toContain("1");
      expect(layers[1].nm).toContain("0");
    });

    it("names space layers correctly", () => {
      const result = generateTextAnimation("A A");
      const layers = getLayers(result);
      const names = layers.map((l) => l.nm);
      expect(names.some((n: string) => n.includes("space"))).toBe(false);
    });
  });

  describe("parseColor (via generateTextAnimation)", () => {
    it("parses 6-char hex with #", () => {
      const result = generateTextAnimation("A", { color: "#00ff00" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(0);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(0);
    });

    it("parses 6-char hex without #", () => {
      const result = generateTextAnimation("A", { color: "0000ff" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(0);
      expect(fill.c.k[1]).toBeCloseTo(0);
      expect(fill.c.k[2]).toBeCloseTo(1);
    });

    it("returns white for invalid hex", () => {
      const result = generateTextAnimation("A", { color: "xyz" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(1);
    });

    it("returns white for undefined color", () => {
      const result = generateTextAnimation("A", {});
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(1);
    });

    it("returns white for empty string color", () => {
      const result = generateTextAnimation("A", { color: "" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
    });

    it("parses case-insensitive hex", () => {
      const result = generateTextAnimation("A", { color: "#FF8800" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(0x88 / 255);
      expect(fill.c.k[2]).toBeCloseTo(0);
    });

    it("returns white for 3-char hex (unsupported)", () => {
      const result = generateTextAnimation("A", { color: "#fff" });
      const fill = getLayers(result)[0].shapes.find((s: any) => s.ty === "fl");
      expect(fill.c.k[0]).toBeCloseTo(1);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(1);
    });
  });

  describe("charToPath branches", () => {
    const expectedShapeCounts: Record<string, number> = {
      A: 3, B: 6, C: 3, D: 5, E: 4, F: 3, G: 5, H: 3, I: 3, J: 3,
      K: 3, L: 2, M: 4, N: 3, O: 4, P: 4, Q: 5, R: 5, S: 5, T: 2,
      U: 3, V: 2, W: 4, X: 2, Y: 3, Z: 3,
      "0": 5, "1": 2, "2": 5, "3": 4, "4": 3, "5": 5, "6": 5, "7": 2, "8": 5, "9": 5,
      ".": 1, ",": 2, "!": 2, "?": 5, "-": 1,
    };

    it.each(Object.entries(expectedShapeCounts))(
      "character '%s' produces %i shapes",
      (ch, count) => {
        const result = generateTextAnimation(ch);
        expect(getShapeCount(result)).toBe(count);
      }
    );

    it("space produces no layers", () => {
      const result = generateTextAnimation(" ");
      expect(getLayers(result).length).toBe(0);
    });

    it("default/unknown character produces 1 filled rect", () => {
      const result = generateTextAnimation("@");
      expect(getShapeCount(result)).toBe(1);
    });

    it("lowercase maps to uppercase", () => {
      const upper = generateTextAnimation("A");
      const lower = generateTextAnimation("a");
      const upperShapes = getLayers(upper)[0].shapes.filter((s: any) => s.ty === "sh");
      const lowerShapes = getLayers(lower)[0].shapes.filter((s: any) => s.ty === "sh");
      expect(lowerShapes.length).toBe(upperShapes.length);
      for (let i = 0; i < upperShapes.length; i++) {
        expect(lowerShapes[i].ks.k).toEqual(upperShapes[i].ks.k);
      }
    });

    it("shapes have closed paths (c: true)", () => {
      const result = generateTextAnimation("A");
      const shapes = getLayers(result)[0].shapes.filter((s: any) => s.ty === "sh");
      shapes.forEach((s: any) => expect(s.ks.k.c).toBe(true));
    });

    it("shapes have correct bezier handle structure", () => {
      const result = generateTextAnimation("B");
      const shapes = getLayers(result)[0].shapes.filter((s: any) => s.ty === "sh");
      shapes.forEach((s: any) => {
        const k = s.ks.k;
        expect(k.v.length).toBe(k.i.length);
        expect(k.v.length).toBe(k.o.length);
      });
    });
  });

  describe("presets", () => {
    it.each(VALID_TEXT_PRESETS.map((p) => [p]))("preset %s produces valid keyframes", (preset) => {
      const result = generateTextAnimation("AB", { style: preset as TextOptions["style"] });
      const layers = getLayers(result);
      expect(layers.length).toBe(2);
      layers.forEach((l) => {
        expect(l.ks).toBeDefined();
      });
    });

    it("typewriter uses hold keyframes (h=1)", () => {
      const result = generateTextAnimation("AB", { style: "typewriter" });
      const layers = getLayers(result);
      const layer = layers.find((l) => l.ks.o.a === 1) || layers[0];
      expect(layer.ks.o.k[0].h).toBe(1);
      expect(layer.ks.o.k[0].s).toEqual([0]);
      expect(layer.ks.o.k[1].s).toEqual([100]);
    });

    it("fade-in has smooth opacity keyframes", () => {
      const result = generateTextAnimation("A", { style: "fade-in" });
      const layer = getLayers(result)[0];
      expect(layer.ks.o.a).toBe(1);
      expect(layer.ks.o.k[0].s).toEqual([0]);
      expect(layer.ks.o.k[1].s).toEqual([100]);
      expect(layer.ks.o.k[0]).not.toHaveProperty("h");
    });

    it("bounce preset has 3 position keyframes with overshoot", () => {
      const result = generateTextAnimation("A", { style: "bounce" });
      const layer = getLayers(result)[0];
      expect(layer.ks.o.a).toBe(0);
      expect(layer.ks.o.k).toBe(100);
      expect(layer.ks.p.a).toBe(1);
      expect(layer.ks.p.k.length).toBe(3);
      expect(layer.ks.p.k[0].s[1]).toBe(-30);
      expect(layer.ks.p.k[1].s[1]).toBe(5);
      expect(layer.ks.p.k[2].s[1]).toBe(0);
    });

    it("slide preset has opacity and position", () => {
      const result = generateTextAnimation("A", { style: "slide" });
      const layer = getLayers(result)[0];
      expect(layer.ks.o.a).toBe(1);
      expect(layer.ks.p.a).toBe(1);
      expect(layer.ks.p.k[0].s).toEqual([50, 0]);
      expect(layer.ks.p.k[1].s).toEqual([0, 0]);
    });

    it("wave preset has 5 position keyframes", () => {
      const result = generateTextAnimation("A", { style: "wave" });
      const layer = getLayers(result)[0];
      expect(layer.ks.o.a).toBe(0);
      expect(layer.ks.o.k).toBe(100);
      expect(layer.ks.p.a).toBe(1);
      expect(layer.ks.p.k.length).toBe(5);
      expect(layer.ks.p.k[0].s).toEqual([0, 0]);
      expect(layer.ks.p.k[1].s[1]).toBe(-15);
      expect(layer.ks.p.k[3].s[1]).toBe(10);
      expect(layer.ks.p.k[4].s).toEqual([0, 0]);
    });

    it("glitch preset has stepped opacity and jitter position", () => {
      const result = generateTextAnimation("A", { style: "glitch" });
      const layer = getLayers(result)[0];
      expect(layer.ks.o.a).toBe(1);
      expect(layer.ks.o.k.length).toBe(4);
      expect(layer.ks.o.k[0].h).toBe(1);
      expect(layer.ks.o.k[0].s).toEqual([0]);
      expect(layer.ks.o.k[1].s).toEqual([100]);
      expect(layer.ks.o.k[2].s).toEqual([0]);
      expect(layer.ks.o.k[3].s).toEqual([100]);
      expect(layer.ks.p.a).toBe(1);
      expect(layer.ks.p.k.length).toBe(4);
      expect(layer.ks.p.k[0].s).toEqual([3, -2]);
      expect(layer.ks.p.k[3].s).toEqual([0, 0]);
    });

    it("scale preset has scale keyframes from 0 to 100", () => {
      const result = generateTextAnimation("A", { style: "scale" });
      const layer = getLayers(result)[0];
      expect(layer.ks.s.a).toBe(1);
      expect(layer.ks.s.k[0].s).toEqual([0, 0]);
      expect(layer.ks.s.k[1].s).toEqual([100, 100]);
      expect(layer.ks.o.a).toBe(1);
    });

    it("rotate preset rotates from 90 to 0", () => {
      const result = generateTextAnimation("A", { style: "rotate" });
      const layer = getLayers(result)[0];
      expect(layer.ks.r.a).toBe(1);
      expect(layer.ks.r.k[0].s).toEqual([90]);
      expect(layer.ks.r.k[1].s).toEqual([0]);
      expect(layer.ks.o.a).toBe(1);
    });

    it("stagger timing increases per character", () => {
      const result = generateTextAnimation("ABCD", { style: "fade-in" });
      const layers = getLayers(result);
      const sorted = [...layers].sort((a, b) => a.ind - b.ind);
      const starts = sorted.map((l) => l.ks.o.k[0].t);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
      }
    });

    it("stagger delay is capped at 4 frames", () => {
      const result = generateTextAnimation("AB", { style: "fade-in" });
      const layers = getLayers(result);
      const sorted = [...layers].sort((a, b) => a.ind - b.ind);
      const delay = sorted[1].ks.o.k[0].t - sorted[0].ks.o.k[0].t;
      expect(delay).toBeLessThanOrEqual(4);
    });

    it("endFrame does not exceed totalFrames", () => {
      const result = generateTextAnimation("ABCDEFGHIJ", { style: "fade-in" });
      const layers = getLayers(result);
      const totalFrames = result.op as number;
      layers.forEach((l) => {
        const lastKf = l.ks.o.k[l.ks.o.k.length - 1];
        expect(lastKf.t).toBeLessThanOrEqual(totalFrames);
      });
    });
  });

  describe("alignment", () => {
    it("left align positions text near left edge", () => {
      const result = generateTextAnimation("A", { align: "left" });
      const layers = getLayers(result);
      expect(layers[0].ks.p.k[0]).toBeCloseTo(24);
    });

    it("right align positions text near right edge", () => {
      const result = generateTextAnimation("A", { align: "right" });
      const layers = getLayers(result);
      expect(layers[0].ks.p.k[0]).toBeGreaterThan(400);
    });

    it("center align centers the text", () => {
      const result = generateTextAnimation("AA", { align: "center" });
      const layers = getLayers(result);
      const sorted = [...layers].sort((a, b) => a.ind - b.ind);
      const leftEdge = sorted[0].ks.p.k[0];
      const rightEdge = sorted[1].ks.p.k[0] + 48 * 0.7;
      const center = (leftEdge + rightEdge) / 2;
      expect(center).toBeCloseTo(256, 0);
    });

    it("default align is center", () => {
      const withCenter = generateTextAnimation("AB", { align: "center" });
      const withDefault = generateTextAnimation("AB");
      const cLayers = getLayers(withCenter).sort((a, b) => a.ind - b.ind);
      const dLayers = getLayers(withDefault).sort((a, b) => a.ind - b.ind);
      expect(dLayers[0].ks.p.k[0]).toBeCloseTo(cLayers[0].ks.p.k[0]);
    });
  });
});
