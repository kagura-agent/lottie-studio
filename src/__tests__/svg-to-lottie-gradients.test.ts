import { describe, it, expect } from "vitest";
import { convertSvgToLottie } from "../lib/svg-to-lottie";

describe("SVG gradient support", () => {
  describe("linearGradient", () => {
    it("parses basic linear gradient with two stops", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="red"/>
            <stop offset="1" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#lg1)"/>
      </svg>`;
      const { data, warnings } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.ty).toBe("gf");
      expect(shape.t).toBe(1);
      expect(shape.s.k).toEqual([0, 0]);
      expect(shape.e.k).toEqual([100, 0]);
      expect(shape.g.p).toBe(2);
      expect(shape.g.k.k).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1]);
      expect(warnings).not.toContain(expect.stringMatching(/defs/i));
    });

    it("uses default x2=1 for objectBoundingBox", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs><linearGradient id="lg2"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient></defs>
        <rect width="100" height="100" fill="url(#lg2)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.s.k).toEqual([0, 0]);
      expect(shape.e.k).toEqual([100, 0]);
    });

    it("handles userSpaceOnUse coordinates", () => {
      const svg = `<svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id="lg3" gradientUnits="userSpaceOnUse" x1="10" y1="20" x2="190" y2="180">
            <stop offset="0" stop-color="#ff0000"/>
            <stop offset="1" stop-color="#0000ff"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#lg3)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.s.k).toEqual([10, 20]);
      expect(shape.e.k).toEqual([190, 180]);
    });

    it("handles default x2=0 for userSpaceOnUse", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="lg4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="red"/>
            <stop offset="1" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#lg4)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.s.k).toEqual([0, 0]);
      expect(shape.e.k).toEqual([0, 0]);
    });
  });

  describe("radialGradient", () => {
    it("parses basic radial gradient", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="rg1" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="white"/>
            <stop offset="1" stop-color="black"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#rg1)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.ty).toBe("gf");
      expect(shape.t).toBe(2);
      expect(shape.s.k).toEqual([50, 50]);
      expect(shape.e.k).toEqual([100, 50]);
    });

    it("uses defaults cx=0.5 cy=0.5 r=0.5 for objectBoundingBox", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs><radialGradient id="rg2"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></radialGradient></defs>
        <rect width="100" height="100" fill="url(#rg2)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.s.k).toEqual([50, 50]);
      expect(shape.e.k).toEqual([100, 50]);
    });

    it("handles userSpaceOnUse for radial gradient", () => {
      const svg = `<svg viewBox="0 0 200 200">
        <defs>
          <radialGradient id="rg3" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="80">
            <stop offset="0" stop-color="yellow"/>
            <stop offset="1" stop-color="green"/>
          </radialGradient>
        </defs>
        <rect width="200" height="200" fill="url(#rg3)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.s.k).toEqual([100, 100]);
      expect(shape.e.k).toEqual([180, 100]);
    });
  });

  describe("stop-opacity", () => {
    it("includes opacity stops after color stops", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="op1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="red" stop-opacity="1"/>
            <stop offset="0.5" stop-color="green" stop-opacity="0.5"/>
            <stop offset="1" stop-color="blue" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#op1)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.g.p).toBe(3);
      const k = shape.g.k.k;
      // color stops: [0,r,g,b, 0.5,r,g,b, 1,r,g,b]
      expect(k.slice(0, 12)).toEqual([0, 1, 0, 0, 0.5, 0, 128/255, 0, 1, 0, 0, 1]);
      // opacity stops: [0,1, 0.5,0.5, 1,0]
      expect(k.slice(12)).toEqual([0, 1, 0.5, 0.5, 1, 0]);
    });
  });

  describe("gradient stroke", () => {
    it("applies gradient to stroke with url(#id)", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="sg1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="red"/>
            <stop offset="1" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="none" stroke="url(#sg1)" stroke-width="3"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shapes = data.layers[0].shapes;
      const gs = shapes.find((s: any) => s.ty === "gs") as any;
      expect(gs).toBeDefined();
      expect(gs.t).toBe(1);
      expect(gs.w.k).toBe(3);
    });
  });

  describe("multiple stops", () => {
    it("handles 4 color stops correctly", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ms1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ff0000"/>
            <stop offset="0.33" stop-color="#00ff00"/>
            <stop offset="0.66" stop-color="#0000ff"/>
            <stop offset="1" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#ms1)"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.g.p).toBe(4);
      const k = shape.g.k.k;
      expect(k[0]).toBe(0);
      expect(k[4]).toBe(0.33);
      expect(k[8]).toBe(0.66);
      expect(k[12]).toBe(1);
    });
  });

  describe("non-gradient fills still work", () => {
    it("solid fill without gradient still works", () => {
      const svg = `<svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="unused"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>
        </defs>
        <rect width="100" height="100" fill="red"/>
      </svg>`;
      const { data } = convertSvgToLottie(svg);
      const shape = data.layers[0].shapes[1] as any;
      expect(shape.ty).toBe("fl");
    });
  });
});
