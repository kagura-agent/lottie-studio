/**
 * Spring physics engine for generating keyframe values using a damped harmonic oscillator.
 *
 * Model: x(t) = A * e^(-γt) * cos(ωt + φ)
 * where:
 *   γ = damping / (2 * mass)  (damping ratio coefficient)
 *   ω = sqrt(stiffness/mass - γ²)  (damped angular frequency)
 *   A = displacement amplitude
 *   φ = phase offset (0 for starting at rest)
 */

export interface SpringOptions {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface SpringPresetConfig {
  stiffness: number;
  damping: number;
}

export const SPRING_PRESETS = ["snappy", "bouncy", "gentle", "wobbly"] as const;
export type SpringPreset = (typeof SPRING_PRESETS)[number];

export const SPRING_PRESET_VALUES: Record<SpringPreset, SpringPresetConfig> = {
  snappy: { stiffness: 300, damping: 20 },
  bouncy: { stiffness: 120, damping: 8 },
  gentle: { stiffness: 80, damping: 15 },
  wobbly: { stiffness: 100, damping: 5 },
};

export const VALID_SPRING_PROPERTIES = ["position", "scale", "rotation", "opacity"] as const;
export type SpringProperty = (typeof VALID_SPRING_PROPERTIES)[number];

export interface SpringCommandOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  layer?: string;
  property?: SpringProperty;
  preset?: SpringPreset;
}

/**
 * Generate spring-interpolated values between a start and end value.
 * Uses a damped harmonic oscillator model.
 *
 * @param startValue - Starting value (number or array of numbers)
 * @param endValue - Target/end value (number or array of numbers)
 * @param options - Spring physics parameters
 * @param fps - Frames per second for time stepping (default 30)
 * @returns Array of interpolated values at each frame
 */
export function generateSpringKeyframes(
  startValue: number | number[],
  endValue: number | number[],
  options: SpringOptions,
  fps: number = 30
): (number | number[])[] {
  const { stiffness, damping, mass } = options;

  // Compute damping coefficient and angular frequency
  const gamma = damping / (2 * mass);
  const omegaSquared = stiffness / mass - gamma * gamma;

  // If overdamped or critically damped, use exponential decay without oscillation
  const isUnderdamped = omegaSquared > 0;
  const omega = isUnderdamped ? Math.sqrt(omegaSquared) : 0;

  const dt = 1 / fps;
  const isArray = Array.isArray(startValue);
  const start = isArray ? (startValue as number[]) : [startValue as number];
  const end = isArray ? (endValue as number[]) : [endValue as number];

  // Displacement per dimension
  const displacement = start.map((s, i) => s - end[i]);

  // Threshold: amplitude < 0.1% of max displacement
  const maxDisplacement = Math.max(...displacement.map(Math.abs), 0.001);
  const threshold = maxDisplacement * 0.001;

  const frames: (number | number[])[] = [];
  // Always include the start value
  frames.push(isArray ? [...start] : start[0]);

  let settled = false;
  let t = dt;
  const maxFrames = fps * 10; // Safety cap: max 10 seconds

  while (!settled && frames.length < maxFrames) {
    let envelope: number;

    if (isUnderdamped) {
      // x(t) = A * e^(-γt) * cos(ωt)
      envelope = Math.exp(-gamma * t);
      const oscillation = Math.cos(omega * t);
      const factor = envelope * oscillation;

      const values = end.map((e, i) => e + displacement[i] * factor);
      frames.push(isArray ? values : values[0]);

      // Check if the spring has settled
      const amplitude = Math.abs(envelope * maxDisplacement);
      if (amplitude < threshold) {
        settled = true;
      }
    } else {
      // Overdamped/critically damped: exponential decay
      envelope = Math.exp(-gamma * t);

      let factor: number;
      if (omegaSquared === 0) {
        // Critically damped: (1 + γt) * e^(-γt) → envelope already covers decay
        factor = (1 + gamma * t) * envelope;
      } else {
        // Overdamped: e^(-γt) * cosh(βt) where β = sqrt(γ² - ω₀²)
        const beta = Math.sqrt(-omegaSquared);
        factor = envelope * Math.cosh(beta * t);
      }

      // Clamp factor to avoid numerical drift
      factor = Math.min(factor, 1);

      const values = end.map((e, i) => e + displacement[i] * factor);
      frames.push(isArray ? values : values[0]);

      if (Math.abs(envelope * maxDisplacement) < threshold) {
        settled = true;
      }
    }

    t += dt;
  }

  // Always end exactly at the target value
  const lastFrame = frames[frames.length - 1];
  const lastMatches = isArray
    ? (lastFrame as number[]).every((v, i) => Math.abs(v - end[i]) < 0.01)
    : Math.abs(lastFrame as number - end[0]) < 0.01;

  if (!lastMatches) {
    frames.push(isArray ? [...end] : end[0]);
  }

  return frames;
}

/**
 * Resolve spring options from command options, applying preset values if specified.
 */
export function resolveSpringOptions(opts: SpringCommandOptions): SpringOptions {
  let stiffness = opts.stiffness ?? 170;
  let damping = opts.damping ?? 12;
  const mass = opts.mass ?? 1;

  if (opts.preset && SPRING_PRESET_VALUES[opts.preset]) {
    const preset = SPRING_PRESET_VALUES[opts.preset];
    stiffness = opts.stiffness ?? preset.stiffness;
    damping = opts.damping ?? preset.damping;
  }

  return { stiffness, damping, mass };
}
