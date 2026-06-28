/**
 * Telegram Animated Sticker (.tgs) exporter.
 *
 * The .tgs format is gzipped Lottie JSON with constraints:
 * - Canvas: 512×512
 * - Max duration: 3 seconds (90 frames at 30fps)
 * - Max compressed file size: 64KB
 * - No image layers (type 2)
 * - No text layers (type 5)
 * - Frame rate ≤ 60fps (30fps recommended)
 */

import { roundDecimals, removeEmptyGroups } from "@/lib/optimizer";

export interface TgsExportResult {
  blob: Blob;
  warnings: string[];
  compressedSize: number;
}

export interface TgsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const TGS_CANVAS_SIZE = 512;
const TGS_MAX_FRAMES = 90; // 3 seconds at 30fps
const TGS_MAX_FPS = 60;
const TGS_RECOMMENDED_FPS = 30;
const TGS_MAX_COMPRESSED_SIZE = 64 * 1024; // 64KB

type LottieData = Record<string, unknown>;

/**
 * Validate animation data against TGS constraints without modifying it.
 */
export function validateForTgs(animationData: object): TgsValidationResult {
  const data = animationData as LottieData;
  const errors: string[] = [];
  const warnings: string[] = [];

  const w = (data.w as number) ?? 0;
  const h = (data.h as number) ?? 0;
  const fr = (data.fr as number) ?? 30;
  const ip = (data.ip as number) ?? 0;
  const op = (data.op as number) ?? 0;
  const durationFrames = op - ip;
  const durationSeconds = durationFrames / fr;

  if (w !== TGS_CANVAS_SIZE || h !== TGS_CANVAS_SIZE) {
    warnings.push(`Canvas is ${w}×${h}, will be resized to ${TGS_CANVAS_SIZE}×${TGS_CANVAS_SIZE}`);
  }

  if (durationSeconds > 3) {
    warnings.push(
      `Duration is ${durationSeconds.toFixed(1)}s, will be truncated to 3s`
    );
  }

  if (fr > TGS_MAX_FPS) {
    errors.push(`Frame rate ${fr}fps exceeds maximum ${TGS_MAX_FPS}fps`);
  } else if (fr > TGS_RECOMMENDED_FPS) {
    warnings.push(
      `Frame rate ${fr}fps exceeds recommended ${TGS_RECOMMENDED_FPS}fps`
    );
  }

  if (Array.isArray(data.layers)) {
    const layers = data.layers as LottieData[];
    const imageLayerCount = layers.filter((l) => l.ty === 2).length;
    const textLayerCount = layers.filter((l) => l.ty === 5).length;

    if (imageLayerCount > 0) {
      warnings.push(
        `${imageLayerCount} image layer(s) will be stripped (not supported in TGS)`
      );
    }
    if (textLayerCount > 0) {
      warnings.push(
        `${textLayerCount} text layer(s) will be stripped (not supported in TGS)`
      );
    }
  }

  // Check for expressions
  if (hasExpressions(data)) {
    warnings.push("Expressions will be removed (not supported in TGS)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Export animation data to TGS format (gzipped Lottie JSON).
 */
export async function exportToTgs(
  animationData: object
): Promise<TgsExportResult> {
  const warnings: string[] = [];
  let data = JSON.parse(JSON.stringify(animationData)) as LottieData;

  // Strip image layers (type 2)
  if (Array.isArray(data.layers)) {
    const layers = data.layers as LottieData[];
    const imageCount = layers.filter((l) => l.ty === 2).length;
    if (imageCount > 0) {
      data.layers = layers.filter((l) => l.ty !== 2);
      warnings.push(`Stripped ${imageCount} image layer(s)`);
    }
  }

  // Strip text layers (type 5)
  if (Array.isArray(data.layers)) {
    const layers = data.layers as LottieData[];
    const textCount = layers.filter((l) => l.ty === 5).length;
    if (textCount > 0) {
      data.layers = layers.filter((l) => l.ty !== 5);
      warnings.push(`Stripped ${textCount} text layer(s)`);
    }
  }

  // Truncate duration to 3 seconds
  const fr = (data.fr as number) ?? 30;
  const ip = (data.ip as number) ?? 0;
  const op = (data.op as number) ?? 0;
  const maxFrames = Math.min(TGS_MAX_FRAMES, Math.round(3 * fr));
  const durationFrames = op - ip;

  if (durationFrames > maxFrames) {
    data.op = ip + maxFrames;
    warnings.push(
      `Truncated duration from ${(durationFrames / fr).toFixed(1)}s to 3s`
    );
    // Clamp layer op values
    if (Array.isArray(data.layers)) {
      for (const layer of data.layers as LottieData[]) {
        if (typeof layer.op === "number" && layer.op > (data.op as number)) {
          layer.op = data.op as number;
        }
      }
    }
  }

  // Remove expressions
  if (hasExpressions(data)) {
    removeExpressions(data);
    warnings.push("Removed expressions");
  }

  // Remove assets that reference images
  if (Array.isArray(data.assets)) {
    data.assets = (data.assets as LottieData[]).filter(
      (asset) => !asset.p && !asset.u
    );
  }

  // Optimize: remove empty groups and round decimals to reduce size
  data = removeEmptyGroups(data) as LottieData;
  data = roundDecimals(data, 2) as LottieData;

  // Ensure tgs field is set (required by Telegram)
  data.tgs = 1;

  // Serialize to compact JSON
  const json = JSON.stringify(data);

  // Gzip compress
  const blob = await gzipCompress(json);
  const compressedSize = blob.size;

  if (compressedSize > TGS_MAX_COMPRESSED_SIZE) {
    throw new Error(
      `Compressed TGS file is ${(compressedSize / 1024).toFixed(1)}KB, exceeds 64KB limit. ` +
        `Try simplifying the animation or reducing keyframes.`
    );
  }

  return {
    blob: new Blob([await blob.arrayBuffer()], {
      type: "application/gzip",
    }),
    warnings,
    compressedSize,
  };
}

/**
 * Check if animation data contains expressions.
 */
function hasExpressions(data: LottieData): boolean {
  const json = JSON.stringify(data);
  return json.includes('"x"') || json.includes('"ix"');
}

/**
 * Remove expression properties from animation data (mutates in place).
 */
function removeExpressions(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      removeExpressions(item);
    }
    return;
  }
  const record = obj as LottieData;
  // Remove expression string properties
  if (typeof record.x === "string") {
    delete record.x;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      removeExpressions(value);
    }
  }
}

/**
 * Gzip compress a string using CompressionStream API.
 */
async function gzipCompress(input: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(input);

  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(inputBytes);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([merged], { type: "application/gzip" });
}
