import { describe, it, expect } from "vitest";
import {
  duplicateLayer,
  positionGrid,
  positionCircle,
  positionLine,
  applyStagger,
  repeatPattern,
  LottieLayer,
} from "@/lib/repeat";
import { parseCommand } from "@/lib/commands";

describe("repeat", () => {
  const baseLayer: LottieLayer = {
    ind: 0,
    nm: "Shape",
    ty: 4,
    ip: 0,
    op: 60,
    ks: { p: { a: 0, k: [256, 256, 0] } },
  };

  describe("duplicateLayer", () => {
    it("creates N clones with unique indices", () => {
      const layers = duplicateLayer(baseLayer, 4, 1);
      expect(layers).toHaveLength(4);
      expect(layers[0].ind).toBe(1);
      expect(layers[3].ind).toBe(4);
      expect(layers[0].nm).toBe("Shape 1");
      expect(layers[3].nm).toBe("Shape 4");
    });

    it("deep clones — mutations don't affect source", () => {
      const layers = duplicateLayer(baseLayer, 1, 5);
      layers[0].nm = "Modified";
      expect(baseLayer.nm).toBe("Shape");
    });

    it("handles layer without name", () => {
      const noName: LottieLayer = { ind: 0, ty: 4, ip: 0, op: 60 };
      const layers = duplicateLayer(noName, 2, 1);
      expect(layers[0].nm).toBe("Layer 1");
    });
  });

  describe("positionGrid", () => {
    it("positions 3x3 grid centered on canvas", () => {
      const layers = duplicateLayer(baseLayer, 9, 1);
      positionGrid(layers, 3, 3, 80, 512, 512);
      // Center: (512-160)/2=176 start
      expect(layers[0].ks!.p!.k).toEqual([176, 176, 0]);
      expect(layers[4].ks!.p!.k).toEqual([256, 256, 0]); // center
      expect(layers[8].ks!.p!.k).toEqual([336, 336, 0]);
    });

    it("positions 2x4 grid", () => {
      const layers = duplicateLayer(baseLayer, 8, 1);
      positionGrid(layers, 2, 4, 60, 512, 512);
      expect(layers).toHaveLength(8);
      // col=0,row=0 -> startX, startY
      const startX = (512 - 60) / 2; // 226
      const startY = (512 - 180) / 2; // 166
      expect(layers[0].ks!.p!.k).toEqual([startX, startY, 0]);
    });

    it("handles 1x1 grid", () => {
      const layers = duplicateLayer(baseLayer, 1, 1);
      positionGrid(layers, 1, 1, 80, 512, 512);
      expect(layers[0].ks!.p!.k).toEqual([256, 256, 0]);
    });
  });

  describe("positionCircle", () => {
    it("positions 4 elements equally spaced", () => {
      const layers = duplicateLayer(baseLayer, 4, 1);
      positionCircle(layers, 100, 256, 256);
      // 0: top (angle = -PI/2)
      expect(layers[0].ks!.p!.k![0]).toBeCloseTo(256);
      expect(layers[0].ks!.p!.k![1]).toBeCloseTo(156);
      // 1: right
      expect(layers[1].ks!.p!.k![0]).toBeCloseTo(356);
      expect(layers[1].ks!.p!.k![1]).toBeCloseTo(256);
    });

    it("positions 8 elements in circle", () => {
      const layers = duplicateLayer(baseLayer, 8, 1);
      positionCircle(layers, 150, 256, 256);
      expect(layers).toHaveLength(8);
      // All should be radius distance from center
      for (const l of layers) {
        const [x, y] = l.ks!.p!.k as number[];
        const dist = Math.sqrt((x - 256) ** 2 + (y - 256) ** 2);
        expect(dist).toBeCloseTo(150);
      }
    });

    it("handles 1 element", () => {
      const layers = duplicateLayer(baseLayer, 1, 1);
      positionCircle(layers, 100, 256, 256);
      // angle = -PI/2, so top
      expect(layers[0].ks!.p!.k![0]).toBeCloseTo(256);
      expect(layers[0].ks!.p!.k![1]).toBeCloseTo(156);
    });

    it("positions 6 elements", () => {
      const layers = duplicateLayer(baseLayer, 6, 1);
      positionCircle(layers, 120, 256, 256);
      for (const l of layers) {
        const [x, y] = l.ks!.p!.k as number[];
        const dist = Math.sqrt((x - 256) ** 2 + (y - 256) ** 2);
        expect(dist).toBeCloseTo(120);
      }
    });

    it("positions 12 elements", () => {
      const layers = duplicateLayer(baseLayer, 12, 1);
      positionCircle(layers, 200, 256, 256);
      expect(layers).toHaveLength(12);
    });
  });

  describe("positionLine", () => {
    it("positions horizontal line", () => {
      const layers = duplicateLayer(baseLayer, 5, 1);
      positionLine(layers, 60, "horizontal", 100, 256);
      expect(layers[0].ks!.p!.k).toEqual([100, 256, 0]);
      expect(layers[4].ks!.p!.k).toEqual([340, 256, 0]);
    });

    it("positions vertical line", () => {
      const layers = duplicateLayer(baseLayer, 3, 1);
      positionLine(layers, 80, "vertical", 256, 100);
      expect(layers[0].ks!.p!.k).toEqual([256, 100, 0]);
      expect(layers[2].ks!.p!.k).toEqual([256, 260, 0]);
    });
  });

  describe("applyStagger", () => {
    it("offsets ip/op by stagger frames", () => {
      const layers = duplicateLayer(baseLayer, 3, 1);
      applyStagger(layers, 100, 30); // 100ms = 3 frames
      expect(layers[0].ip).toBe(0);
      expect(layers[0].op).toBe(60);
      expect(layers[1].ip).toBeCloseTo(3.0);
      expect(layers[1].op).toBeCloseTo(63.0);
      expect(layers[2].ip).toBeCloseTo(6.0);
      expect(layers[2].op).toBeCloseTo(66.0);
    });

    it("handles 0 stagger", () => {
      const layers = duplicateLayer(baseLayer, 2, 1);
      applyStagger(layers, 0, 30);
      expect(layers[0].ip).toBe(0);
      expect(layers[1].ip).toBe(0);
    });
  });

  describe("repeatPattern", () => {
    it("creates grid pattern", () => {
      const result = repeatPattern(baseLayer, "grid", {
        pattern: "grid",
        cols: 3,
        rows: 3,
        gap: 80,
      });
      expect(result).toHaveLength(9);
      expect(result[0].ind).toBe(1);
    });

    it("creates circle pattern", () => {
      const result = repeatPattern(baseLayer, "circle", {
        pattern: "circle",
        count: 8,
        radius: 150,
      });
      expect(result).toHaveLength(8);
    });

    it("creates line pattern with stagger", () => {
      const result = repeatPattern(baseLayer, "line", {
        pattern: "line",
        count: 6,
        spacing: 60,
        direction: "vertical",
        stagger: 50,
      });
      expect(result).toHaveLength(6);
      expect(result[0].ip).toBe(0);
      expect(result[1].ip).toBeCloseTo(1.5); // 50ms/1000*30fps
    });

    it("uses defaults when options not specified", () => {
      const result = repeatPattern(baseLayer, "grid", { pattern: "grid" });
      expect(result).toHaveLength(9); // 3x3 default
    });

    it("respects maxInd", () => {
      const result = repeatPattern(baseLayer, "circle", {
        pattern: "circle",
        count: 3,
        maxInd: 10,
      });
      expect(result[0].ind).toBe(11);
    });
  });

  describe("command parsing", () => {
    it("parses grid with dimensions", () => {
      const cmd = parseCommand("/repeat grid 4x3 --gap 20 --stagger 100ms");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "grid", cols: 4, rows: 3, gap: 20, stagger: 100 },
      });
    });

    it("parses circle with count", () => {
      const cmd = parseCommand("/repeat circle 8 --radius 150");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "circle", count: 8, radius: 150 },
      });
    });

    it("parses line with direction and stagger", () => {
      const cmd = parseCommand("/repeat line 6 --spacing 60 --direction vertical --stagger 50ms");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "line", count: 6, spacing: 60, direction: "vertical", stagger: 50 },
      });
    });

    it("parses stagger without ms suffix", () => {
      const cmd = parseCommand("/repeat circle 4 --stagger 200");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "circle", count: 4, stagger: 200 },
      });
    });

    it("returns error for missing pattern", () => {
      const cmd = parseCommand("/repeat");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("pattern required"),
      });
    });

    it("returns error for invalid pattern", () => {
      const cmd = parseCommand("/repeat spiral 5");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("pattern required"),
      });
    });

    it("returns error for invalid gap", () => {
      const cmd = parseCommand("/repeat grid 3x3 --gap -5");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("gap"),
      });
    });

    it("returns error for invalid radius", () => {
      const cmd = parseCommand("/repeat circle 6 --radius 0");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("radius"),
      });
    });

    it("returns error for invalid spacing", () => {
      const cmd = parseCommand("/repeat line 4 --spacing -10");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("spacing"),
      });
    });

    it("returns error for invalid direction", () => {
      const cmd = parseCommand("/repeat line 4 --direction diagonal");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("direction"),
      });
    });

    it("returns error for invalid stagger", () => {
      const cmd = parseCommand("/repeat grid 3x3 --stagger -50ms");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("stagger"),
      });
    });

    it("returns error for invalid cols", () => {
      const cmd = parseCommand("/repeat grid --cols 0");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("cols"),
      });
    });

    it("returns error for invalid rows", () => {
      const cmd = parseCommand("/repeat grid --rows -1");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("rows"),
      });
    });

    it("returns error for invalid count", () => {
      const cmd = parseCommand("/repeat circle --count 0");
      expect(cmd).toEqual({
        type: "error",
        message: expect.stringContaining("count"),
      });
    });

    it("parses grid with --cols and --rows flags", () => {
      const cmd = parseCommand("/repeat grid --cols 5 --rows 2 --gap 40");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "grid", cols: 5, rows: 2, gap: 40 },
      });
    });

    it("parses grid without explicit dimensions (defaults)", () => {
      const cmd = parseCommand("/repeat grid");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "grid" },
      });
    });

    it("parses line with horizontal direction", () => {
      const cmd = parseCommand("/repeat line 4 --direction horizontal");
      expect(cmd).toEqual({
        type: "repeat",
        options: { pattern: "line", count: 4, direction: "horizontal" },
      });
    });
  });
});
