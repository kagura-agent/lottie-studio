export type MorphShape =
  | "circle"
  | "star"
  | "rect"
  | "rectangle"
  | "triangle"
  | "heart"
  | "diamond"
  | "hexagon"
  | "pentagon";

export const VALID_MORPH_SHAPES: MorphShape[] = [
  "circle",
  "star",
  "rect",
  "rectangle",
  "triangle",
  "heart",
  "diamond",
  "hexagon",
  "pentagon",
];

export interface MorphOptions {
  duration?: number;
  easing?: string;
  layer?: string | number;
}

interface Vertex {
  x: number;
  y: number;
  ix: number;
  iy: number;
  ox: number;
  oy: number;
}

interface ShapeData {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
}

const KAPPA = 0.5522847498;

function generateShapeVertices(shape: MorphShape, cx: number, cy: number, r: number): Vertex[] {
  const normalized = shape === "rectangle" ? "rect" : shape;

  switch (normalized) {
    case "circle":
      return generateCircle(cx, cy, r);
    case "star":
      return generateStar(cx, cy, r);
    case "rect":
      return generateRect(cx, cy, r);
    case "triangle":
      return generatePolygon(cx, cy, r, 3, -Math.PI / 2);
    case "diamond":
      return generatePolygon(cx, cy, r, 4, -Math.PI / 2);
    case "hexagon":
      return generatePolygon(cx, cy, r, 6, -Math.PI / 2);
    case "pentagon":
      return generatePolygon(cx, cy, r, 5, -Math.PI / 2);
    case "heart":
      return generateHeart(cx, cy, r);
    default:
      return generateCircle(cx, cy, r);
  }
}

function generateCircle(cx: number, cy: number, r: number): Vertex[] {
  const k = r * KAPPA;
  return [
    { x: cx, y: cy - r, ix: -k, iy: 0, ox: k, oy: 0 },
    { x: cx + r, y: cy, ix: 0, iy: -k, ox: 0, oy: k },
    { x: cx, y: cy + r, ix: k, iy: 0, ox: -k, oy: 0 },
    { x: cx - r, y: cy, ix: 0, iy: k, ox: 0, oy: -k },
  ];
}

function generateRect(cx: number, cy: number, r: number): Vertex[] {
  const s = r * 0.9;
  return [
    { x: cx - s, y: cy - s, ix: 0, iy: 0, ox: 0, oy: 0 },
    { x: cx + s, y: cy - s, ix: 0, iy: 0, ox: 0, oy: 0 },
    { x: cx + s, y: cy + s, ix: 0, iy: 0, ox: 0, oy: 0 },
    { x: cx - s, y: cy + s, ix: 0, iy: 0, ox: 0, oy: 0 },
  ];
}

function generatePolygon(cx: number, cy: number, r: number, sides: number, startAngle: number): Vertex[] {
  const verts: Vertex[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (2 * Math.PI * i) / sides;
    verts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      ix: 0, iy: 0, ox: 0, oy: 0,
    });
  }
  return verts;
}

function generateStar(cx: number, cy: number, r: number): Vertex[] {
  const verts: Vertex[] = [];
  const innerR = r * 0.4;
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5;
    const rad = i % 2 === 0 ? r : innerR;
    verts.push({
      x: cx + rad * Math.cos(angle),
      y: cy + rad * Math.sin(angle),
      ix: 0, iy: 0, ox: 0, oy: 0,
    });
  }
  return verts;
}

