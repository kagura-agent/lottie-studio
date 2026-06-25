// Pure Lottie optimization functions — no side effects, no mutations

type LottieData = Record<string, unknown>;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function roundDecimals(data: unknown, precision = 3): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "number") {
    if (Number.isInteger(data)) return data;
    return parseFloat(data.toFixed(precision));
  }
  if (Array.isArray(data)) {
    return data.map((item) => roundDecimals(item, precision));
  }
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = roundDecimals(value, precision);
    }
    return result;
  }
  return data;
}

export function removeHiddenLayers(data: unknown): LottieData {
  const cloned = deepClone(data) as LottieData;
  if (!Array.isArray(cloned.layers)) return cloned;
  cloned.layers = (cloned.layers as LottieData[]).filter(
    (layer) => layer.hd !== true
  );
  return cloned;
}

export function removeEmptyGroups(data: unknown): LottieData {
  const cloned = deepClone(data) as LottieData;
  if (!Array.isArray(cloned.layers)) return cloned;

  for (const layer of cloned.layers as LottieData[]) {
    if (!Array.isArray(layer.shapes)) continue;
    layer.shapes = (layer.shapes as LottieData[]).filter((shape) => {
      if (shape.ty !== "gr") return true;
      if (!Array.isArray(shape.it)) return true;
      const items = shape.it as LottieData[];
      const nonTransformItems = items.filter((item) => item.ty !== "tr");
      return nonTransformItems.length > 0;
    });
  }
  return cloned;
}

function arraysEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

export function removeRedundantKeyframes(data: unknown): LottieData {
  const cloned = deepClone(data) as LottieData;
  if (!Array.isArray(cloned.layers)) return cloned;

  function processAnimatedProp(prop: LottieData) {
    if (prop.a !== 1 || !Array.isArray(prop.k)) return;
    const keyframes = prop.k as LottieData[];
    if (keyframes.length <= 1) return;

    const filtered: LottieData[] = [];
    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      if (i === 0) {
        // Keep first keyframe only if it actually animates (s !== e)
        if (kf.e !== undefined && !arraysEqual(kf.s, kf.e)) {
          filtered.push(kf);
        } else if (kf.e === undefined) {
          filtered.push(kf);
        } else {
          // First keyframe is a no-op (s === e), skip if next kf starts at same value
          if (i + 1 < keyframes.length && arraysEqual(kf.e, keyframes[i + 1].s)) {
            continue;
          }
          filtered.push(kf);
        }
      } else if (i === keyframes.length - 1) {
        // Always keep the last keyframe (it defines final state)
        filtered.push(kf);
      } else {
        // Middle keyframe: keep if it introduces a change
        if (kf.e !== undefined && !arraysEqual(kf.s, kf.e)) {
          filtered.push(kf);
        } else if (kf.e === undefined) {
          filtered.push(kf);
        } else {
          // s === e and previous end === s: this is redundant
          continue;
        }
      }
    }
    prop.k = filtered;
  }

  function walkProperties(obj: unknown) {
    if (!obj || typeof obj !== "object") return;
    const record = obj as LottieData;
    if (record.a === 1 && Array.isArray(record.k)) {
      processAnimatedProp(record);
      return;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        walkProperties(value);
      }
    }
  }

  for (const layer of cloned.layers as LottieData[]) {
    walkProperties(layer);
  }
  return cloned;
}

export function collapseSingleItemGroups(data: unknown): LottieData {
  const cloned = deepClone(data) as LottieData;
  if (!Array.isArray(cloned.layers)) return cloned;

  for (const layer of cloned.layers as LottieData[]) {
    if (!Array.isArray(layer.shapes)) continue;
    layer.shapes = (layer.shapes as LottieData[]).map((shape) => {
      if (shape.ty !== "gr") return shape;
      if (!Array.isArray(shape.it)) return shape;
      const items = shape.it as LottieData[];
      const nonTransformItems = items.filter((item) => item.ty !== "tr");
      if (nonTransformItems.length === 1) {
        return nonTransformItems[0];
      }
      return shape;
    });
  }
  return cloned;
}

export interface OptimizeStats {
  originalSize: number;
  optimizedSize: number;
  layersRemoved: number;
  keyframesRemoved: number;
  groupsSimplified: number;
}

