// Color utility functions for Lottie color manipulation
// Lottie colors are RGBA arrays with values in 0-1 range: [r, g, b, a]

export type LottieColor = [number, number, number, number];

/**
 * Clamp a value between 0 and 1
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Convert RGB (0-1) to HSL (h: 0-360, s: 0-1, l: 0-1)
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l]; // achromatic
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default: // b
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return [h * 360, s, l];
}

/**
 * Convert HSL (h: 0-360, s: 0-1, l: 0-1) to RGB (0-1)
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // Normalize hue to 0-360
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);

  if (s === 0) {
    return [l, l, l]; // achromatic
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return [
    hue2rgb(p, q, hNorm + 1 / 3),
    hue2rgb(p, q, hNorm),
    hue2rgb(p, q, hNorm - 1 / 3),
  ];
}

/**
 * Shift the hue of a Lottie color by given degrees
 */
export function hueShift(color: LottieColor, degrees: number): LottieColor {
  const [r, g, b, a] = color;
  const [h, s, l] = rgbToHsl(r, g, b);
  const newH = h + degrees;
  const [nr, ng, nb] = hslToRgb(newH, s, l);
  return [clamp01(nr), clamp01(ng), clamp01(nb), a];
}

/**
 * Adjust saturation of a Lottie color
 * @param amount -1 to 1 (negative desaturates, positive saturates)
 */
export function saturate(color: LottieColor, amount: number): LottieColor {
  const [r, g, b, a] = color;
  const [h, s, l] = rgbToHsl(r, g, b);
  const newS = clamp01(s + amount);
  const [nr, ng, nb] = hslToRgb(h, newS, l);
  return [clamp01(nr), clamp01(ng), clamp01(nb), a];
}

/**
 * Adjust brightness of a Lottie color
 * @param amount -1 to 1 (negative darkens, positive brightens)
 */
export function brighten(color: LottieColor, amount: number): LottieColor {
  const [r, g, b, a] = color;
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = clamp01(l + amount);
  const [nr, ng, nb] = hslToRgb(h, s, newL);
  return [clamp01(nr), clamp01(ng), clamp01(nb), a];
}

/**
 * Invert a Lottie color (flip RGB channels, preserve alpha)
 */
export function invert(color: LottieColor): LottieColor {
  return [1 - color[0], 1 - color[1], 1 - color[2], color[3]];
}

/**
 * Convert a Lottie color to monochrome/grayscale using luminance weights
 * Uses Rec. 709 coefficients: 0.2126 R + 0.7152 G + 0.0722 B
 */
export function monochrome(color: LottieColor): LottieColor {
  const gray = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
  return [gray, gray, gray, color[3]];
}

/**
 * Convert hex color string to Lottie RGBA (0-1)
 * Supports #RGB, #RRGGBB, #RRGGBBAA
 */
export function hexToLottie(hex: string): LottieColor | null {
  let h = hex.replace(/^#/, "");

  // Expand shorthand #RGB → #RRGGBB
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  if (h.length === 6) {
    h += "ff"; // add full alpha
  }

  if (h.length !== 8) return null;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = parseInt(h.slice(6, 8), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;

  return [r / 255, g / 255, b / 255, a / 255];
}

/**
 * Convert Lottie RGBA (0-1) to hex string #RRGGBB
 */
export function lottieToHex(color: LottieColor): string {
  const r = Math.round(color[0] * 255);
  const g = Math.round(color[1] * 255);
  const b = Math.round(color[2] * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Check if two colors are approximately equal (within epsilon)
 */
export function colorsEqual(a: LottieColor, b: LottieColor, epsilon = 0.01): boolean {
  return (
    Math.abs(a[0] - b[0]) < epsilon &&
    Math.abs(a[1] - b[1]) < epsilon &&
    Math.abs(a[2] - b[2]) < epsilon
  );
}
