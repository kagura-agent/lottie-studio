import type { CheckStatus } from "./quality";

export interface A11yCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  suggestion?: string;
}

export interface A11yResult {
  status: CheckStatus;
  checks: A11yCheck[];
  motionScore: number;
  description: string;
  reducedMotion?: LottieAnimation;
}

interface Keyframe {
  t: number;
  s?: number[];
  e?: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface AnimatedProperty {
  a?: number;
  k?: Keyframe[] | number | number[];
}

interface LottieLayer {
  nm?: string;
  ty?: number;
  ks?: {
    o?: AnimatedProperty;
    p?: AnimatedProperty;
    s?: AnimatedProperty;
    r?: AnimatedProperty;
  };
  ip?: number;
  op?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface LottieAnimation {
  layers?: LottieLayer[];
  ip?: number;
  op?: number;
  fr?: number;
  w?: number;
  h?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const LAYER_TYPE_NAMES: Record<number, string> = {
  0: "precomp",
  1: "solid",
  2: "image",
  3: "null",
  4: "shape",
  5: "text",
};

function getKeyframes(prop: AnimatedProperty | undefined): Keyframe[] {
  if (!prop || prop.a !== 1 || !Array.isArray(prop.k)) return [];
  return prop.k as Keyframe[];
}

function framesToMs(frames: number, fr: number): number {
  return (frames / fr) * 1000;
}

export function flashDetection(animation: LottieAnimation): A11yCheck {
  const fr = animation.fr ?? 30;
  const layers = animation.layers ?? [];
  const flashThresholdMs = 333; // 3Hz = 333ms per cycle
  let maxFlashesPerSecond = 0;

  for (const layer of layers) {
    const opacityKfs = getKeyframes(layer.ks?.o);
    if (opacityKfs.length < 3) continue;

    // Count rapid opacity transitions within sliding 1-second windows
    for (let i = 0; i < opacityKfs.length - 1; i++) {
      const windowStartFrame = opacityKfs[i].t;
      const windowEndFrame = windowStartFrame + fr; // 1 second window
      let transitions = 0;

      for (let j = i; j < opacityKfs.length - 1; j++) {
        if (opacityKfs[j].t > windowEndFrame) break;
        const dt = framesToMs(opacityKfs[j + 1].t - opacityKfs[j].t, fr);
        if (dt < flashThresholdMs && dt > 0) {
          const startVal = opacityKfs[j].s?.[0] ?? opacityKfs[j].e?.[0] ?? 100;
          const endVal = opacityKfs[j + 1].s?.[0] ?? opacityKfs[j].s?.[0] ?? 100;
          const change = Math.abs(startVal - endVal);
          if (change > 25) {
            transitions++;
          }
        }
      }

      maxFlashesPerSecond = Math.max(maxFlashesPerSecond, transitions);
    }
  }

  if (maxFlashesPerSecond > 3) {
    return {
      id: "flash-detection",
      label: "Flash Detection (WCAG 2.3.1)",
      status: "fail",
      detail: `Detected up to ${maxFlashesPerSecond} rapid luminance changes per second (limit: 3)`,
      suggestion: "Slow down opacity transitions or reduce the magnitude of brightness changes",
    };
  }

  if (maxFlashesPerSecond > 2) {
    return {
      id: "flash-detection",
      label: "Flash Detection (WCAG 2.3.1)",
      status: "warn",
      detail: `Detected ${maxFlashesPerSecond} luminance changes per second — close to the 3/sec limit`,
      suggestion: "Consider slowing opacity transitions to provide more headroom",
    };
  }

  return {
    id: "flash-detection",
    label: "Flash Detection (WCAG 2.3.1)",
    status: "pass",
    detail: "No rapid flashing detected",
  };
}

export function motionIntensityScore(animation: LottieAnimation): number {
  const layers = animation.layers ?? [];
  const fr = animation.fr ?? 30;
  const totalDurationS = ((animation.op ?? 0) - (animation.ip ?? 0)) / fr;
  if (totalDurationS <= 0 || layers.length === 0) return 0;

  let totalDisplacement = 0;
  let totalRotation = 0;
  let totalScaleChange = 0;

  for (const layer of layers) {
    const posKfs = getKeyframes(layer.ks?.p);
    for (let i = 0; i < posKfs.length - 1; i++) {
      const s = posKfs[i].s ?? posKfs[i].e;
      const e = posKfs[i + 1].s ?? posKfs[i].e;
      if (Array.isArray(s) && Array.isArray(e)) {
        const dx = (e[0] ?? 0) - (s[0] ?? 0);
        const dy = (e[1] ?? 0) - (s[1] ?? 0);
        totalDisplacement += Math.sqrt(dx * dx + dy * dy);
      }
    }

    const rotKfs = getKeyframes(layer.ks?.r);
    for (let i = 0; i < rotKfs.length - 1; i++) {
      const s = rotKfs[i].s?.[0] ?? 0;
      const e = rotKfs[i + 1].s?.[0] ?? rotKfs[i].e?.[0] ?? 0;
      totalRotation += Math.abs(e - s);
    }

    const scaleKfs = getKeyframes(layer.ks?.s);
    for (let i = 0; i < scaleKfs.length - 1; i++) {
      const s = scaleKfs[i].s ?? [100, 100];
      const e = scaleKfs[i + 1].s ?? scaleKfs[i].e ?? [100, 100];
      const dx = Math.abs((e[0] ?? 100) - (s[0] ?? 100));
      const dy = Math.abs((e[1] ?? 100) - (s[1] ?? 100));
      totalScaleChange += (dx + dy) / 2;
    }
  }

  // Normalize: displacement relative to canvas diagonal
  const w = animation.w ?? 512;
  const h = animation.h ?? 512;
  const diagonal = Math.sqrt(w * w + h * h);

  const displacementScore = Math.min(50, (totalDisplacement / diagonal) * 25);
  const rotationScore = Math.min(30, (totalRotation / 360) * 15);
  const scaleScore = Math.min(20, (totalScaleChange / 100) * 10);

  return Math.min(100, Math.round(displacementScore + rotationScore + scaleScore));
}

export function generateReducedMotion(animation: LottieAnimation): LottieAnimation {
  const reduced = JSON.parse(JSON.stringify(animation)) as LottieAnimation;

  for (const layer of reduced.layers ?? []) {
    const ks = layer.ks;
    if (!ks) continue;

    // Remove position animation — keep final value
    if (ks.p && ks.p.a === 1 && Array.isArray(ks.p.k)) {
      const kfs = ks.p.k as Keyframe[];
      const lastKf = kfs[kfs.length - 1];
      const finalVal = lastKf?.s ?? lastKf?.e ?? [0, 0];
      ks.p = { a: 0, k: finalVal };
    }

    // Remove rotation animation — keep final value
    if (ks.r && ks.r.a === 1 && Array.isArray(ks.r.k)) {
      const kfs = ks.r.k as Keyframe[];
      const lastKf = kfs[kfs.length - 1];
      const finalVal = lastKf?.s?.[0] ?? lastKf?.e?.[0] ?? 0;
      ks.r = { a: 0, k: finalVal };
    }

    // Remove scale animation — keep final value
    if (ks.s && ks.s.a === 1 && Array.isArray(ks.s.k)) {
      const kfs = ks.s.k as Keyframe[];
      const lastKf = kfs[kfs.length - 1];
      const finalVal = lastKf?.s ?? lastKf?.e ?? [100, 100];
      ks.s = { a: 0, k: finalVal };
    }

    // Preserve opacity fades (don't touch ks.o)
  }

  return reduced;
}

export function generateDescription(animation: LottieAnimation): string {
  const layers = animation.layers ?? [];
  const fr = animation.fr ?? 30;
  const duration = ((animation.op ?? 0) - (animation.ip ?? 0)) / fr;

  const typeCounts: Record<string, number> = {};
  const motionTypes: Set<string> = new Set();

  for (const layer of layers) {
    const typeName = LAYER_TYPE_NAMES[layer.ty ?? -1] ?? "unknown";
    typeCounts[typeName] = (typeCounts[typeName] ?? 0) + 1;

    if (layer.ks) {
      if (getKeyframes(layer.ks.p).length > 0) motionTypes.add("position movement");
      if (getKeyframes(layer.ks.r).length > 0) motionTypes.add("rotation");
      if (getKeyframes(layer.ks.s).length > 0) motionTypes.add("scaling");
      if (getKeyframes(layer.ks.o).length > 0) motionTypes.add("opacity changes");
    }
  }

  const layerDesc = Object.entries(typeCounts)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  const motionDesc = motionTypes.size > 0
    ? `Motion includes ${Array.from(motionTypes).join(", ")}.`
    : "Static animation with no animated properties.";

  return `Animation with ${layerDesc} layer${layers.length !== 1 ? "s" : ""}, ${duration.toFixed(1)}s duration at ${fr}fps. ${motionDesc}`;
}

export function analyzeAccessibility(animation: LottieAnimation): A11yResult {
  const checks: A11yCheck[] = [];

  const flashCheck = flashDetection(animation);
  checks.push(flashCheck);

  const motionScore = motionIntensityScore(animation);

  let motionStatus: CheckStatus = "pass";
  let motionDetail = `Motion intensity: ${motionScore}/100 — minimal motion`;
  let motionSuggestion: string | undefined;

  if (motionScore > 70) {
    motionStatus = "fail";
    motionDetail = `Motion intensity: ${motionScore}/100 — high motion may cause discomfort`;
    motionSuggestion = "Provide a reduced-motion alternative for users with vestibular disorders";
  } else if (motionScore > 40) {
    motionStatus = "warn";
    motionDetail = `Motion intensity: ${motionScore}/100 — moderate motion`;
    motionSuggestion = "Consider providing a reduced-motion alternative";
  }

  checks.push({
    id: "motion-intensity",
    label: "Motion Intensity",
    status: motionStatus,
    detail: motionDetail,
    suggestion: motionSuggestion,
  });

  const description = generateDescription(animation);

  // Overall status
  let status: CheckStatus = "pass";
  if (checks.some((c) => c.status === "fail")) status = "fail";
  else if (checks.some((c) => c.status === "warn")) status = "warn";

  const result: A11yResult = {
    status,
    checks,
    motionScore,
    description,
  };

  if (motionScore > 40) {
    result.reducedMotion = generateReducedMotion(animation);
  }

  return result;
}
