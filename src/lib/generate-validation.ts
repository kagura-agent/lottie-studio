/**
 * Input validation for the /api/generate endpoint.
 * Extracted for testability.
 */

export interface GenerateInput {
  prompt: string;
  width?: number;
  height?: number;
  duration?: number;
}

export type ValidationResult =
  | { valid: true; data: Required<GenerateInput> }
  | { valid: false; error: string }

const PROMPT_MAX_LENGTH = 500;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 2048;
const MIN_DURATION = 0.5;
const MAX_DURATION = 30;
const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;
const DEFAULT_DURATION = 2;

export function validateGenerateInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { prompt, width, height, duration } = body as Record<string, unknown>;

  // Prompt validation
  if (prompt === undefined || prompt === null) {
    return { valid: false, error: "\"prompt\" is required" };
  }
  if (typeof prompt !== "string") {
    return { valid: false, error: "\"prompt\" must be a string" };
  }
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "\"prompt\" must not be empty" };
  }
  if (trimmed.length > PROMPT_MAX_LENGTH) {
    return { valid: false, error: `\"prompt\" must be at most ${PROMPT_MAX_LENGTH} characters (got ${trimmed.length})` };
  }

  // Width validation
  let w = DEFAULT_WIDTH;
  if (width !== undefined) {
    if (typeof width !== "number" || !Number.isFinite(width)) {
      return { valid: false, error: "\"width\" must be a finite number" };
    }
    if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
      return { valid: false, error: `\"width\" must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}` };
    }
    w = Math.round(width);
  }

  // Height validation
  let h = DEFAULT_HEIGHT;
  if (height !== undefined) {
    if (typeof height !== "number" || !Number.isFinite(height)) {
      return { valid: false, error: "\"height\" must be a finite number" };
    }
    if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
      return { valid: false, error: `\"height\" must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}` };
    }
    h = Math.round(height);
  }

  // Duration validation
  let dur = DEFAULT_DURATION;
  if (duration !== undefined) {
    if (typeof duration !== "number" || !Number.isFinite(duration)) {
      return { valid: false, error: "\"duration\" must be a finite number" };
    }
    if (duration < MIN_DURATION || duration > MAX_DURATION) {
      return { valid: false, error: `\"duration\" must be between ${MIN_DURATION} and ${MAX_DURATION} seconds` };
    }
    dur = duration;
  }

  return {
    valid: true,
    data: { prompt: trimmed, width: w, height: h, duration: dur },
  };
}
