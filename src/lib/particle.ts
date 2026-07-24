export const VALID_PARTICLE_TYPES = [
  "confetti",
  "snow",
  "sparkle",
  "stars",
  "bubbles",
  "rain",
  "fireworks",
  "hearts",
] as const;

export type ParticleType = (typeof VALID_PARTICLE_TYPES)[number];

export const VALID_DIRECTIONS = ["up", "down", "left", "right", "burst"] as const;
export type ParticleDirection = (typeof VALID_DIRECTIONS)[number];

export const VALID_SPEEDS = ["slow", "normal", "fast"] as const;
export type ParticleSpeed = (typeof VALID_SPEEDS)[number];

export const VALID_SIZES = ["small", "medium", "large"] as const;
export type ParticleSize = (typeof VALID_SIZES)[number];

export const VALID_COLOR_PALETTES = ["rainbow", "warm", "cool", "mono", "gold", "pastel"] as const;
export type ColorPalette = (typeof VALID_COLOR_PALETTES)[number];

export interface ParticleOptions {
  count?: number;
  color?: string;
  direction?: ParticleDirection;
  speed?: ParticleSpeed;
  size?: ParticleSize;
}

const COLOR_PALETTES: Record<ColorPalette, number[][]> = {
  rainbow: [[1, 0, 0], [1, 0.5, 0], [1, 1, 0], [0, 0.8, 0], [0, 0.4, 1], [0.5, 0, 1]],
  warm: [[1, 0.2, 0.1], [1, 0.5, 0], [1, 0.8, 0], [0.9, 0.3, 0.2], [1, 0.6, 0.3]],
  cool: [[0, 0.5, 1], [0, 0.8, 0.9], [0.3, 0.3, 1], [0.1, 0.7, 0.7], [0.5, 0.5, 1]],
  mono: [[0.2, 0.2, 0.2], [0.4, 0.4, 0.4], [0.6, 0.6, 0.6], [0.8, 0.8, 0.8], [1, 1, 1]],
  gold: [[1, 0.84, 0], [0.85, 0.65, 0.13], [1, 0.93, 0.55], [0.8, 0.6, 0], [1, 0.75, 0.3]],
  pastel: [[1, 0.7, 0.7], [0.7, 0.9, 1], [0.8, 1, 0.8], [1, 0.9, 0.7], [0.9, 0.7, 1]],
};

const CANVAS = 512;
const FPS = 30;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function resolveColors(color: string | undefined): number[][] {
  if (!color) return COLOR_PALETTES.rainbow;
  if (VALID_COLOR_PALETTES.includes(color as ColorPalette)) {
    return COLOR_PALETTES[color as ColorPalette];
  }
  const hex = color.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [[r, g, b]];
  }
  return COLOR_PALETTES.rainbow;
}

function getBaseSize(size: ParticleSize | undefined): number {
  switch (size) {
    case "small": return 8;
    case "large": return 24;
    default: return 14;
  }
}

function getSpeedMultiplier(speed: ParticleSpeed | undefined): number {
  switch (speed) {
    case "slow": return 0.5;
    case "fast": return 2;
    default: return 1;
  }
}

function getDefaultDirection(type: ParticleType): ParticleDirection {
  switch (type) {
    case "snow":
    case "confetti":
    case "rain":
      return "down";
    case "bubbles":
    case "stars":
    case "hearts":
      return "up";
    case "fireworks":
    case "sparkle":
      return "burst";
  }
}

function getFrameCount(speed: ParticleSpeed | undefined): number {
  switch (speed) {
    case "slow": return 90;
    case "fast": return 60;
    default: return 75;
  }
}

function makeEasing(easeIn: boolean, easeOut: boolean) {
  return {
    i: { x: [easeIn ? 0.42 : 0], y: [easeIn ? 0 : 0] },
    o: { x: [easeOut ? 0.58 : 1], y: [easeOut ? 1 : 1] },
  };
}

function makeRectShape(w: number, h: number) {
  return {
    ty: "rc",
    d: 1,
    s: { a: 0, k: [w, h] },
    p: { a: 0, k: [0, 0] },
    r: { a: 0, k: 0 },
  };
}

function makeEllipseShape(w: number, h: number) {
  return {
    ty: "el",
    d: 1,
    s: { a: 0, k: [w, h] },
    p: { a: 0, k: [0, 0] },
  };
}

function makeStarShape(size: number, points: number) {
  return {
    ty: "sr",
    sy: 1,
    d: 1,
    pt: { a: 0, k: points },
    p: { a: 0, k: [0, 0] },
    r: { a: 0, k: 0 },
    ir: { a: 0, k: size * 0.4 },
    is: { a: 0, k: 0 },
    or: { a: 0, k: size },
    os: { a: 0, k: 0 },
  };
}

function makeHeartPath(size: number) {
  const s = size / 2;
  return {
    ty: "sh",
    d: 1,
    ks: {
      a: 0,
      k: {
        c: true,
        v: [[0, s * 0.6], [-s, -s * 0.3], [0, -s], [s, -s * 0.3]],
        i: [[-s * 0.3, 0], [0, -s * 0.5], [s * 0.5, 0], [0, s * 0.5]],
        o: [[s * 0.3, 0], [-s * 0.5, 0], [0, -s * 0.5], [0, s * 0.3]],
      },
    },
  };
}

