export const VALID_TEXT_PRESETS = [
  "typewriter",
  "fade-in",
  "bounce",
  "slide",
  "wave",
  "glitch",
  "scale",
  "rotate",
] as const;

export type TextPreset = (typeof VALID_TEXT_PRESETS)[number];

export const VALID_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof VALID_ALIGNS)[number];

export interface TextOptions {
  style?: TextPreset;
  color?: string;
  size?: number;
  align?: TextAlign;
}

const CANVAS = 512;
const FPS = 30;
const DEFAULT_SIZE = 48;
const DEFAULT_COLOR: [number, number, number] = [1, 1, 1];

function parseColor(color: string | undefined): [number, number, number] {
  if (!color) return DEFAULT_COLOR;
  const hex = color.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  return DEFAULT_COLOR;
}

interface PathPoint {
  x: number;
  y: number;
}

function charToPath(ch: string, size: number): { v: number[][]; i: number[][]; o: number[][]; c: boolean }[] {
  const s = size;
  const h = s;
  const w = s * 0.6;
  const shapes: { v: number[][]; i: number[][]; o: number[][]; c: boolean }[] = [];

  const rect = (x: number, y: number, rw: number, rh: number) => ({
    v: [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]],
    i: [[0, 0], [0, 0], [0, 0], [0, 0]],
    o: [[0, 0], [0, 0], [0, 0], [0, 0]],
    c: true,
  });

  const line = (x1: number, y1: number, x2: number, y2: number, thickness: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * thickness / 2;
    const ny = (dx / len) * thickness / 2;
    return {
      v: [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0]],
      c: true,
    };
  };

  const t = s * 0.1;

  const upper = ch.toUpperCase();
  switch (upper) {
    case "A":
      shapes.push(line(0, h, w / 2, 0, t));
      shapes.push(line(w / 2, 0, w, h, t));
      shapes.push(line(w * 0.2, h * 0.6, w * 0.8, h * 0.6, t));
      break;
    case "B":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w * 0.7, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w * 0.7, t));
      shapes.push(rect(0, h - t, w * 0.7, t));
      shapes.push(rect(w * 0.7, 0, t, h * 0.5));
      shapes.push(rect(w * 0.7, h * 0.5, t, h * 0.5));
      break;
    case "C":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "D":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w * 0.6, t));
      shapes.push(rect(0, h - t, w * 0.6, t));
      shapes.push(line(w * 0.6, 0, w, h * 0.5, t));
      shapes.push(line(w, h * 0.5, w * 0.6, h, t));
      break;
    case "E":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w * 0.7, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "F":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w * 0.7, t));
      break;
    case "G":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      shapes.push(rect(w - t, h * 0.5, t, h * 0.5));
      shapes.push(rect(w * 0.5, h * 0.5 - t / 2, w * 0.5, t));
      break;
    case "H":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      break;
    case "I":
      shapes.push(rect(w * 0.5 - t / 2, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "J":
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, h - t, w, t));
      shapes.push(rect(0, h * 0.7, t, h * 0.3));
      break;
    case "K":
      shapes.push(rect(0, 0, t, h));
      shapes.push(line(w, 0, t, h * 0.5, t));
      shapes.push(line(t, h * 0.5, w, h, t));
      break;
    case "L":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "M":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(line(0, 0, w / 2, h * 0.4, t));
      shapes.push(line(w / 2, h * 0.4, w, 0, t));
      break;
    case "N":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(line(0, 0, w, h, t));
      break;
    case "O":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "P":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, 0, t, h * 0.5));
      break;
    case "Q":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      shapes.push(line(w * 0.5, h * 0.6, w, h, t));
      break;
    case "R":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, 0, t, h * 0.5));
      shapes.push(line(w * 0.4, h * 0.5, w, h, t));
      break;
    case "S":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, 0, t, h * 0.5));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, h * 0.5, t, h * 0.5));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "T":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(w * 0.5 - t / 2, 0, t, h));
      break;
    case "U":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "V":
      shapes.push(line(0, 0, w / 2, h, t));
      shapes.push(line(w / 2, h, w, 0, t));
      break;
    case "W":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.3, t, h * 0.7));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "X":
      shapes.push(line(0, 0, w, h, t));
      shapes.push(line(w, 0, 0, h, t));
      break;
    case "Y":
      shapes.push(line(0, 0, w / 2, h * 0.5, t));
      shapes.push(line(w, 0, w / 2, h * 0.5, t));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.5, t, h * 0.5));
      break;
    case "Z":
      shapes.push(rect(0, 0, w, t));
      shapes.push(line(w, 0, 0, h, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "0":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h - t, w, t));
      shapes.push(line(w, 0, 0, h, t));
      break;
    case "1":
      shapes.push(rect(w * 0.5 - t / 2, 0, t, h));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "2":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(w - t, 0, t, h * 0.5));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(0, h * 0.5, t, h * 0.5));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "3":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(0, h - t, w, t));
      shapes.push(rect(w - t, 0, t, h));
      break;
    case "4":
      shapes.push(rect(0, 0, t, h * 0.5));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, 0, t, h));
      break;
    case "5":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, 0, t, h * 0.5));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, h * 0.5, t, h * 0.5));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "6":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, h * 0.5, t, h * 0.5));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "7":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(w - t, 0, t, h));
      break;
    case "8":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(0, h - t, w, t));
      break;
    case "9":
      shapes.push(rect(0, 0, t, h));
      shapes.push(rect(w - t, 0, t, h));
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(0, h * 0.5 - t / 2, w, t));
      shapes.push(rect(w - t, h * 0.5, t, h * 0.5));
      break;
    case ".":
      shapes.push(rect(w * 0.3, h * 0.85, w * 0.2, h * 0.15));
      break;
    case ",":
      shapes.push(rect(w * 0.3, h * 0.8, w * 0.15, h * 0.15));
      shapes.push(line(w * 0.3, h * 0.95, w * 0.2, h, t * 0.5));
      break;
    case "!":
      shapes.push(rect(w * 0.5 - t / 2, 0, t, h * 0.7));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.85, t, h * 0.15));
      break;
    case "?":
      shapes.push(rect(0, 0, w, t));
      shapes.push(rect(w - t, 0, t, h * 0.5));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.5 - t / 2, w * 0.5 + t / 2, t));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.5, t, h * 0.2));
      shapes.push(rect(w * 0.5 - t / 2, h * 0.85, t, h * 0.15));
      break;
    case "-":
      shapes.push(rect(w * 0.1, h * 0.5 - t / 2, w * 0.8, t));
      break;
    case " ":
      break;
    default:
      shapes.push(rect(0, 0, w, h));
      break;
  }

  return shapes;
}

