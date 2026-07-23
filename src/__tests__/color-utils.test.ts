import { describe, it, expect } from "vitest";
import {
  rgbToHsl,
  hslToRgb,
  hueShift,
  saturate,
  brighten,
  invert,
  monochrome,
  hexToLottie,
  lottieToHex,
  colorsEqual,
  type LottieColor,
} from "@/lib/color-utils";

describe("rgbToHsl", () => {
  it("converts pure red", () => {
    const [h, s, l] = rgbToHsl(1, 0, 0);
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts pure green", () => {
    const [h, s, l] = rgbToHsl(0, 1, 0);
    expect(h).toBeCloseTo(120);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts pure blue", () => {
    const [h, s, l] = rgbToHsl(0, 0, 1);
    expect(h).toBeCloseTo(240);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts white", () => {
    const [h, s, l] = rgbToHsl(1, 1, 1);
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(1);
  });

  it("converts black", () => {
    const [h, s, l] = rgbToHsl(0, 0, 0);
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(l).toBe(0);
  });

  it("converts gray (achromatic)", () => {
    const [h, s, l] = rgbToHsl(0.5, 0.5, 0.5);
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts mid-range color", () => {
    // Cyan: rgb(0, 1, 1) → hsl(180, 1, 0.5)
    const [h, s, l] = rgbToHsl(0, 1, 1);
    expect(h).toBeCloseTo(180);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });
});

describe("hslToRgb", () => {
  it("converts red HSL to RGB", () => {
    const [r, g, b] = hslToRgb(0, 1, 0.5);
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(0);
    expect(b).toBeCloseTo(0);
  });

  it("converts green HSL to RGB", () => {
    const [r, g, b] = hslToRgb(120, 1, 0.5);
    expect(r).toBeCloseTo(0);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(0);
  });

  it("converts blue HSL to RGB", () => {
    const [r, g, b] = hslToRgb(240, 1, 0.5);
    expect(r).toBeCloseTo(0);
    expect(g).toBeCloseTo(0);
    expect(b).toBeCloseTo(1);
  });

  it("converts achromatic (s=0)", () => {
    const [r, g, b] = hslToRgb(123, 0, 0.75);
    expect(r).toBeCloseTo(0.75);
    expect(g).toBeCloseTo(0.75);
    expect(b).toBeCloseTo(0.75);
  });

  it("handles negative hue (wraps around)", () => {
    const [r, g, b] = hslToRgb(-60, 1, 0.5);
    // -60 → 300 degrees = magenta
    const [r2, g2, b2] = hslToRgb(300, 1, 0.5);
    expect(r).toBeCloseTo(r2);
    expect(g).toBeCloseTo(g2);
    expect(b).toBeCloseTo(b2);
  });

  it("handles hue > 360 (wraps around)", () => {
    const [r, g, b] = hslToRgb(480, 1, 0.5);
    const [r2, g2, b2] = hslToRgb(120, 1, 0.5);
    expect(r).toBeCloseTo(r2);
    expect(g).toBeCloseTo(g2);
    expect(b).toBeCloseTo(b2);
  });

  it("roundtrips with rgbToHsl", () => {
    const original: [number, number, number] = [0.3, 0.6, 0.9];
    const [h, s, l] = rgbToHsl(...original);
    const [r, g, b] = hslToRgb(h, s, l);
    expect(r).toBeCloseTo(original[0], 4);
    expect(g).toBeCloseTo(original[1], 4);
    expect(b).toBeCloseTo(original[2], 4);
  });
});

describe("hueShift", () => {
  it("shifts red by 120 degrees to green", () => {
    const result = hueShift([1, 0, 0, 1], 120);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(0);
    expect(result[3]).toBe(1);
  });

  it("shifts by 360 degrees returns same color", () => {
    const color: LottieColor = [0.5, 0.3, 0.8, 0.9];
    const result = hueShift(color, 360);
    expect(result[0]).toBeCloseTo(color[0]);
    expect(result[1]).toBeCloseTo(color[1]);
    expect(result[2]).toBeCloseTo(color[2]);
    expect(result[3]).toBe(color[3]);
  });

  it("preserves alpha", () => {
    const result = hueShift([1, 0, 0, 0.5], 90);
    expect(result[3]).toBe(0.5);
  });

  it("handles negative degrees", () => {
    const result = hueShift([1, 0, 0, 1], -120);
    // Red - 120° = Blue (240°)
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(1);
  });

  it("handles achromatic colors (gray)", () => {
    const result = hueShift([0.5, 0.5, 0.5, 1], 90);
    // Gray has no hue, should stay gray
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.5);
  });
});

