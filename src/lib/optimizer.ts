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
