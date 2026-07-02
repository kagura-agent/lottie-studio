/**
 * Pure functions for direct layer manipulation on Lottie animation data.
 * All functions return new objects (no mutation of inputs).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieAny = any;

/** Layer type codes used in Lottie format */
const LAYER_TYPE_NAMES: Record<number, string> = {
  0: "precomp",
  1: "solid",
  2: "image",
  3: "null",
  4: "shape",
  5: "text",
  6: "audio",
  7: "video placeholder",
  13: "camera",
};

export interface LayerInfo {
  /** Layer index (ind) */
  index: number;
  /** Layer name (nm) */
  name: string;
  /** Layer type code (ty) */
  type: number;
  /** Human-readable type name */
  typeName: string;
  /** In-point frame */
  inPoint: number;
  /** Out-point frame */
  outPoint: number;
  /** Whether the layer is hidden */
  hidden: boolean;
  /** Parent layer index, if any */
  parent?: number;
}

/**
 * List all layers with metadata.
 */
export function listLayers(animationData: object): LayerInfo[] {
  const data = animationData as LottieAny;
  const layers: LottieAny[] = data?.layers;
  if (!Array.isArray(layers)) return [];

  return layers.map((layer) => ({
    index: layer.ind ?? 0,
    name: layer.nm ?? "(unnamed)",
    type: layer.ty ?? -1,
    typeName: LAYER_TYPE_NAMES[layer.ty] ?? "unknown",
    inPoint: layer.ip ?? 0,
    outPoint: layer.op ?? 0,
    hidden: layer.hd === true,
    ...(typeof layer.parent === "number" ? { parent: layer.parent } : {}),
  }));
}

/**
 * Find the maximum layer index in the animation.
 */
function getMaxInd(layers: LottieAny[]): number {
  let max = 0;
  for (const layer of layers) {
    if (typeof layer.ind === "number" && layer.ind > max) {
      max = layer.ind;
    }
  }
  return max;
}

/**
 * Find a layer by name (case-insensitive).
 * Throws if not found.
 */
function findLayerByName(layers: LottieAny[], layerName: string): { layer: LottieAny; index: number } {
  const nameLower = layerName.toLowerCase();
  for (let i = 0; i < layers.length; i++) {
    const nm = layers[i].nm;
    if (typeof nm === "string" && nm.toLowerCase() === nameLower) {
      return { layer: layers[i], index: i };
    }
  }
  throw new Error(`Layer "${layerName}" not found`);
}

/**
 * Duplicate a layer by name (case-insensitive match).
 * Returns new animation data and the duplicated layer's name.
 *
 * The duplicated layer gets:
 * - A new unique `ind`
 * - " (copy)" appended to `nm`
 * - Position offset by [20, 20] if position is static
 */
export function duplicateLayer(
  animationData: object,
  layerName: string
): { animation: object; newLayerName: string } {
  const data: LottieAny = JSON.parse(JSON.stringify(animationData));
  const layers: LottieAny[] = data.layers;
  if (!Array.isArray(layers)) {
    throw new Error(`Layer "${layerName}" not found`);
  }

  const { layer, index } = findLayerByName(layers, layerName);

  // Deep clone the layer
  const cloned: LottieAny = JSON.parse(JSON.stringify(layer));

  // Assign new unique index
  cloned.ind = getMaxInd(layers) + 1;

  // Append " (copy)" to name
  const newName = `${cloned.nm ?? "(unnamed)"} (copy)`;
  cloned.nm = newName;

  // Offset position by [20, 20] if position is static (not animated)
  if (cloned.ks?.p) {
    const pos = cloned.ks.p;
    // Static position: a === 0 or a is undefined, and k is an array of numbers
    if ((!pos.a || pos.a === 0) && Array.isArray(pos.k) && typeof pos.k[0] === "number") {
      pos.k = [pos.k[0] + 20, pos.k[1] + 20, ...(pos.k.length > 2 ? [pos.k[2]] : [])];
    }
  }

  // Insert the cloned layer right after the original
  layers.splice(index + 1, 0, cloned);

  return { animation: data, newLayerName: newName };
}

/**
 * Delete a layer by name (case-insensitive match).
 * Also cleans up any `parent` references pointing to the deleted layer's `ind`.
 * Returns new animation data.
 */
export function deleteLayer(animationData: object, layerName: string): object {
  const data: LottieAny = JSON.parse(JSON.stringify(animationData));
  const layers: LottieAny[] = data.layers;
  if (!Array.isArray(layers)) {
    throw new Error(`Layer "${layerName}" not found`);
  }

  const { layer, index } = findLayerByName(layers, layerName);
  const deletedInd = layer.ind;

  // Remove the layer
  layers.splice(index, 1);

  // Clean up parent references pointing to the deleted layer
  if (typeof deletedInd === "number") {
    for (const remaining of layers) {
      if (remaining.parent === deletedInd) {
        delete remaining.parent;
      }
    }
  }

  return data;
}

/**
 * Rename a layer (case-insensitive match on oldName).
 * Returns new animation data.
 */
export function renameLayer(animationData: object, oldName: string, newName: string): object {
  const data: LottieAny = JSON.parse(JSON.stringify(animationData));
  const layers: LottieAny[] = data.layers;
  if (!Array.isArray(layers)) {
    throw new Error(`Layer "${oldName}" not found`);
  }

  const { layer } = findLayerByName(layers, oldName);
  layer.nm = newName;

  return data;
}
