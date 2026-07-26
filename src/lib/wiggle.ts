export const VALID_WIGGLE_PROPERTIES = ["position", "rotation", "scale", "opacity"] as const;
export type WiggleProperty = (typeof VALID_WIGGLE_PROPERTIES)[number];

export interface WiggleCommandOptions {
  freq?: number;
  amp?: number;
  smooth?: boolean;
  layer?: string;
  property?: WiggleProperty;
  seed?: number;
}

export interface WiggleOptions {
  freq: number;
  amp: number;
  smooth: boolean;
  seed: number;
}

const DEFAULT_AMPLITUDES: Record<WiggleProperty, number> = {
  position: 20,
  rotation: 15,
  scale: 10,
  opacity: 20,
};

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveWiggleOptions(opts: WiggleCommandOptions, property: WiggleProperty): WiggleOptions {
  return {
    freq: opts.freq ?? 3,
    amp: opts.amp ?? DEFAULT_AMPLITUDES[property],
    smooth: opts.smooth ?? true,
    seed: opts.seed ?? 42,
  };
}

export interface WiggleKeyframe {
  t: number;
  s: number[];
  o?: { x: number[]; y: number[] };
  i?: { x: number[]; y: number[] };
}

export function generateWiggleKeyframes(
  property: WiggleProperty,
  options: WiggleOptions,
  startFrame: number,
  endFrame: number,
  fps: number,
  baseValue?: number[]
): WiggleKeyframe[] {
  const { freq, amp, smooth, seed } = options;
  const duration = (endFrame - startFrame) / fps;
  const numKeyframes = Math.max(2, Math.round(duration * freq) + 1);
  const rng = mulberry32(seed);

  const base = baseValue ?? getDefaultBaseValue(property);
  const keyframes: WiggleKeyframe[] = [];
  const frameInterval = (endFrame - startFrame) / (numKeyframes - 1);

  for (let i = 0; i < numKeyframes; i++) {
    const t = Math.round(startFrame + i * frameInterval);
    const s = generateWiggleValue(property, base, amp, rng);
    const kf: WiggleKeyframe = { t, s };

    if (smooth && i < numKeyframes - 1) {
      kf.o = { x: [0.33], y: [0] };
      kf.i = { x: [0.67], y: [1] };
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function getDefaultBaseValue(property: WiggleProperty): number[] {
  switch (property) {
    case "position":
      return [256, 256];
    case "rotation":
      return [0];
    case "scale":
      return [100, 100];
    case "opacity":
      return [100];
  }
}

function generateWiggleValue(
  property: WiggleProperty,
  base: number[],
  amp: number,
  rng: () => number
): number[] {
  switch (property) {
    case "position":
      return [
        base[0] + (rng() * 2 - 1) * amp,
        base[1] + (rng() * 2 - 1) * amp,
      ];
    case "rotation":
      return [base[0] + (rng() * 2 - 1) * amp];
    case "scale":
      return [
        base[0] + (rng() * 2 - 1) * amp,
        base[1] + (rng() * 2 - 1) * amp,
      ];
    case "opacity": {
      const val = base[0] + (rng() * 2 - 1) * amp;
      return [Math.max(0, Math.min(100, val))];
    }
  }
}
