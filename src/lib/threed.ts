export const VALID_3D_EFFECTS = ['flip', 'tilt', 'rotate', 'parallax', 'swing'] as const;
export type ThreeDEffect = typeof VALID_3D_EFFECTS[number];

export const VALID_3D_AXES = ['x', 'y', 'z'] as const;
export type ThreeDAxis = typeof VALID_3D_AXES[number];

export const VALID_3D_DIRECTIONS = ['cw', 'ccw', 'horizontal', 'vertical'] as const;
export type ThreeDDirection = typeof VALID_3D_DIRECTIONS[number];

export const VALID_3D_EASINGS = ['linear', 'ease', 'bounce', 'elastic'] as const;
export type ThreeDEasing = typeof VALID_3D_EASINGS[number];

export interface ThreeDCommandOptions {
  effect: ThreeDEffect;
  axis?: string;
  angle?: number;
  duration?: number;
  easing?: string;
  speed?: number;
  direction?: string;
  depth?: number;
  damping?: number;
}

interface Keyframe {
  t: number;
  s: number[];
  e?: number[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

interface AnimatedProp {
  a: 1;
  k: Keyframe[];
}

interface LottieTransform {
  p: { a: number; k: number[] | Keyframe[] };
  s: { a: number; k: number[] | Keyframe[] };
  r: { a: number; k: number | Keyframe[] };
  o: { a: number; k: number | Keyframe[] };
  a: { a: number; k: number[] };
  rx?: { a: number; k: number | Keyframe[] };
  ry?: { a: number; k: number | Keyframe[] };
  rz?: { a: number; k: number | Keyframe[] };
}

export interface LottieLayer3D {
  ty: number;
  nm?: string;
  ind?: number;
  ip: number;
  op: number;
  ddd?: number;
  ks: LottieTransform;
  shapes?: unknown[];
  ef?: unknown[];
  [key: string]: unknown;
}

export interface LottieAnimation3D {
  v?: string;
  fr?: number;
  ip?: number;
  op?: number;
  w?: number;
  h?: number;
  layers: LottieLayer3D[];
  [key: string]: unknown;
}

const EASE_SMOOTH = { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } };
const EASE_BOUNCE = { i: { x: [0.34], y: [1.56] }, o: { x: [0.64], y: [0] } };
const EASE_LINEAR = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };

function getEasing(name?: string): { i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } } {
  switch (name) {
    case 'bounce': return EASE_BOUNCE;
    case 'linear': return EASE_LINEAR;
    case 'elastic': return { i: { x: [0.25], y: [1.5] }, o: { x: [0.75], y: [-0.5] } };
    default: return EASE_SMOOTH;
  }
}


export function applyFlip(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  const fr = animation.fr ?? 30;
  const totalFrames = options.duration ? Math.round(options.duration * fr) : 60;
  const axis = options.axis ?? 'y';
  const ease = getEasing(options.easing);
  const midFrame = Math.round(totalFrames / 2);
  const modified: string[] = [];

  animation.op = totalFrames;

  for (const layer of animation.layers) {
    layer.ddd = 1;
    const rotProp = axis === 'x' ? 'rx' : 'ry';
    layer.ks[rotProp] = {
      a: 1,
      k: [
        { t: 0, s: [0], e: [90], ...ease },
        { t: midFrame, s: [90], e: [180], ...ease },
        { t: totalFrames, s: [180] },
      ],
    } as AnimatedProp;
    layer.ks.o = {
      a: 1,
      k: [
        { t: 0, s: [100], e: [100], ...EASE_LINEAR },
        { t: midFrame - 1, s: [100], e: [0], ...EASE_LINEAR },
        { t: midFrame, s: [0], e: [100], ...EASE_LINEAR },
        { t: midFrame + 1, s: [100], e: [100], ...EASE_LINEAR },
        { t: totalFrames, s: [100] },
      ],
    };
    modified.push(layer.nm ?? 'unnamed');
  }

  return modified;
}

export function applyTilt(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  const fr = animation.fr ?? 30;
  const totalFrames = options.duration ? Math.round(options.duration * fr) : 90;
  const angle = options.angle ?? 15;
  const axis = options.axis ?? 'both';
  const ease = getEasing(options.easing);
  const modified: string[] = [];

  animation.op = totalFrames;
  const quarter = Math.round(totalFrames / 4);

  for (const layer of animation.layers) {
    layer.ddd = 1;

    if (axis === 'x' || axis === 'both') {
      layer.ks.rx = {
        a: 1,
        k: [
          { t: 0, s: [0], e: [angle], ...ease },
          { t: quarter, s: [angle], e: [0], ...ease },
          { t: quarter * 2, s: [0], e: [-angle], ...ease },
          { t: quarter * 3, s: [-angle], e: [0], ...ease },
          { t: totalFrames, s: [0] },
        ],
      } as AnimatedProp;
    }

    if (axis === 'y' || axis === 'both') {
      layer.ks.ry = {
        a: 1,
        k: [
          { t: 0, s: [0], e: [-angle], ...ease },
          { t: quarter, s: [-angle], e: [0], ...ease },
          { t: quarter * 2, s: [0], e: [angle], ...ease },
          { t: quarter * 3, s: [angle], e: [0], ...ease },
          { t: totalFrames, s: [0] },
        ],
      } as AnimatedProp;
    }

    modified.push(layer.nm ?? 'unnamed');
  }

  return modified;
}

