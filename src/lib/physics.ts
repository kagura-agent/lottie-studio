export const VALID_PHYSICS_EFFECTS = ["gravity", "bounce", "throw", "pendulum", "float"] as const;
export type PhysicsEffect = (typeof VALID_PHYSICS_EFFECTS)[number];

export interface PhysicsCommandOptions {
  effect: PhysicsEffect;
  layer?: string;
  duration?: number;
  bounces?: number;
  angle?: number;
  force?: number;
  length?: number;
  damping?: number;
  gravity?: number;
}

export interface PhysicsKeyframe {
  t: number;
  s: number[];
}

function generateGravityKeyframes(
  startFrame: number,
  totalFrames: number,
  fps: number,
  gravity: number
): PhysicsKeyframe[] {
  const keyframes: PhysicsKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const t = f / fps;
    const y = 0.5 * gravity * t * t;
    keyframes.push({ t: startFrame + f, s: [0, y] });
  }
  return keyframes;
}

function generateBounceKeyframes(
  startFrame: number,
  totalFrames: number,
  fps: number,
  gravity: number,
  bounces: number,
  damping: number
): PhysicsKeyframe[] {
  const e = 1 - damping;
  const keyframes: PhysicsKeyframe[] = [];

  let y = 0;
  let vy = 0;
  const dt = 1 / fps;
  const floorY = 200;
  let bounceCount = 0;

  for (let f = 0; f <= totalFrames; f++) {
    keyframes.push({ t: startFrame + f, s: [0, y] });
    vy += gravity * dt;
    y += vy * dt * fps;

    if (y >= floorY && vy > 0) {
      y = floorY;
      vy = -e * vy;
      bounceCount++;
      if (bounceCount >= bounces) {
        for (let remaining = f + 1; remaining <= totalFrames; remaining++) {
          keyframes.push({ t: startFrame + remaining, s: [0, floorY] });
        }
        break;
      }
    }
  }
  return keyframes;
}

function generateThrowKeyframes(
  startFrame: number,
  totalFrames: number,
  fps: number,
  gravity: number,
  angle: number,
  force: number
): PhysicsKeyframe[] {
  const rad = (angle * Math.PI) / 180;
  const v0x = force * Math.cos(rad);
  const v0y = -force * Math.sin(rad);
  const keyframes: PhysicsKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const t = f / fps;
    const x = v0x * t;
    const y = v0y * t + 0.5 * gravity * t * t;
    keyframes.push({ t: startFrame + f, s: [x, y] });
  }
  return keyframes;
}

function generatePendulumKeyframes(
  startFrame: number,
  totalFrames: number,
  fps: number,
  gravity: number,
  length: number,
  damping: number
): PhysicsKeyframe[] {
  const omega = Math.sqrt(gravity / length);
  const gamma = damping;
  const theta0 = 30;
  const keyframes: PhysicsKeyframe[] = [];

  for (let f = 0; f <= totalFrames; f++) {
    const t = f / fps;
    const theta = theta0 * Math.exp(-gamma * t) * Math.cos(omega * t);
    keyframes.push({ t: startFrame + f, s: [theta] });
  }
  return keyframes;
}

function generateFloatKeyframes(
  startFrame: number,
  totalFrames: number,
  fps: number,
  force: number
): PhysicsKeyframe[] {
  const keyframes: PhysicsKeyframe[] = [];
  const speed = force * 0.5;
  const driftAmplitude = force * 2;
  const driftFreq = 0.5;

  for (let f = 0; f <= totalFrames; f++) {
    const t = f / fps;
    const y = -(speed * t);
    const x = driftAmplitude * Math.sin(2 * Math.PI * driftFreq * t);
    keyframes.push({ t: startFrame + f, s: [x, y] });
  }
  return keyframes;
}

export function generatePhysicsKeyframes(
  effect: PhysicsEffect,
  options: PhysicsCommandOptions,
  startFrame: number = 0,
  fps: number = 30
): PhysicsKeyframe[] {
  const durationMs = options.duration ?? 2000;
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const gravity = options.gravity ?? 980;
  const damping = options.damping ?? 0.3;
  const force = options.force ?? 200;

  switch (effect) {
    case "gravity":
      return generateGravityKeyframes(startFrame, totalFrames, fps, gravity);
    case "bounce":
      return generateBounceKeyframes(startFrame, totalFrames, fps, gravity, options.bounces ?? 4, damping);
    case "throw":
      return generateThrowKeyframes(startFrame, totalFrames, fps, gravity, options.angle ?? 45, force);
    case "pendulum":
      return generatePendulumKeyframes(startFrame, totalFrames, fps, gravity, options.length ?? 100, damping);
    case "float":
      return generateFloatKeyframes(startFrame, totalFrames, fps, force);
  }
}
