/**
 * Shake generator: a quick, decaying intensity oscillation (screen shake, vibration, impact tremor).
 *
 * Model: value(t) = intensity * e^(-decay*t) * sin(2*pi*frequency*t + phase)
 * where t is elapsed time in seconds since the shake started, and phase is derived
 * from an optional seed so independent axes can be offset from one another.
 *
 * Distinct from wiggle (continuous random motion that never stops) and spring
 * (physics overshoot on existing keyframes) — shake always decays to rest.
 */

export const VALID_SHAKE_AXES = ["x", "y", "both", "rotation"] as const;
export type ShakeAxis = (typeof VALID_SHAKE_AXES)[number];

export interface ShakeOptions {
  intensity: number;
  frequency: number;
  decay: number;
  seed?: number;
}

export interface ShakeCommandOptions {
  intensity?: number;
  frequency?: number;
  decay?: number;
  axis?: ShakeAxis;
  layer?: string;
  duration?: number;
}

export interface ShakeKeyframe {
  t: number;
  s: number[];
}

export function resolveShakeOptions(opts: ShakeCommandOptions): ShakeOptions {
  return {
    intensity: opts.intensity ?? 10,
    frequency: opts.frequency ?? 12,
    decay: opts.decay ?? 0.85,
  };
}

/** Deterministic seed -> phase in [0, 2*pi), so different seeds shift the oscillation. */
function phaseFromSeed(seed: number): number {
  const s = (seed | 0) + 0x6d2b79f5;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return r * Math.PI * 2;
}

export function generateShakeKeyframes(
  startFrame: number,
  endFrame: number,
  fps: number,
  options: ShakeOptions
): ShakeKeyframe[] {
  const { intensity, frequency, decay, seed } = options;
  const durationFrames = endFrame - startFrame;

  if (durationFrames <= 0) {
    return [{ t: startFrame, s: [0] }];
  }

  const durationSeconds = durationFrames / fps;
  const samplesPerSecond = Math.max(frequency * 4, fps);
  const numSamples = Math.max(2, Math.round(durationSeconds * samplesPerSecond) + 1);
  const phase = seed === undefined ? 0 : phaseFromSeed(seed);

  const keyframes: ShakeKeyframe[] = [];
  for (let i = 0; i < numSamples; i++) {
    const frameOffset = (durationFrames * i) / (numSamples - 1);
    const timeSeconds = frameOffset / fps;
    const envelope = intensity * Math.exp(-decay * timeSeconds);
    const value = envelope * Math.sin(2 * Math.PI * frequency * timeSeconds + phase);
    keyframes.push({ t: Math.round(startFrame + frameOffset), s: [value] });
  }

  return keyframes;
}