function applyPreset(
  preset: TextPreset,
  charIndex: number,
  totalChars: number,
  totalFrames: number
): Record<string, unknown> {
  const staggerDelay = Math.min(4, Math.floor(totalFrames / (totalChars + 2)));
  const startFrame = charIndex * staggerDelay;
  const endFrame = Math.min(startFrame + Math.floor(totalFrames * 0.6), totalFrames);

  switch (preset) {
    case "typewriter":
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0], h: 1 },
            { t: startFrame + 1, s: [100] },
          ],
        },
      };

    case "fade-in":
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0] },
            { t: endFrame, s: [100] },
          ],
        },
      };

    case "bounce": {
      const mid = Math.floor((startFrame + endFrame) / 2);
      return {
        o: { a: 0, k: 100 },
        p: {
          a: 1,
          k: [
            { t: startFrame, s: [0, -30] },
            { t: mid, s: [0, 5] },
            { t: endFrame, s: [0, 0] },
          ],
        },
      };
    }

    case "slide":
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0] },
            { t: endFrame, s: [100] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: startFrame, s: [50, 0] },
            { t: endFrame, s: [0, 0] },
          ],
        },
      };

    case "wave": {
      const quarterFrames = Math.floor((endFrame - startFrame) / 4);
      return {
        o: { a: 0, k: 100 },
        p: {
          a: 1,
          k: [
            { t: startFrame, s: [0, 0] },
            { t: startFrame + quarterFrames, s: [0, -15] },
            { t: startFrame + quarterFrames * 2, s: [0, 0] },
            { t: startFrame + quarterFrames * 3, s: [0, 10] },
            { t: endFrame, s: [0, 0] },
          ],
        },
      };
    }

    case "glitch": {
      const step = Math.max(1, Math.floor((endFrame - startFrame) / 5));
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0], h: 1 },
            { t: startFrame + step, s: [100], h: 1 },
            { t: startFrame + step * 2, s: [0], h: 1 },
            { t: startFrame + step * 3, s: [100] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: startFrame, s: [3, -2], h: 1 },
            { t: startFrame + step, s: [-2, 3], h: 1 },
            { t: startFrame + step * 2, s: [1, -1], h: 1 },
            { t: startFrame + step * 3, s: [0, 0] },
          ],
        },
      };
    }

    case "scale":
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0] },
            { t: endFrame, s: [100] },
          ],
        },
        s: {
          a: 1,
          k: [
            { t: startFrame, s: [0, 0] },
            { t: endFrame, s: [100, 100] },
          ],
        },
      };

    case "rotate":
      return {
        o: {
          a: 1,
          k: [
            { t: startFrame, s: [0] },
            { t: endFrame, s: [100] },
          ],
        },
        r: {
          a: 1,
          k: [
            { t: startFrame, s: [90] },
            { t: endFrame, s: [0] },
          ],
        },
      };

    default:
      return {};
  }
}

