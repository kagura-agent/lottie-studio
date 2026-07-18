import { describe, it, expect } from "vitest";
import {
  convertSvgToLottie,
  parseColor,
  parsePath,
  parseTransform,
  parseSvgXml,
} from "../svg-to-lottie";

describe("parseColor", () => {
  it("parses hex colors (#RRGGBB)", () => {
    expect(parseColor("#ff0000")).toEqual([1, 0, 0, 1]);
    expect(parseColor("#00ff00")).toEqual([0, 1, 0, 1]);
    expect(parseColor("#0000ff")).toEqual([0, 0, 1, 1]);
  });

  it("parses short hex (#RGB)", () => {
    expect(parseColor("#f00")).toEqual([1, 0, 0, 1]);
    expect(parseColor("#0f0")).toEqual([0, 1, 0, 1]);
    expect(parseColor("#00f")).toEqual([0, 0, 1, 1]);
  });

  it("parses rgb() notation", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual([1, 0, 0, 1]);
    expect(parseColor("rgb(128, 128, 128)")).toEqual([128 / 255, 128 / 255, 128 / 255, 1]);
  });

  it("parses rgba() notation", () => {
    const result = parseColor("rgba(255, 0, 0, 0.5)");
    expect(result).toEqual([1, 0, 0, 0.5]);
  });

  it("parses named colors", () => {
    expect(parseColor("red")).toEqual([1, 0, 0, 1]);
    expect(parseColor("blue")).toEqual([0, 0, 1, 1]);
    expect(parseColor("white")).toEqual([1, 1, 1, 1]);
  });

  it("returns null for none/transparent", () => {
    expect(parseColor("none")).toBeNull();
    expect(parseColor("transparent")).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe("parseTransform", () => {
  it("parses translate(x, y)", () => {
    const t = parseTransform("translate(10, 20)");
    expect(t.tx).toBe(10);
    expect(t.ty).toBe(20);
  });

  it("parses translate(x) with implicit y=0", () => {
    const t = parseTransform("translate(15)");
    expect(t.tx).toBe(15);
    expect(t.ty).toBe(0);
  });

  it("parses rotate(angle)", () => {
    const t = parseTransform("rotate(45)");
    expect(t.rot).toBe(45);
  });

  it("parses scale(sx, sy)", () => {
    const t = parseTransform("scale(2, 3)");
    expect(t.sx).toBe(200);
    expect(t.sy).toBe(300);
  });

  it("parses scale(s) uniform", () => {
    const t = parseTransform("scale(0.5)");
    expect(t.sx).toBe(50);
    expect(t.sy).toBe(50);
  });

  it("returns defaults for undefined", () => {
    const t = parseTransform(undefined);
    expect(t.tx).toBe(0);
    expect(t.ty).toBe(0);
    expect(t.sx).toBe(100);
    expect(t.sy).toBe(100);
    expect(t.rot).toBe(0);
  });
});

describe("parsePath", () => {
  it("parses simple MoveTo and LineTo", () => {
    const paths = parsePath("M 0 0 L 100 0 L 100 100 Z");
    expect(paths).toHaveLength(1);
    expect(paths[0].v).toEqual([[0, 0], [100, 0], [100, 100]]);
    expect(paths[0].c).toBe(true);
  });

  it("parses relative commands", () => {
    const paths = parsePath("m 10 10 l 50 0 l 0 50 z");
    expect(paths).toHaveLength(1);
    expect(paths[0].v).toEqual([[10, 10], [60, 10], [60, 60]]);
    expect(paths[0].c).toBe(true);
  });

  it("parses cubic bezier curves", () => {
    const paths = parsePath("M 0 0 C 10 20 30 40 50 50");
    expect(paths).toHaveLength(1);
    expect(paths[0].v).toEqual([[0, 0], [50, 50]]);
    // Out tangent of first vertex
    expect(paths[0].o[0]).toEqual([10, 20]);
    // In tangent of second vertex
    expect(paths[0].i[1]).toEqual([30 - 50, 40 - 50]);
    expect(paths[0].c).toBe(false);
  });

  it("handles H and V commands", () => {
    const paths = parsePath("M 0 0 H 100 V 100");
    expect(paths).toHaveLength(1);
    expect(paths[0].v).toEqual([[0, 0], [100, 0], [100, 100]]);
  });

  it("parses multiple subpaths", () => {
    const paths = parsePath("M 0 0 L 10 10 M 20 20 L 30 30");
    expect(paths).toHaveLength(2);
    expect(paths[0].v).toEqual([[0, 0], [10, 10]]);
    expect(paths[1].v).toEqual([[20, 20], [30, 30]]);
  });
});

describe("parseSvgXml", () => {
  it("parses basic SVG structure", () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>';
    const root = parseSvgXml(svg);
    expect(root).not.toBeNull();
    expect(root!.tag).toBe("svg");
    expect(root!.attrs.viewBox).toBe("0 0 100 100");
    expect(root!.children).toHaveLength(1);
    expect(root!.children[0].tag).toBe("rect");
  });

  it("handles nested elements", () => {
    const svg = '<svg><g id="group1"><circle cx="50" cy="50" r="25"/></g></svg>';
    const root = parseSvgXml(svg);
    expect(root!.children[0].tag).toBe("g");
    expect(root!.children[0].attrs.id).toBe("group1");
    expect(root!.children[0].children[0].tag).toBe("circle");
  });

  it("strips XML declarations and comments", () => {
    const svg = '<?xml version="1.0"?><!-- comment --><svg><rect width="10" height="10"/></svg>';
    const root = parseSvgXml(svg);
    expect(root!.tag).toBe("svg");
    expect(root!.children[0].tag).toBe("rect");
  });
});

describe("convertSvgToLottie", () => {
  it("converts a simple rect", () => {
    const svg = '<svg viewBox="0 0 200 200"><rect x="10" y="20" width="100" height="50" fill="#ff0000"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    expect(lottie.v).toBe("5.7.1");
    expect(lottie.fr).toBe(30);
    expect(lottie.w).toBe(200);
    expect(lottie.h).toBe(200);
    expect(lottie.layers).toHaveLength(1);

    const layer = lottie.layers[0];
    expect(layer.ty).toBe(4);
    expect(layer.shapes).toHaveLength(2); // rect + fill

    const rect = layer.shapes[0] as { ty: string; s: { k: number[] }; p: { k: number[] } };
    expect(rect.ty).toBe("rc");
    expect(rect.s.k).toEqual([100, 50]);
    expect(rect.p.k).toEqual([60, 45]); // center: x + w/2, y + h/2

    const fill = layer.shapes[1] as { ty: string; c: { k: number[] } };
    expect(fill.ty).toBe("fl");
    expect(fill.c.k).toEqual([1, 0, 0, 1]);
  });

  it("converts a circle to ellipse", () => {
    const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="blue"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const ellipse = layer.shapes[0] as { ty: string; p: { k: number[] }; s: { k: number[] } };
    expect(ellipse.ty).toBe("el");
    expect(ellipse.p.k).toEqual([50, 50]);
    expect(ellipse.s.k).toEqual([60, 60]); // r*2
  });

  it("converts an ellipse", () => {
    const svg = '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="40" rx="30" ry="20" fill="green"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const el = layer.shapes[0] as { ty: string; p: { k: number[] }; s: { k: number[] } };
    expect(el.ty).toBe("el");
    expect(el.p.k).toEqual([50, 40]);
    expect(el.s.k).toEqual([60, 40]); // rx*2, ry*2
  });

  it("converts a path with curves", () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M 10 10 C 20 20 40 20 50 10" fill="none" stroke="black"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const pathShape = layer.shapes[0] as { ty: string; ks: { k: { v: number[][]; i: number[][]; o: number[][]; c: boolean } } };
    expect(pathShape.ty).toBe("sh");
    expect(pathShape.ks.k.v).toEqual([[10, 10], [50, 10]]);
    expect(pathShape.ks.k.o[0]).toEqual([10, 10]); // out tangent on first vertex
    expect(pathShape.ks.k.i[1]).toEqual([-10, 10]); // in tangent on second vertex (40-50, 20-10)
    expect(pathShape.ks.k.c).toBe(false);
  });

  it("converts colors correctly (hex, rgb, named)", () => {
    const svg = `<svg viewBox="0 0 300 100">
      <rect x="0" y="0" width="100" height="100" fill="#00ff00"/>
      <rect x="100" y="0" width="100" height="100" fill="rgb(0, 0, 255)"/>
      <rect x="200" y="0" width="100" height="100" fill="red"/>
    </svg>`;
    const { data: lottie } = convertSvgToLottie(svg);

    expect(lottie.layers).toHaveLength(3);

    const fill0 = lottie.layers[0].shapes[1] as { c: { k: number[] } };
    expect(fill0.c.k).toEqual([0, 1, 0, 1]);

    const fill1 = lottie.layers[1].shapes[1] as { c: { k: number[] } };
    expect(fill1.c.k).toEqual([0, 0, 1, 1]);

    const fill2 = lottie.layers[2].shapes[1] as { c: { k: number[] } };
    expect(fill2.c.k).toEqual([1, 0, 0, 1]);
  });

  it("converts a group with multiple shapes", () => {
    const svg = `<svg viewBox="0 0 200 200">
      <g id="myGroup" transform="translate(10, 20)">
        <rect x="0" y="0" width="50" height="50" fill="red"/>
        <circle cx="75" cy="25" r="15" fill="blue"/>
      </g>
    </svg>`;
    const { data: lottie } = convertSvgToLottie(svg);

    expect(lottie.layers).toHaveLength(1);
    const layer = lottie.layers[0];
    // Group element produces a group shape
    const group = layer.shapes[0] as { ty: string; nm: string; it: Array<{ ty: string }> };
    expect(group.ty).toBe("gr");
    expect(group.nm).toBe("myGroup");
    // rect + fill + circle + fill + transform
    expect(group.it).toHaveLength(5);
    expect(group.it[0].ty).toBe("rc");
    expect(group.it[1].ty).toBe("fl");
    expect(group.it[2].ty).toBe("el");
    expect(group.it[3].ty).toBe("fl");
    expect(group.it[4].ty).toBe("tr");
  });

  it("parses viewBox for dimensions", () => {
    const svg = '<svg viewBox="0 0 800 600"><rect width="100" height="100"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);
    expect(lottie.w).toBe(800);
    expect(lottie.h).toBe(600);
  });

  it("uses width/height attributes when present", () => {
    const svg = '<svg width="400" height="300"><rect width="100" height="100"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);
    expect(lottie.w).toBe(400);
    expect(lottie.h).toBe(300);
  });

  it("handles stroke attributes", () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="none" stroke="#ff0000" stroke-width="3"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const stroke = layer.shapes.find(s => s.ty === "st") as { ty: string; c: { k: number[] }; w: { k: number } } | undefined;
    expect(stroke).toBeDefined();
    expect(stroke!.c.k).toEqual([1, 0, 0, 1]);
    expect(stroke!.w.k).toBe(3);
  });

  it("handles transform attributes (translate, rotate, scale)", () => {
    const svg = '<svg viewBox="0 0 200 200"><rect x="0" y="0" width="50" height="50" fill="red" transform="translate(10, 20)"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    expect((layer.ks.p.k as number[])[0]).toBe(10);
    expect((layer.ks.p.k as number[])[1]).toBe(20);
  });

  it("throws for invalid SVG (no <svg> root)", () => {
    expect(() => convertSvgToLottie("<div>not svg</div>")).toThrow("Invalid SVG");
  });

  it("produces valid static animation properties", () => {
    const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="red"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    expect(lottie.ip).toBe(0);
    expect(lottie.op).toBe(60);
    expect(lottie.fr).toBe(30);
    const layer = lottie.layers[0];
    expect(layer.ks.o.a).toBe(0);
    expect(layer.ks.r.a).toBe(0);
    expect(layer.ks.p.a).toBe(0);
    expect(layer.ks.s.a).toBe(0);
  });

  it("skips non-visual elements (defs, style, title)", () => {
    const svg = `<svg viewBox="0 0 100 100">
      <defs><linearGradient id="g1"></linearGradient></defs>
      <title>My SVG</title>
      <style>.cls{fill:red}</style>
      <rect width="50" height="50" fill="red"/>
    </svg>`;
    const { data: lottie } = convertSvgToLottie(svg);
    expect(lottie.layers).toHaveLength(1);
  });

  it("converts polygon to closed path", () => {
    const svg = '<svg viewBox="0 0 100 100"><polygon points="50,0 100,100 0,100" fill="orange"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const path = layer.shapes[0] as { ty: string; ks: { k: { v: number[][]; c: boolean } } };
    expect(path.ty).toBe("sh");
    expect(path.ks.k.v).toEqual([[50, 0], [100, 100], [0, 100]]);
    expect(path.ks.k.c).toBe(true);
  });

  it("converts polyline to open path", () => {
    const svg = '<svg viewBox="0 0 100 100"><polyline points="10,10 50,50 90,10" fill="none" stroke="black"/></svg>';
    const { data: lottie } = convertSvgToLottie(svg);

    const layer = lottie.layers[0];
    const path = layer.shapes[0] as { ty: string; ks: { k: { v: number[][]; c: boolean } } };
    expect(path.ty).toBe("sh");
    expect(path.ks.k.v).toEqual([[10, 10], [50, 50], [90, 10]]);
    expect(path.ks.k.c).toBe(false);
  });

  it("returns warnings for unsupported elements", () => {
    const svg = '<svg viewBox="0 0 100 100"><image href="test.png" width="50" height="50"/><rect width="50" height="50"/></svg>';
    const { warnings } = convertSvgToLottie(svg);
    expect(warnings.some(w => w.includes("image"))).toBe(true);
  });

  it("does not warn for supported <text> elements", () => {
    const svg = '<svg viewBox="0 0 100 100"><text>Hello</text></svg>';
    const { warnings } = convertSvgToLottie(svg);
    expect(warnings.some(w => w.includes("text"))).toBe(false);
  });
});