export function applyRotate(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  const speed = options.speed ?? 1;
  const totalFrames = Math.round((60 / speed));
  const axis = options.axis ?? 'y';
  const direction = options.direction === 'ccw' ? -360 : 360;
  const ease = getEasing('linear');
  const modified: string[] = [];

  animation.op = totalFrames;

  for (const layer of animation.layers) {
    layer.ddd = 1;
    const rotProp = axis === 'x' ? 'rx' : axis === 'z' ? 'rz' : 'ry';
    layer.ks[rotProp] = {
      a: 1,
      k: [
        { t: 0, s: [0], e: [direction], ...ease },
        { t: totalFrames, s: [direction] },
      ],
    } as AnimatedProp;
    modified.push(layer.nm ?? 'unnamed');
  }

  return modified;
}

export function applyParallax(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  const depth = options.depth ?? 3;
  const direction = options.direction ?? 'horizontal';
  const fr = animation.fr ?? 30;
  const totalFrames = options.duration ? Math.round(options.duration * fr) : 90;
  const w = animation.w ?? 512;
  const h = animation.h ?? 512;
  const modified: string[] = [];

  animation.op = totalFrames;

  const layers: LottieLayer3D[] = [];

  for (let i = 0; i < depth; i++) {
    const sourceLayer = animation.layers[i % animation.layers.length];
    const layer = JSON.parse(JSON.stringify(sourceLayer)) as LottieLayer3D;
    layer.ddd = 1;
    layer.ind = i;
    layer.nm = `Parallax Layer ${i + 1}`;

    const factor = (i + 1) / depth;
    const offset = 30 * factor;
    const scale = 100 + (i * 10);

    layer.ks.s = { a: 0, k: [scale, scale] };

    if (direction === 'horizontal') {
      layer.ks.p = {
        a: 1,
        k: [
          { t: 0, s: [w / 2 - offset, h / 2], e: [w / 2 + offset, h / 2], ...EASE_SMOOTH },
          { t: totalFrames, s: [w / 2 + offset, h / 2] },
        ],
      } as unknown as { a: number; k: Keyframe[] };
    } else {
      layer.ks.p = {
        a: 1,
        k: [
          { t: 0, s: [w / 2, h / 2 - offset], e: [w / 2, h / 2 + offset], ...EASE_SMOOTH },
          { t: totalFrames, s: [w / 2, h / 2 + offset] },
        ],
      } as unknown as { a: number; k: Keyframe[] };
    }

    layers.push(layer);
    modified.push(layer.nm);
  }

  animation.layers = layers;
  return modified;
}

export function applySwing(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  const angle = options.angle ?? 30;
  const axis = options.axis ?? 'x';
  const damping = options.damping ?? 0.8;
  const fr = animation.fr ?? 30;
  const totalFrames = options.duration ? Math.round(options.duration * fr) : 90;
  const modified: string[] = [];

  animation.op = totalFrames;

  for (const layer of animation.layers) {
    layer.ddd = 1;
    const rotProp = axis === 'y' ? 'ry' : axis === 'z' ? 'rz' : 'rx';

    const keyframes: Keyframe[] = [];
    const oscillations = 5;
    const framesPerOsc = Math.round(totalFrames / oscillations);
    let currentAngle = angle;

    for (let i = 0; i < oscillations; i++) {
      const frameStart = i * framesPerOsc;
      const direction = i % 2 === 0 ? 1 : -1;
      keyframes.push({
        t: frameStart,
        s: [i === 0 ? 0 : direction * currentAngle],
        e: [-direction * currentAngle],
        ...EASE_SMOOTH,
      });
      currentAngle *= damping;
    }
    keyframes.push({ t: totalFrames, s: [0] });

    layer.ks[rotProp] = { a: 1, k: keyframes } as AnimatedProp;
    modified.push(layer.nm ?? 'unnamed');
  }

  return modified;
}

export function apply3DEffect(animation: LottieAnimation3D, options: ThreeDCommandOptions): string[] {
  switch (options.effect) {
    case 'flip': return applyFlip(animation, options);
    case 'tilt': return applyTilt(animation, options);
    case 'rotate': return applyRotate(animation, options);
    case 'parallax': return applyParallax(animation, options);
    case 'swing': return applySwing(animation, options);
  }
}