function countKeyframes(data: LottieData): number {
  let count = 0;
  function walk(obj: unknown) {
    if (!obj || typeof obj !== "object") return;
    const record = obj as LottieData;
    if (record.a === 1 && Array.isArray(record.k)) {
      count += (record.k as unknown[]).length;
      return;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") walk(value);
    }
  }
  if (Array.isArray(data.layers)) {
    for (const layer of data.layers as LottieData[]) {
      walk(layer);
    }
  }
  return count;
}

function countGroups(data: LottieData): number {
  let count = 0;
  if (!Array.isArray(data.layers)) return 0;
  for (const layer of data.layers as LottieData[]) {
    if (!Array.isArray(layer.shapes)) continue;
    for (const shape of layer.shapes as LottieData[]) {
      if (shape.ty === "gr") count++;
    }
  }
  return count;
}

export interface ValidationResult {
  fixed: LottieData;
  warnings: string[];
  fixesApplied: string[];
}

export function validateAndFix(data: unknown): ValidationResult {
  const fixed = JSON.parse(JSON.stringify(data)) as LottieData;
  const warnings: string[] = [];
  const fixesApplied: string[] = [];

  const rootIp = (fixed.ip as number) ?? 0;
  const rootOp = (fixed.op as number) ?? 60;
  const rootW = (fixed.w as number) ?? 512;
  const rootH = (fixed.h as number) ?? 512;

  // --- Helper: fix color values 0-255 → 0-1 ---
  function fixColor(colorProp: LottieData, context: string) {
    const k = colorProp.k;
    if (!Array.isArray(k)) return;
    // Check if ANY of the first 3 (RGB) values are > 1
    const rgb = k.slice(0, 3) as number[];
    if (rgb.some((v) => typeof v === "number" && v > 1)) {
      for (let i = 0; i < 3 && i < k.length; i++) {
        if (typeof k[i] === "number") {
          k[i] = (k[i] as number) / 255;
        }
      }
      fixesApplied.push(`Normalized color values (0-255 → 0-1) in ${context}`);
    }
  }

  // --- Helper: walk shapes recursively to fix colors and check for warnings ---
  function walkShapes(shapes: LottieData[], layerName: string) {
    for (const shape of shapes) {
      if (shape.ty === "fl" || shape.ty === "st") {
        const c = shape.c as LottieData | undefined;
        if (c && (c.a === 0 || c.a === undefined)) {
          fixColor(c, `${layerName} ${shape.ty === "fl" ? "fill" : "stroke"}`);
        }
      }
      if (shape.ty === "gr" && Array.isArray(shape.it)) {
        const items = shape.it as LottieData[];
        // Warn: group with no fill/stroke
        const hasFillOrStroke = items.some(
          (item) => item.ty === "fl" || item.ty === "st" || item.ty === "gf" || item.ty === "gs"
        );
        if (!hasFillOrStroke) {
          warnings.push(`Shape group in "${layerName}" has no fill or stroke and may be invisible`);
        }
        walkShapes(items, layerName);
      }
      // Warn: zero-sized shapes
      if (shape.s && typeof shape.s === "object") {
        const s = shape.s as LottieData;
        if (s.a === 0 && Array.isArray(s.k)) {
          const dims = s.k as number[];
          if (dims.length >= 2 && dims[0] < 1 && dims[1] < 1) {
            warnings.push(`Zero-sized shape in "${layerName}" (${dims[0]}x${dims[1]})`);
          }
        }
      }
    }
  }

  // --- Helper: walk animated properties to check keyframe ranges ---
  function walkAnimatedProps(obj: unknown, layerName: string, op: number) {
    if (!obj || typeof obj !== "object") return;
    const record = obj as LottieData;
    if (record.a === 1 && Array.isArray(record.k)) {
      for (const kf of record.k as LottieData[]) {
        if (typeof kf.t === "number" && kf.t > op) {
          warnings.push(`Keyframe at t=${kf.t} in "${layerName}" is beyond animation end (op=${op})`);
          break; // One warning per property is enough
        }
      }
      return;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        walkAnimatedProps(value, layerName, op);
      }
    }
  }

  if (Array.isArray(fixed.layers)) {
    const layers = fixed.layers as LottieData[];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const layerName = (layer.nm as string) || `layer ${i}`;

      // Auto-fix: missing ind
      if (layer.ind === undefined || layer.ind === null) {
        layer.ind = i;
        fixesApplied.push(`Auto-assigned index ${i} to "${layerName}"`);
      }

      // Auto-fix: missing ip/op
      if (layer.ip === undefined || layer.ip === null) {
        layer.ip = rootIp;
        fixesApplied.push(`Set missing ip=${rootIp} on "${layerName}"`);
      }
      if (layer.op === undefined || layer.op === null) {
        layer.op = rootOp;
        fixesApplied.push(`Set missing op=${rootOp} on "${layerName}"`);
      }

      // Auto-fix: clamp ip/op to root range
      if (typeof layer.ip === "number" && layer.ip < rootIp) {
        layer.ip = rootIp;
        fixesApplied.push(`Clamped ip to ${rootIp} on "${layerName}"`);
      }
      if (typeof layer.op === "number" && layer.op > rootOp) {
        layer.op = rootOp;
        fixesApplied.push(`Clamped op to ${rootOp} on "${layerName}"`);
      }

      // Auto-fix: missing ks (transform)
      if (!layer.ks) {
        layer.ks = {
          p: { a: 0, k: [rootW / 2, rootH / 2] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
          a: { a: 0, k: [0, 0] },
        };
        fixesApplied.push(`Added default transform to "${layerName}"`);
      }

      // Fix colors in shapes
      if (Array.isArray(layer.shapes)) {
        walkShapes(layer.shapes as LottieData[], layerName);
      }

      // Fix colors in text layers (fc/sc in document data)
      if (layer.t && typeof layer.t === "object") {
        const textData = layer.t as LottieData;
        if (textData.d && typeof textData.d === "object") {
          const d = textData.d as LottieData;
          if (Array.isArray(d.k)) {
            for (const textKf of d.k as LottieData[]) {
              const s = textKf.s as LottieData | undefined;
              if (s) {
                if (s.fc && Array.isArray(s.fc)) {
                  const fc = s.fc as number[];
                  if (fc.slice(0, 3).some((v) => v > 1)) {
                    for (let j = 0; j < 3 && j < fc.length; j++) {
                      fc[j] = fc[j] / 255;
                    }
                    fixesApplied.push(`Normalized text fill color in "${layerName}"`);
                  }
                }
                if (s.sc && Array.isArray(s.sc)) {
                  const sc = s.sc as number[];
                  if (sc.slice(0, 3).some((v) => v > 1)) {
                    for (let j = 0; j < 3 && j < sc.length; j++) {
                      sc[j] = sc[j] / 255;
                    }
                    fixesApplied.push(`Normalized text stroke color in "${layerName}"`);
                  }
                }
              }
            }
          }
        }
      }

      // Warn: keyframes outside range
      const layerOp = (layer.op as number) ?? rootOp;
      walkAnimatedProps(layer, layerName, layerOp);
    }
  }

  return { fixed, warnings, fixesApplied };
}

export function optimizeLottie(data: unknown): { optimized: LottieData; stats: OptimizeStats } {
  const input = data as LottieData;
  const originalSize = JSON.stringify(input).length;
  const originalLayerCount = Array.isArray(input.layers) ? (input.layers as unknown[]).length : 0;
  const originalKeyframeCount = countKeyframes(input);
  const originalGroupCount = countGroups(input);

  let result = removeHiddenLayers(input);
  result = removeEmptyGroups(result);
  result = removeRedundantKeyframes(result);
  result = collapseSingleItemGroups(result);
  result = roundDecimals(result) as LottieData;

  const optimizedLayerCount = Array.isArray(result.layers) ? (result.layers as unknown[]).length : 0;
  const optimizedKeyframeCount = countKeyframes(result);
  const optimizedGroupCount = countGroups(result);

  return {
    optimized: result,
    stats: {
      originalSize,
      optimizedSize: JSON.stringify(result).length,
      layersRemoved: originalLayerCount - optimizedLayerCount,
      keyframesRemoved: originalKeyframeCount - optimizedKeyframeCount,
      groupsSimplified: originalGroupCount - optimizedGroupCount,
    },
  };
}