function generateHeart(cx: number, cy: number, r: number): Vertex[] {
  const s = r * 0.6;
  const k = s * KAPPA;
  return [
    { x: cx, y: cy - s * 0.4, ix: 0, iy: 0, ox: 0, oy: 0 },
    { x: cx + s * 0.5, y: cy - s * 1.2, ix: -k * 0.3, iy: 0, ox: k * 0.3, oy: 0 },
    { x: cx + s * 1.3, y: cy - s * 0.8, ix: 0, iy: -k * 0.6, ox: 0, oy: k * 0.6 },
    { x: cx + s * 1.0, y: cy + s * 0.2, ix: k * 0.2, iy: -k * 0.3, ox: -k * 0.2, oy: k * 0.3 },
    { x: cx + s * 0.5, y: cy + s * 0.8, ix: k * 0.2, iy: -k * 0.2, ox: -k * 0.2, oy: k * 0.2 },
    { x: cx, y: cy + s * 1.4, ix: k * 0.2, iy: -k * 0.2, ox: -k * 0.2, oy: k * 0.2 },
    { x: cx - s * 0.5, y: cy + s * 0.8, ix: k * 0.2, iy: k * 0.2, ox: -k * 0.2, oy: -k * 0.2 },
    { x: cx - s * 1.0, y: cy + s * 0.2, ix: 0, iy: k * 0.3, ox: 0, oy: -k * 0.3 },
    { x: cx - s * 1.3, y: cy - s * 0.8, ix: 0, iy: k * 0.6, ox: 0, oy: -k * 0.6 },
    { x: cx - s * 0.5, y: cy - s * 1.2, ix: -k * 0.3, iy: 0, ox: k * 0.3, oy: 0 },
  ];
}

function verticesToShapeData(verts: Vertex[]): ShapeData {
  return {
    v: verts.map((v) => [v.x, v.y]),
    i: verts.map((v) => [v.ix, v.iy]),
    o: verts.map((v) => [v.ox, v.oy]),
    c: true,
  };
}

function matchVertexCount(source: ShapeData, target: ShapeData): { source: ShapeData; target: ShapeData } {
  const sLen = source.v.length;
  const tLen = target.v.length;

  if (sLen === tLen) return { source, target };

  if (sLen < tLen) {
    return { source: subdivideToCount(source, tLen), target };
  }
  return { source, target: subdivideToCount(target, sLen) };
}

function subdivideToCount(shape: ShapeData, targetCount: number): ShapeData {
  const current = shape.v.length;
  if (current >= targetCount) return shape;

  const result: ShapeData = {
    v: [...shape.v.map((p) => [...p])],
    i: [...shape.i.map((p) => [...p])],
    o: [...shape.o.map((p) => [...p])],
    c: shape.c,
  };

  while (result.v.length < targetCount) {
    let longestIdx = 0;
    let longestDist = 0;
    for (let i = 0; i < result.v.length; i++) {
      const next = (i + 1) % result.v.length;
      const dx = result.v[next][0] - result.v[i][0];
      const dy = result.v[next][1] - result.v[i][1];
      const dist = dx * dx + dy * dy;
      if (dist > longestDist) {
        longestDist = dist;
        longestIdx = i;
      }
    }

    const nextIdx = (longestIdx + 1) % result.v.length;
    const midX = (result.v[longestIdx][0] + result.v[nextIdx][0]) / 2;
    const midY = (result.v[longestIdx][1] + result.v[nextIdx][1]) / 2;

    const insertAt = longestIdx + 1;
    result.v.splice(insertAt, 0, [midX, midY]);
    result.i.splice(insertAt, 0, [0, 0]);
    result.o.splice(insertAt, 0, [0, 0]);
  }

  return result;
}

function getEasingValues(easing?: string): { ix: number; iy: number; ox: number; oy: number } {
  switch (easing) {
    case "ease-in":
      return { ix: 0.42, iy: 0, ox: 1, oy: 1 };
    case "ease-out":
      return { ix: 0, iy: 0, ox: 0.58, oy: 1 };
    case "ease-in-out":
      return { ix: 0.42, iy: 0, ox: 0.58, oy: 1 };
    case "bounce":
      return { ix: 0.6, iy: 1.5, ox: 0.4, oy: 0.8 };
    case "elastic":
      return { ix: 0.5, iy: 1.4, ox: 0.3, oy: 0.8 };
    case "spring":
      return { ix: 0.4, iy: 1.2, ox: 0.3, oy: 0.9 };
    case "sharp":
      return { ix: 0.4, iy: 0, ox: 0.6, oy: 1 };
    default:
      return { ix: 0.33, iy: 0, ox: 0.67, oy: 1 };
  }
}

