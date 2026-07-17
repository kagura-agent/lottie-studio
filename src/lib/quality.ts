/**
 * Animation quality analysis — scores a Lottie JSON for production-readiness.
 * Pure functions, no dependencies beyond standard lib.
 */

import { validateStructure } from "./validation";

export type CheckStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  score: number; // 0-100 per check
  detail: string;
  suggestion?: string; // natural language suggestion for chat
}

export interface QualityResult {
  score: number; // overall 0-100
  status: CheckStatus; // derived from score
  checks: QualityCheck[];
}

// --- Lottie type helpers (minimal, just what we need) ---

interface LottieLayer {
  nm?: string;
  hd?: boolean;
  ty?: number;
  ks?: {
    o?: {
      a?: number;
      k?: unknown;
    };
    p?: {
      a?: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      k?: any;
    };
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

// --- Individual checks ---

export function checkFileSize(jsonString: string): QualityCheck {
  const bytes = new TextEncoder().encode(jsonString).length;
  const kb = bytes / 1024;

  let status: CheckStatus;
  let score: number;
  let detail: string;
  let suggestion: string | undefined;

  if (kb < 50) {
    status = "pass";
    score = 100;
    detail = `${kb.toFixed(1)} KB — well within web optimization target`;
  } else if (kb <= 150) {
    status = "warn";
    score = 60;
    detail = `${kb.toFixed(1)} KB — consider optimizing for faster load times`;
    suggestion = "Optimize file size by simplifying shapes or reducing keyframes";
  } else {
    status = "fail";
    score = 20;
    detail = `${kb.toFixed(1)} KB — too large for typical web use`;
    suggestion = "Reduce file size by removing unnecessary detail or splitting into smaller animations";
  }

  return { id: "file-size", label: "File Size", status, score, detail, suggestion };
}

export function checkLayerCount(animation: LottieAnimation): QualityCheck {
  const count = animation.layers?.length ?? 0;

  let status: CheckStatus;
  let score: number;
  let detail: string;
  let suggestion: string | undefined;

  if (count < 10) {
    status = "pass";
    score = 100;
    detail = `${count} layer${count !== 1 ? "s" : ""} — good for rendering performance`;
  } else if (count <= 20) {
    status = "warn";
    score = 60;
    detail = `${count} layers — may impact rendering performance on low-end devices`;
    suggestion = "Reduce layer count by merging similar layers or pre-composing groups";
  } else {
    status = "fail";
    score = 20;
    detail = `${count} layers — high rendering overhead, especially on mobile`;
    suggestion = "Significantly reduce layers by merging, pre-composing, or removing unnecessary elements";
  }

  return { id: "layer-count", label: "Layer Count", status, score, detail, suggestion };
}

export function checkHiddenLayers(animation: LottieAnimation): QualityCheck {
  const layers = animation.layers ?? [];
  const hidden: string[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const name = layer.nm || `Layer ${i + 1}`;

    // Check hd (hidden) flag
    if (layer.hd === true) {
      hidden.push(name);
      continue;
    }

    // Check if opacity is zero throughout (static case)
    const opacity = layer.ks?.o;
    if (opacity && opacity.a === 0 && opacity.k === 0) {
      hidden.push(name);
    }
  }

  let status: CheckStatus;
  let score: number;
  let detail: string;
  let suggestion: string | undefined;

  if (hidden.length === 0) {
    status = "pass";
    score = 100;
    detail = "No hidden or unused layers detected";
  } else {
    status = "warn";
    score = Math.max(20, 100 - hidden.length * 20);
    detail = `${hidden.length} hidden/unused layer${hidden.length !== 1 ? "s" : ""}: ${hidden.slice(0, 3).join(", ")}${hidden.length > 3 ? "..." : ""}`;
    suggestion = `Remove hidden layers (${hidden.slice(0, 2).join(", ")}) to reduce file size`;
  }

  return { id: "hidden-layers", label: "Hidden Layers", status, score, detail, suggestion };
}

export function checkLoopSmoothness(animation: LottieAnimation): QualityCheck {
  const layers = animation.layers ?? [];
  const totalFrames = (animation.op ?? 0) - (animation.ip ?? 0);

  if (totalFrames <= 1 || layers.length === 0) {
    return {
      id: "loop-smoothness",
      label: "Loop Smoothness",
      status: "pass",
      score: 100,
      detail: "Single-frame or empty animation — loop check not applicable",
    };
  }

  // Check position (p) and opacity (o) at first vs last frame for each layer
  let mismatchCount = 0;
  let checkedLayers = 0;

  for (const layer of layers) {
    if (layer.hd) continue;
    const ks = layer.ks;
    if (!ks) continue;

    checkedLayers++;

    // Check position
    const pos = ks.p;
    if (pos && pos.a === 1 && Array.isArray(pos.k) && pos.k.length >= 2) {
      const firstKf = pos.k[0];
      const lastKf = pos.k[pos.k.length - 1];
      if (firstKf && lastKf) {
        const startVal = firstKf.s ?? firstKf.e;
        const endVal = lastKf.s ?? lastKf.e;
        if (Array.isArray(startVal) && Array.isArray(endVal)) {
          const dist = Math.sqrt(
            startVal.reduce((sum: number, v: number, i: number) => {
              const diff = v - (endVal[i] ?? 0);
              return sum + diff * diff;
            }, 0)
          );
          if (dist > 5) mismatchCount++;
        }
      }
    }
  }

  let status: CheckStatus;
  let score: number;
  let detail: string;
  let suggestion: string | undefined;

  if (checkedLayers === 0) {
    status = "pass";
    score = 100;
    detail = "No animated layers to check for loop continuity";
  } else if (mismatchCount === 0) {
    status = "pass";
    score = 100;
    detail = "Animation loops smoothly — first and last frame states align";
  } else {
    const ratio = mismatchCount / checkedLayers;
    if (ratio <= 0.3) {
      status = "warn";
      score = 60;
    } else {
      status = "fail";
      score = 30;
    }
    detail = `${mismatchCount} of ${checkedLayers} layer${checkedLayers !== 1 ? "s" : ""} have position mismatch between first and last keyframe`;
    suggestion = "Make the animation loop seamlessly by matching start and end positions";
  }

  return { id: "loop-smoothness", label: "Loop Smoothness", status, score, detail, suggestion };
}

export function checkFrameRate(animation: LottieAnimation): QualityCheck {
  const fr = animation.fr ?? 30;
  const totalFrames = (animation.op ?? 0) - (animation.ip ?? 0);

  let status: CheckStatus;
  let score: number;
  let detail: string;
  let suggestion: string | undefined;

  if (fr > 60) {
    status = "warn";
    score = 50;
    detail = `${fr} fps — unnecessarily high for web playback`;
    suggestion = "Reduce frame rate to 30 or 60 fps for web — higher rates waste bandwidth without visible benefit";
  } else if (totalFrames > 900) {
    // > 30s at 30fps
    status = "warn";
    score = 60;
    detail = `${totalFrames} frames (${(totalFrames / fr).toFixed(1)}s at ${fr}fps) — very long animation`;
    suggestion = "Consider splitting into shorter animation segments for better loading performance";
  } else {
    status = "pass";
    score = 100;
    detail = `${fr} fps, ${totalFrames} frames (${(totalFrames / fr).toFixed(1)}s) — appropriate for web`;
  }

  return { id: "frame-rate", label: "Frame Rate", status, score, detail, suggestion };
}

function checkStructuralValidity(animation: LottieAnimation): QualityCheck[] {
  const result = validateStructure(animation as Record<string, unknown>);
  if (result.issues.length === 0) {
    return [{
      id: "structural-validity",
      label: "Structural Validity",
      status: "pass",
      score: 100,
      detail: "No structural issues detected",
    }];
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  const status: CheckStatus = errors.length > 0 ? "fail" : "warn";
  const score = errors.length > 0 ? Math.max(0, 40 - errors.length * 10) : Math.max(40, 80 - warnings.length * 10);
  const detail = `${errors.length} error(s), ${warnings.length} warning(s): ${result.issues.slice(0, 3).map((i) => i.message).join("; ")}${result.issues.length > 3 ? "..." : ""}`;

  return [{
    id: "structural-validity",
    label: "Structural Validity",
    status,
    score,
    detail,
    suggestion: errors.length > 0
      ? "Fix structural errors: " + errors.slice(0, 2).map((i) => i.message).join("; ")
      : "Address structural warnings: " + warnings.slice(0, 2).map((i) => i.message).join("; "),
  }];
}

// --- Main analysis function ---

export function analyzeQuality(animation: LottieAnimation, jsonString?: string): QualityResult {
  const json = jsonString ?? JSON.stringify(animation);

  const checks: QualityCheck[] = [
    checkFileSize(json),
    checkLayerCount(animation),
    checkHiddenLayers(animation),
    checkLoopSmoothness(animation),
    checkFrameRate(animation),
    ...checkStructuralValidity(animation),
  ];

  // Weighted average (all equal weight for now)
  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const score = Math.round(totalScore / checks.length);

  let status: CheckStatus;
  if (score >= 80) {
    status = "pass";
  } else if (score >= 50) {
    status = "warn";
  } else {
    status = "fail";
  }

  return { score, status, checks };
}