export function generateTextAnimation(
  text: string,
  options: TextOptions = {}
): Record<string, unknown> {
  const {
    style = "typewriter",
    color,
    size = DEFAULT_SIZE,
    align = "center",
  } = options;

  const rgb = parseColor(color);
  const charWidth = size * 0.7;
  const totalWidth = text.length * charWidth;
  const totalFrames = FPS * 3;

  let startX: number;
  switch (align) {
    case "left":
      startX = size * 0.5;
      break;
    case "right":
      startX = CANVAS - totalWidth - size * 0.5;
      break;
    default:
      startX = (CANVAS - totalWidth) / 2;
      break;
  }
  const startY = (CANVAS - size) / 2;

  const layers: Record<string, unknown>[] = [];

  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    const paths = charToPath(ch, size);
    if (paths.length === 0) continue;

    const charX = startX + i * charWidth;
    const presetProps = applyPreset(style, i, text.length, totalFrames);

    const shapeItems: Record<string, unknown>[] = paths.map((p, pi) => ({
      ty: "sh",
      nm: `Path ${pi + 1}`,
      ks: {
        a: 0,
        k: p,
      },
    }));

    shapeItems.push({
      ty: "fl",
      nm: "Fill",
      c: { a: 0, k: [rgb[0], rgb[1], rgb[2], 1] },
      o: { a: 0, k: 100 },
    });

    const layer: Record<string, unknown> = {
      ty: 4,
      nm: `char_${i}_${ch === " " ? "space" : ch}`,
      ind: i,
      ip: 0,
      op: totalFrames,
      st: 0,
      ks: {
        a: { a: 0, k: [0, 0] },
        p: { a: 0, k: [charX, startY] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        ...presetProps,
      },
      shapes: shapeItems,
    };

    layers.push(layer);
  }

  return {
    v: "5.7.0",
    fr: FPS,
    ip: 0,
    op: totalFrames,
    w: CANVAS,
    h: CANVAS,
    nm: "Text Animation",
    layers,
  };
}