describe("saturate", () => {
  it("increases saturation", () => {
    // Start with a desaturated color
    const color: LottieColor = [0.6, 0.4, 0.4, 1];
    const result = saturate(color, 0.5);
    // Should be more vivid
    const [, s] = rgbToHsl(result[0], result[1], result[2]);
    const [, sOrig] = rgbToHsl(color[0], color[1], color[2]);
    expect(s).toBeGreaterThan(sOrig);
  });

  it("decreases saturation", () => {
    const color: LottieColor = [1, 0, 0, 1];
    const result = saturate(color, -0.5);
    const [, s] = rgbToHsl(result[0], result[1], result[2]);
    expect(s).toBeCloseTo(0.5);
  });

  it("clamps saturation to 0", () => {
    const color: LottieColor = [0.6, 0.4, 0.4, 1];
    const result = saturate(color, -2);
    const [, s] = rgbToHsl(result[0], result[1], result[2]);
    expect(s).toBeCloseTo(0);
  });

  it("clamps saturation to 1", () => {
    const color: LottieColor = [0.6, 0.4, 0.4, 1];
    const result = saturate(color, 2);
    const [, s] = rgbToHsl(result[0], result[1], result[2]);
    expect(s).toBeCloseTo(1);
  });

  it("preserves alpha", () => {
    const result = saturate([0.6, 0.4, 0.4, 0.7], 0.2);
    expect(result[3]).toBe(0.7);
  });
});

