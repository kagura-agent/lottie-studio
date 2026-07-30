export interface RepeatCommandOptions {
  pattern: "grid" | "circle" | "line";
  count?: number;
  cols?: number;
  rows?: number;
  gap?: number;
  radius?: number;
  spacing?: number;
  direction?: "horizontal" | "vertical";
  stagger?: number;
}

export const VALID_REPEAT_PATTERNS = ["grid", "circle", "line"] as const;
export type RepeatPattern = (typeof VALID_REPEAT_PATTERNS)[number];

export interface LottieLayer {
  ind?: number;
  nm?: string;
  ty?: number;
  ip?: number;
  op?: number;
  ks?: {
    p?: { a?: number; k?: number[] | { t: number; s: number[] }[] };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function duplicateLayer(layer: LottieLayer, count: number, startInd: number): LottieLayer[] {
  const layers: LottieLayer[] = [];
  for (let i = 0; i < count; i++) {
    const clone: LottieLayer = JSON.parse(JSON.stringify(layer));
    clone.ind = startInd + i;
    clone.nm = `${layer.nm || "Layer"} ${i + 1}`;
    layers.push(clone);
  }
  return layers;
}

export function positionGrid(
  layers: LottieLayer[],
  cols: number,
  rows: number,
  gap: number,
  canvasW: number,
  canvasH: number
): LottieLayer[] {
  const totalW = (cols - 1) * gap;
  const totalH = (rows - 1) * gap;
  const startX = (canvasW - totalW) / 2;
  const startY = (canvasH - totalH) / 2;

  for (let i = 0; i < layers.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * gap;
    const y = startY + row * gap;
    setLayerPosition(layers[i], x, y);
  }
  return layers;
}

export function positionCircle(
  layers: LottieLayer[],
  radius: number,
  centerX: number,
  centerY: number
): LottieLayer[] {
  const count = layers.length;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    setLayerPosition(layers[i], x, y);
  }
  return layers;
}

export function positionLine(
  layers: LottieLayer[],
  spacing: number,
  direction: "horizontal" | "vertical",
  startX: number,
  startY: number
): LottieLayer[] {
  for (let i = 0; i < layers.length; i++) {
    if (direction === "horizontal") {
      setLayerPosition(layers[i], startX + i * spacing, startY);
    } else {
      setLayerPosition(layers[i], startX, startY + i * spacing);
    }
  }
  return layers;
}

export function applyStagger(layers: LottieLayer[], staggerMs: number, frameRate: number): LottieLayer[] {
  const staggerFrames = (staggerMs / 1000) * frameRate;
  for (let i = 0; i < layers.length; i++) {
    const offset = i * staggerFrames;
    if (layers[i].ip != null) layers[i].ip = (layers[i].ip as number) + offset;
    if (layers[i].op != null) layers[i].op = (layers[i].op as number) + offset;
  }
  return layers;
}

function setLayerPosition(layer: LottieLayer, x: number, y: number): void {
  if (!layer.ks) layer.ks = {};
  layer.ks.p = { a: 0, k: [x, y, 0] };
}

export function repeatPattern(
  sourceLayer: LottieLayer,
  pattern: RepeatPattern,
  options: RepeatCommandOptions & { canvasW?: number; canvasH?: number; frameRate?: number; maxInd?: number }
): LottieLayer[] {
  const canvasW = options.canvasW ?? 512;
  const canvasH = options.canvasH ?? 512;
  const frameRate = options.frameRate ?? 30;
  const startInd = (options.maxInd ?? 0) + 1;

  let count: number;
  if (pattern === "grid") {
    const cols = options.cols ?? 3;
    const rows = options.rows ?? 3;
    count = cols * rows;
  } else {
    count = options.count ?? 6;
  }

  const layers = duplicateLayer(sourceLayer, count, startInd);

  switch (pattern) {
    case "grid": {
      const cols = options.cols ?? 3;
      const rows = options.rows ?? 3;
      const gap = options.gap ?? 80;
      positionGrid(layers, cols, rows, gap, canvasW, canvasH);
      break;
    }
    case "circle": {
      const radius = options.radius ?? 150;
      positionCircle(layers, radius, canvasW / 2, canvasH / 2);
      break;
    }
    case "line": {
      const spacing = options.spacing ?? 60;
      const direction = options.direction ?? "horizontal";
      const totalLen = (count - 1) * spacing;
      let startX: number, startY: number;
      if (direction === "horizontal") {
        startX = (canvasW - totalLen) / 2;
        startY = canvasH / 2;
      } else {
        startX = canvasW / 2;
        startY = (canvasH - totalLen) / 2;
      }
      positionLine(layers, spacing, direction, startX, startY);
      break;
    }
  }

  if (options.stagger) {
    applyStagger(layers, options.stagger, frameRate);
  }

  return layers;
}
