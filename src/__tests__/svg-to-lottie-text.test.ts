import { describe, it, expect } from "vitest";
import { convertSvgToLottie } from "../lib/svg-to-lottie";

describe("SVG-to-Lottie text support", () => {
  it("converts simple <text> element", () => {
    const svg = `<svg viewBox="0 0 200 200"><text>Hello</text></svg>`;
    const { data, warnings } = convertSvgToLottie(svg);
    expect(data.layers).toHaveLength(1);
    const layer = data.layers[0];
    expect(layer.ty).toBe(5);
    expect(layer.t!.d.k[0].s.t).toBe("Hello");
  });

  it("extracts font-size and font-family", () => {
    const svg = `<svg viewBox="0 0 200 200"><text font-size="48" font-family="Helvetica">Hi</text></svg>`;
    const { data } = convertSvgToLottie(svg);
    const s = data.layers[0].t!.d.k[0].s;
    expect(s.s).toBe(48);
    expect(s.f).toBe("Helvetica");
  });

  it("parses fill color", () => {
    const svg = `<svg viewBox="0 0 200 200"><text fill="#ff0000">Red</text></svg>`;
    const { data } = convertSvgToLottie(svg);
    const fc = data.layers[0].t!.d.k[0].s.fc;
    expect(fc[0]).toBeCloseTo(1);
    expect(fc[1]).toBeCloseTo(0);
    expect(fc[2]).toBeCloseTo(0);
  });

  it("maps text-anchor to justification", () => {
    const start = convertSvgToLottie(`<svg viewBox="0 0 200 200"><text text-anchor="start">A</text></svg>`);
    const middle = convertSvgToLottie(`<svg viewBox="0 0 200 200"><text text-anchor="middle">B</text></svg>`);
    const end = convertSvgToLottie(`<svg viewBox="0 0 200 200"><text text-anchor="end">C</text></svg>`);
    expect(start.data.layers[0].t!.d.k[0].s.j).toBe(0);
    expect(middle.data.layers[0].t!.d.k[0].s.j).toBe(1);
    expect(end.data.layers[0].t!.d.k[0].s.j).toBe(2);
  });

  it("preserves x/y position", () => {
    const svg = `<svg viewBox="0 0 200 200"><text x="50" y="100">Pos</text></svg>`;
    const { data } = convertSvgToLottie(svg);
    const p = data.layers[0].ks.p.k as number[];
    expect(p[0]).toBe(50);
    expect(p[1]).toBe(100);
  });

  it("handles <tspan> children", () => {
    const svg = `<svg viewBox="0 0 200 200"><text><tspan>Line 1</tspan><tspan>Line 2</tspan></text></svg>`;
    const { data } = convertSvgToLottie(svg);
    expect(data.layers[0].t!.d.k[0].s.t).toBe("Line 1\nLine 2");
  });

  it("applies transform", () => {
    const svg = `<svg viewBox="0 0 200 200"><text transform="translate(10,20) scale(2)">T</text></svg>`;
    const { data } = convertSvgToLottie(svg);
    const ks = data.layers[0].ks;
    const p = ks.p.k as number[];
    expect(p[0]).toBe(10);
    expect(p[1]).toBe(20);
    const s = ks.s.k as number[];
    expect(s[0]).toBe(200);
    expect(s[1]).toBe(200);
  });

  it("does not produce unsupported element warning for text", () => {
    const svg = `<svg viewBox="0 0 200 200"><text>No warning</text></svg>`;
    const { warnings } = convertSvgToLottie(svg);
    expect(warnings).not.toContain(expect.stringContaining("Unsupported"));
  });

  it("defaults font-size to 24 and font-family to Arial", () => {
    const svg = `<svg viewBox="0 0 200 200"><text>Default</text></svg>`;
    const { data } = convertSvgToLottie(svg);
    const s = data.layers[0].t!.d.k[0].s;
    expect(s.s).toBe(24);
    expect(s.f).toBe("Arial");
  });
});