describe("brighten", () => {
  it("increases brightness", () => {
    const color: LottieColor = [0.5, 0.2, 0.2, 1];
    const result = brighten(color, 0.2);
    const [, , l] = rgbToHsl(result[0], result[1], result[2]);
    const [, , lOrig] = rgbToHsl(color[0], color[1], color[2]);
    expect(l).toBeGreaterThan(lOrig);
  });

  it("decreases brightness", () => {
    const color: LottieColor = [0.8, 0.6, 0.6, 1];
    const result = brighten(color, -0.2);
    const [, , l] = rgbToHsl(result[0], result[1], result[2]);
    const [, , lOrig] = rgbToHsl(color[0], color[1], color[2]);
    expect(l).toBeLessThan(lOrig);
  });

  it("clamps to black", () => {
    const color: LottieColor = [0.2, 0.1, 0.1, 1];
    const result = brighten(color, -1);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it("clamps to white", () => {
    const color: LottieColor = [0.8, 0.6, 0.6, 1];
    const result = brighten(color, 1);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(1);
  });

  it("preserves alpha", () => {
    const result = brighten([0.5, 0.3, 0.3, 0.4], 0.1);
    expect(result[3]).toBe(0.4);
  });
});

describe("invert", () => {
  it("inverts black to white", () => {
    expect(invert([0, 0, 0, 1])).toEqual([1, 1, 1, 1]);
  });

  it("inverts white to black", () => {
    expect(invert([1, 1, 1, 1])).toEqual([0, 0, 0, 1]);
  });

  it("inverts red to cyan", () => {
    expect(invert([1, 0, 0, 1])).toEqual([0, 1, 1, 1]);
  });

  it("preserves alpha", () => {
    const result = invert([0.3, 0.5, 0.7, 0.6]);
    expect(result[3]).toBe(0.6);
    expect(result[0]).toBeCloseTo(0.7);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.3);
  });

  it("double invert returns original", () => {
    const color: LottieColor = [0.3, 0.6, 0.9, 0.8];
    const result = invert(invert(color));
    expect(result[0]).toBeCloseTo(color[0]);
    expect(result[1]).toBeCloseTo(color[1]);
    expect(result[2]).toBeCloseTo(color[2]);
    expect(result[3]).toBeCloseTo(color[3]);
  });
});

describe("monochrome", () => {
  it("converts red using luminance weights", () => {
    const result = monochrome([1, 0, 0, 1]);
    expect(result[0]).toBeCloseTo(0.2126);
    expect(result[1]).toBeCloseTo(0.2126);
    expect(result[2]).toBeCloseTo(0.2126);
    expect(result[3]).toBe(1);
  });

  it("converts green using luminance weights", () => {
    const result = monochrome([0, 1, 0, 1]);
    expect(result[0]).toBeCloseTo(0.7152);
    expect(result[1]).toBeCloseTo(0.7152);
    expect(result[2]).toBeCloseTo(0.7152);
  });

  it("converts blue using luminance weights", () => {
    const result = monochrome([0, 0, 1, 1]);
    expect(result[0]).toBeCloseTo(0.0722);
    expect(result[1]).toBeCloseTo(0.0722);
    expect(result[2]).toBeCloseTo(0.0722);
  });

  it("white stays white", () => {
    const result = monochrome([1, 1, 1, 1]);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(1);
  });

  it("black stays black", () => {
    const result = monochrome([0, 0, 0, 1]);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it("preserves alpha", () => {
    const result = monochrome([0.5, 0.5, 0.5, 0.3]);
    expect(result[3]).toBe(0.3);
  });

  it("all channels equal after conversion", () => {
    const result = monochrome([0.3, 0.6, 0.9, 1]);
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
  });
});

describe("hexToLottie", () => {
  it("converts #ff0000 to red", () => {
    const result = hexToLottie("#ff0000");
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(1);
    expect(result![1]).toBeCloseTo(0);
    expect(result![2]).toBeCloseTo(0);
    expect(result![3]).toBeCloseTo(1);
  });

  it("converts shorthand #f00", () => {
    const result = hexToLottie("#f00");
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(1);
    expect(result![1]).toBeCloseTo(0);
    expect(result![2]).toBeCloseTo(0);
  });

  it("converts without # prefix", () => {
    const result = hexToLottie("00ff00");
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(0);
    expect(result![1]).toBeCloseTo(1);
    expect(result![2]).toBeCloseTo(0);
  });

  it("handles alpha channel", () => {
    const result = hexToLottie("#ff000080");
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(1);
    expect(result![3]).toBeCloseTo(128 / 255);
  });

  it("returns null for invalid hex", () => {
    expect(hexToLottie("#xyz")).toBeNull();
    expect(hexToLottie("#12")).toBeNull();
    expect(hexToLottie("#1234567890")).toBeNull();
  });

  it("handles mid-range values", () => {
    const result = hexToLottie("#808080");
    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(128 / 255);
    expect(result![1]).toBeCloseTo(128 / 255);
    expect(result![2]).toBeCloseTo(128 / 255);
  });
});

describe("lottieToHex", () => {
  it("converts red to #ff0000", () => {
    expect(lottieToHex([1, 0, 0, 1])).toBe("#ff0000");
  });

  it("converts green to #00ff00", () => {
    expect(lottieToHex([0, 1, 0, 1])).toBe("#00ff00");
  });

  it("converts blue to #0000ff", () => {
    expect(lottieToHex([0, 0, 1, 1])).toBe("#0000ff");
  });

  it("converts black to #000000", () => {
    expect(lottieToHex([0, 0, 0, 1])).toBe("#000000");
  });

  it("converts white to #ffffff", () => {
    expect(lottieToHex([1, 1, 1, 1])).toBe("#ffffff");
  });

  it("ignores alpha in output", () => {
    expect(lottieToHex([1, 0, 0, 0.5])).toBe("#ff0000");
  });

  it("roundtrips with hexToLottie", () => {
    const hex = "#3a7bc8";
    const lottie = hexToLottie(hex)!;
    expect(lottieToHex(lottie)).toBe(hex);
  });
});

describe("colorsEqual", () => {
  it("matches identical colors", () => {
    expect(colorsEqual([1, 0, 0, 1], [1, 0, 0, 1])).toBe(true);
  });

  it("matches within epsilon", () => {
    expect(colorsEqual([0.5, 0.5, 0.5, 1], [0.505, 0.495, 0.505, 1])).toBe(true);
  });

  it("rejects colors beyond epsilon", () => {
    expect(colorsEqual([1, 0, 0, 1], [0.5, 0, 0, 1])).toBe(false);
  });

  it("ignores alpha channel in comparison", () => {
    expect(colorsEqual([1, 0, 0, 1], [1, 0, 0, 0.5])).toBe(true);
  });

  it("respects custom epsilon", () => {
    expect(colorsEqual([0.5, 0.5, 0.5, 1], [0.55, 0.5, 0.5, 1], 0.1)).toBe(true);
    expect(colorsEqual([0.5, 0.5, 0.5, 1], [0.55, 0.5, 0.5, 1], 0.01)).toBe(false);
  });
});
