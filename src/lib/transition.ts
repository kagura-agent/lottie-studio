export const VALID_TRANSITION_TYPES = ["fade", "slide", "wipe", "zoom", "flip", "dissolve"] as const;
export type TransitionType = (typeof VALID_TRANSITION_TYPES)[number];

export const VALID_TRANSITION_DIRECTIONS = ["left", "right", "up", "down"] as const;
export type TransitionDirection = (typeof VALID_TRANSITION_DIRECTIONS)[number];

export const VALID_TRANSITION_EASINGS = ["linear", "ease-in", "ease-out", "ease-in-out"] as const;
export type TransitionEasing = (typeof VALID_TRANSITION_EASINGS)[number];

export interface TransitionCommandOptions {
  type: TransitionType;
  duration?: number;
  easing?: TransitionEasing;
  direction?: TransitionDirection;
  stagger?: number;
  layer?: string;
}

export interface TransitionKeyframe {
  t: number;
  s: number[];
}

function easingValue(progress: number, easing: TransitionEasing): number {
  switch (easing) {
    case "linear":
      return progress;
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - (1 - progress) * (1 - progress);
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  }
}

function generateFadeKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const progress = f / totalFrames;
    const opacity = Math.round(easingValue(progress, easing) * 100);
    keyframes.push({ t: startFrame + f, s: [opacity] });
  }
  return keyframes;
}

function generateSlideKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing,
  direction: TransitionDirection
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  const distance = 512;
  for (let f = 0; f <= totalFrames; f++) {
    const progress = easingValue(f / totalFrames, easing);
    let x = 0, y = 0;
    switch (direction) {
      case "left": x = -distance * (1 - progress); break;
      case "right": x = distance * (1 - progress); break;
      case "up": y = -distance * (1 - progress); break;
      case "down": y = distance * (1 - progress); break;
    }
    keyframes.push({ t: startFrame + f, s: [x, y] });
  }
  return keyframes;
}

function generateWipeKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing,
  direction: TransitionDirection
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const progress = easingValue(f / totalFrames, easing);
    let x = 0, y = 0, w = 512, h = 512;
    switch (direction) {
      case "left": w = Math.round(512 * progress); break;
      case "right": x = Math.round(512 * (1 - progress)); w = Math.round(512 * progress); break;
      case "up": h = Math.round(512 * progress); break;
      case "down": y = Math.round(512 * (1 - progress)); h = Math.round(512 * progress); break;
    }
    keyframes.push({ t: startFrame + f, s: [x, y, w, h] });
  }
  return keyframes;
}

function generateZoomKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const progress = easingValue(f / totalFrames, easing);
    const scale = Math.round(progress * 100);
    keyframes.push({ t: startFrame + f, s: [scale, scale] });
  }
  return keyframes;
}

function generateFlipKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing,
  direction: TransitionDirection
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const progress = easingValue(f / totalFrames, easing);
    const angle = (1 - progress) * 180;
    const axis = direction === "up" || direction === "down" ? "x" : "y";
    keyframes.push({ t: startFrame + f, s: [axis === "x" ? angle : 0, axis === "y" ? angle : 0] });
  }
  return keyframes;
}

function generateDissolveKeyframes(
  startFrame: number,
  totalFrames: number,
  easing: TransitionEasing
): TransitionKeyframe[] {
  const keyframes: TransitionKeyframe[] = [];
  for (let f = 0; f <= totalFrames; f++) {
    const progress = easingValue(f / totalFrames, easing);
    const opacity = Math.round(progress * 100);
    const noise = Math.round((1 - progress) * 100);
    keyframes.push({ t: startFrame + f, s: [opacity, noise] });
  }
  return keyframes;
}

export function generateTransitionKeyframes(
  type: TransitionType,
  options: TransitionCommandOptions,
  startFrame: number = 0,
  fps: number = 30
): TransitionKeyframe[] {
  const durationMs = options.duration ?? 600;
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const easing = options.easing ?? "ease-in-out";
  const direction = options.direction ?? "left";

  switch (type) {
    case "fade":
      return generateFadeKeyframes(startFrame, totalFrames, easing);
    case "slide":
      return generateSlideKeyframes(startFrame, totalFrames, easing, direction);
    case "wipe":
      return generateWipeKeyframes(startFrame, totalFrames, easing, direction);
    case "zoom":
      return generateZoomKeyframes(startFrame, totalFrames, easing);
    case "flip":
      return generateFlipKeyframes(startFrame, totalFrames, easing, direction);
    case "dissolve":
      return generateDissolveKeyframes(startFrame, totalFrames, easing);
  }
}