function extractShapeCenter(shapeData: ShapeData): { cx: number; cy: number; r: number } {
  if (shapeData.v.length === 0) return { cx: 0, cy: 0, r: 50 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of shapeData.v) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const r = Math.max((maxX - minX) / 2, (maxY - minY) / 2) || 50;
  return { cx, cy, r };
}

function findPathShapes(layer: Record<string, unknown>): { path: string[]; shape: Record<string, unknown> }[] {
  const results: { path: string[]; shape: Record<string, unknown> }[] = [];

  function walk(items: Record<string, unknown>[], currentPath: string[]) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.ty === "sh" && item.ks) {
        results.push({ path: [...currentPath, String(i)], shape: item });
      }
      if (item.ty === "gr" && Array.isArray(item.it)) {
        walk(item.it as Record<string, unknown>[], [...currentPath, String(i), "it"]);
      }
    }
  }

  if (Array.isArray(layer.shapes)) {
    walk(layer.shapes as Record<string, unknown>[], ["shapes"]);
  }
  return results;
}

export function morphAnimation(
  lottieJson: object,
  targetShape: MorphShape,
  options: MorphOptions = {}
): object {
  const { duration = 1, easing, layer: layerTarget } = options;
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;

  if (!Array.isArray(json.layers)) {
    throw new Error("No layers found in animation");
  }

  const fr = (json.fr as number) || 30;
  const durationFrames = Math.round(duration * fr);
  const startFrame = (json.ip as number) || 0;
  const endFrame = startFrame + durationFrames;

  const layers = json.layers as Record<string, unknown>[];
  let targetLayers: Record<string, unknown>[];

  if (layerTarget !== undefined) {
    if (typeof layerTarget === "number") {
      if (layerTarget < 0 || layerTarget >= layers.length) {
        throw new Error(`Layer index ${layerTarget} out of range`);
      }
      targetLayers = [layers[layerTarget]];
    } else {
      const found = layers.filter(
        (l) => (l.nm as string)?.toLowerCase() === layerTarget.toLowerCase()
      );
      if (found.length === 0) {
        throw new Error(`Layer "${layerTarget}" not found`);
      }
      targetLayers = found;
    }
  } else {
    targetLayers = layers;
  }

  let morphed = false;

  for (const layer of targetLayers) {
    const pathShapes = findPathShapes(layer);
    if (pathShapes.length === 0) continue;

    for (const { shape } of pathShapes) {
      const ks = shape.ks as Record<string, unknown>;
      if (!ks) continue;

      let sourceData: ShapeData;

      if ((ks.a as number) === 1 && Array.isArray(ks.k)) {
        const keyframes = ks.k as Record<string, unknown>[];
        const lastKf = keyframes[keyframes.length - 1];
        const sData = (lastKf.e ?? lastKf.s) as ShapeData | ShapeData[] | undefined;
        if (!sData) continue;
        if (!Array.isArray(sData) || (sData as unknown as ShapeData).v) {
          sourceData = sData as unknown as ShapeData;
        } else if (Array.isArray(sData)) {
          sourceData = (sData as ShapeData[])[0];
        } else {
          sourceData = sData as ShapeData;
        }
      } else if ((ks.a as number) === 0 && ks.k && typeof ks.k === "object") {
        sourceData = ks.k as ShapeData;
      } else {
        continue;
      }

      if (!sourceData.v || sourceData.v.length === 0) continue;

      const { cx, cy, r } = extractShapeCenter(sourceData);
      const targetVerts = generateShapeVertices(targetShape, cx, cy, r);
      const targetData = verticesToShapeData(targetVerts);

      const matched = matchVertexCount(sourceData, targetData);
      const easingVals = getEasingValues(easing);

      shape.ks = {
        a: 1,
        k: [
          {
            t: startFrame,
            s: [matched.source],
            e: [matched.target],
            i: { x: [easingVals.ix], y: [easingVals.iy] },
            o: { x: [easingVals.ox], y: [easingVals.oy] },
          },
          {
            t: endFrame,
            s: [matched.target],
          },
        ],
      };

      morphed = true;
    }
  }

  if (!morphed) {
    throw new Error("No path data found in the animation to morph");
  }

  if (endFrame > (json.op as number)) {
    json.op = endFrame;
  }

  return json;
}
