import { describe, it, expect } from "vitest";
import { generateTextAnimation, VALID_TEXT_PRESETS, TextOptions } from "../text";

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
      const layers = result.layers as unknown[];
      expect(layers.length).toBe(3);
    });

    it("skips space characters (no visible shapes)", () => {
      const result = generateTextAnimation("A B");
      const layers = result.layers as unknown[];
      // space has no paths so it's skipped
      expect(layers.length).toBe(2);
    });

    it("applies custom color", () => {
      const result = generateTextAnimation("X", { color: "#ff0000" });
      const layers = result.layers as { shapes: { ty: string; c?: { k: number[] } }[] }[];
      const fill = layers[0].shapes.find((s) => s.ty === "fl");
      expect(fill!.c!.k[0]).toBeCloseTo(1);
      expect(fill!.c!.k[1]).toBeCloseTo(0);
      expect(fill!.c!.k[2]).toBeCloseTo(0);
    });

    it("respects size option", () => {
      const small = generateTextAnimation("A", { size: 24 });
      const large = generateTextAnimation("A", { size: 96 });
      const smallLayers = small.layers as { shapes: { ty: string; ks?: { k: { v: number[][] } } }[] }[];
      const largeLayers = large.layers as { shapes: { ty: string; ks?: { k: { v: number[][] } } }[] }[];
      const smallShape = smallLayers[0].shapes.find((s) => s.ty === "sh");
      const largeShape = largeLayers[0].shapes.find((s) => s.ty === "sh");
      const smallMax = Math.max(...smallShape!.ks!.k.v.map((p) => Math.abs(p[0]) + Math.abs(p[1])));
      const largeMax = Math.max(...largeShape!.ks!.k.v.map((p) => Math.abs(p[0]) + Math.abs(p[1])));
      expect(largeMax).toBeGreaterThan(smallMax);
    });

    it("each layer has ty=4 (shape layer)", () => {
      const result = generateTextAnimation("Test");
      const layers = result.layers as { ty: number }[];
      layers.forEach((l) => expect(l.ty).toBe(4));
    });
  });

  describe("presets", () => {
    it.each(VALID_TEXT_PRESETS.map((p) => [p]))("preset %s produces valid keyframes", (preset) => {
      const result = generateTextAnimation("AB", { style: preset as TextOptions["style"] });
      const layers = result.layers as { ks: Record<string, unknown> }[];
      expect(layers.length).toBe(2);
      layers.forEach((l) => {
        expect(l.ks).toBeDefined();
      });
    });

    it("typewriter uses hold keyframes (h=1)", () => {
      const result = generateTextAnimation("AB", { style: "typewriter" });
      const layers = result.layers as { ks: { o: { a: number; k: { h?: number }[] } } }[];
      const firstLayer = layers.find((l) => l.ks.o.a === 1) || layers[0];
      const opacityKf = firstLayer.ks.o.k;
      expect(opacityKf[0].h).toBe(1);
    });

    it("bounce preset has position keyframes", () => {
      const result = generateTextAnimation("A", { style: "bounce" });
      const layers = result.layers as { ks: { p: { a: number; k: unknown[] } } }[];
      expect(layers[0].ks.p.a).toBe(1);
      expect(layers[0].ks.p.k.length).toBeGreaterThan(1);
    });

    it("scale preset has scale keyframes", () => {
      const result = generateTextAnimation("A", { style: "scale" });
      const layers = result.layers as { ks: { s: { a: number; k: unknown[] } } }[];
      expect(layers[0].ks.s.a).toBe(1);
    });

    it("rotate preset has rotation keyframes", () => {
      const result = generateTextAnimation("A", { style: "rotate" });
      const layers = result.layers as { ks: { r: { a: number; k: unknown[] } } }[];
      expect(layers[0].ks.r.a).toBe(1);
    });

    it("stagger timing increases per character", () => {
      const result = generateTextAnimation("ABCD", { style: "fade-in" });
      const layers = result.layers as { ks: { o: { k: { t: number }[] } }; ind: number }[];
      const sorted = [...layers].sort((a, b) => a.ind - b.ind);
      const starts = sorted.map((l) => l.ks.o.k[0].t);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
      }
    });
  });

  describe("alignment", () => {
    it("left align positions text near left edge", () => {
      const result = generateTextAnimation("A", { align: "left" });
      const layers = result.layers as { ks: { p: { k: number[] } } }[];
      expect(layers[0].ks.p.k[0]).toBeLessThan(100);
    });

    it("right align positions text near right edge", () => {
      const result = generateTextAnimation("A", { align: "right" });
      const layers = result.layers as { ks: { p: { k: number[] } } }[];
      expect(layers[0].ks.p.k[0]).toBeGreaterThan(400);
    });
  });
});