function makeLinePath(length: number) {
  return {
    ty: "sh",
    d: 1,
    ks: {
      a: 0,
      k: {
        c: false,
        v: [[0, -length / 2], [0, length / 2]],
        i: [[0, 0], [0, 0]],
        o: [[0, 0], [0, 0]],
      },
    },
  };
}

function getShapeForType(type: ParticleType, size: number) {
  switch (type) {
    case "confetti":
      return makeRectShape(size, size * 0.6);
    case "snow":
    case "bubbles":
      return makeEllipseShape(size, size);
    case "sparkle":
      return makeStarShape(size, 4);
    case "stars":
      return makeStarShape(size, 5);
    case "rain":
      return makeLinePath(size * 2);
    case "fireworks":
      return makeEllipseShape(size * 0.7, size * 0.7);
    case "hearts":
      return makeHeartPath(size);
  }
}

function makeMotionKeyframes(
  direction: ParticleDirection,
  startX: number,
  startY: number,
  speedMult: number,
  totalFrames: number,
  rand: () => number
): { position: unknown; opacity?: unknown } {
  const distance = CANVAS * speedMult;
  let endX = startX;
  let endY = startY;

  switch (direction) {
    case "down":
      endY = startY + distance;
      endX = startX + (rand() - 0.5) * 80;
      break;
    case "up":
      endY = startY - distance;
      endX = startX + (rand() - 0.5) * 80;
      break;
    case "left":
      endX = startX - distance;
      endY = startY + (rand() - 0.5) * 80;
      break;
    case "right":
      endX = startX + distance;
      endY = startY + (rand() - 0.5) * 80;
      break;
    case "burst": {
      const angle = rand() * Math.PI * 2;
      const dist = distance * (0.3 + rand() * 0.7);
      endX = startX + Math.cos(angle) * dist;
      endY = startY + Math.sin(angle) * dist;
      break;
    }
  }

  const easing = makeEasing(false, true);

  const position = {
    a: 1,
    k: [
      { t: 0, s: [startX, startY], ...easing },
      { t: totalFrames, s: [endX, endY] },
    ],
  };

  const opacity = {
    a: 1,
    k: [
      { t: 0, s: [100], ...easing },
      { t: Math.floor(totalFrames * 0.7), s: [100], ...easing },
      { t: totalFrames, s: [0] },
    ],
  };

  return { position, opacity };
}

export function generateParticleAnimation(
  type: ParticleType,
  options: ParticleOptions
): object {
  const seed = Date.now();
  const rand = seededRandom(seed);

  const count = Math.min(options.count ?? 30, 100);
  const colors = resolveColors(options.color);
  const direction = options.direction ?? getDefaultDirection(type);
  const baseSize = getBaseSize(options.size);
  const speedMult = getSpeedMultiplier(options.speed);
  const totalFrames = getFrameCount(options.speed);

  const layers: object[] = [];

  for (let i = 0; i < count; i++) {
    const particleSize = baseSize * (0.7 + rand() * 0.6);
    const color = colors[i % colors.length];
    const stagger = Math.floor(rand() * totalFrames * 0.4);

    let startX: number;
    let startY: number;
    if (direction === "burst") {
      startX = CANVAS / 2;
      startY = CANVAS / 2;
    } else if (direction === "down") {
      startX = rand() * CANVAS;
      startY = -particleSize;
    } else if (direction === "up") {
      startX = rand() * CANVAS;
      startY = CANVAS + particleSize;
    } else if (direction === "left") {
      startX = CANVAS + particleSize;
      startY = rand() * CANVAS;
    } else {
      startX = -particleSize;
      startY = rand() * CANVAS;
    }

    const { position, opacity } = makeMotionKeyframes(
      direction, startX, startY, speedMult, totalFrames - stagger, rand
    );

    const rotation = (type === "confetti" || type === "sparkle")
      ? { a: 1, k: [
          { t: 0, s: [rand() * 360], ...makeEasing(false, false) },
          { t: totalFrames - stagger, s: [rand() * 360 + (rand() > 0.5 ? 360 : -360)] },
        ] }
      : { a: 0, k: 0 };

    const shape = getShapeForType(type, particleSize);

    const shapeItems: object[] = [shape];

    if (type === "rain") {
      shapeItems.push({
        ty: "st",
        c: { a: 0, k: [...color, 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: 2 },
      });
    } else {
      shapeItems.push({
        ty: "fl",
        c: { a: 0, k: [...color, 1] },
        o: { a: 0, k: 100 },
        r: 1,
      });
    }

    shapeItems.push({
      ty: "tr",
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    });

    const layer = {
      ddd: 0,
      ind: i,
      ty: 4,
      nm: `particle_${i}`,
      sr: 1,
      ks: {
        o: opacity,
        r: rotation,
        p: position,
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [{ ty: "gr", it: shapeItems, nm: "shape", np: shapeItems.length, cix: 2, bm: 0, mn: "group" }],
      ip: stagger,
      op: totalFrames,
      st: stagger,
      bm: 0,
    };

    layers.push(layer);
  }

  return {
    v: "5.7.4",
    fr: FPS,
    ip: 0,
    op: totalFrames,
    w: CANVAS,
    h: CANVAS,
    nm: `${type}_particles`,
    ddd: 0,
    assets: [],
    layers,
    markers: [],
  };
}
