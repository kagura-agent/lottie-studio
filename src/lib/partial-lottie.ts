import { completePartialJson } from "./partial-json";

export interface PartialLottie {
  v: string;
  w: number;
  h: number;
  fr?: number;
  ip?: number;
  op?: number;
  layers: unknown[];
  [key: string]: unknown;
}

/**
 * Attempts to extract a valid partial Lottie animation from incomplete JSON text.
 * Returns a PartialLottie if the minimum structure is present, null otherwise.
 */
export function extractPartialLottie(partialJsonText: string): PartialLottie | null {
  const parsed = completePartialJson(partialJsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;

  // Minimum requirements: v, w, h, and layers array
  if (typeof obj.v !== "string") return null;
  if (typeof obj.w !== "number" || obj.w <= 0) return null;
  if (typeof obj.h !== "number" || obj.h <= 0) return null;
  if (!Array.isArray(obj.layers)) return null;

  // Fill defaults for playback
  const lottie: PartialLottie = {
    ...obj,
    v: obj.v as string,
    w: obj.w as number,
    h: obj.h as number,
    layers: obj.layers as unknown[],
    fr: typeof obj.fr === "number" ? obj.fr : 30,
    ip: typeof obj.ip === "number" ? obj.ip : 0,
    op: typeof obj.op === "number" ? obj.op : 60,
  };

  return lottie;
}
