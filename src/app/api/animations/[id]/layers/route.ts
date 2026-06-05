import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const MAX_DEPTH = 5;

// Lottie layer type codes
const LAYER_TYPES: Record<number, string> = {
  0: "precomp",
  1: "solid",
  2: "image",
  3: "null",
  4: "shape",
  5: "text",
  6: "audio",
  13: "camera",
};

// Lottie shape type codes
const SHAPE_TYPES: Record<string, string> = {
  gr: "group",
  sh: "path",
  fl: "fill",
  st: "stroke",
  rc: "rect",
  el: "ellipse",
  sr: "star",
  tr: "transform",
  tm: "trim",
  rd: "round-corners",
  gs: "gradient-stroke",
  gf: "gradient-fill",
  mm: "merge",
  rp: "repeater",
};

interface TransformSummary {
  position?: unknown;
  scale?: unknown;
  rotation?: unknown;
  opacity?: unknown;
  anchorPoint?: unknown;
}

interface ShapeSummary {
  name: string;
  type: string;
  path: string;
  fillColor?: unknown;
  strokeColor?: unknown;
  strokeWidth?: unknown;
  size?: unknown;
  roundness?: unknown;
  children?: ShapeSummary[];
}

interface LayerSummary {
  name: string;
  type: string;
  index: number;
  transform: TransformSummary;
  shapes?: ShapeSummary[];
  layerPath: string;
}

function extractValue(prop: unknown): unknown {
  if (prop == null) return undefined;
  if (typeof prop !== "object") return prop;
  const p = prop as Record<string, unknown>;
  // Animated property: a=1 means animated, use initial keyframe value
  if (p.a === 1 && Array.isArray(p.k)) {
    const first = p.k[0];
    if (first && typeof first === "object" && "s" in (first as Record<string, unknown>)) {
      return (first as Record<string, unknown>).s;
    }
    return p.k;
  }
  // Static property
  if ("k" in p) return p.k;
  return prop;
}

function formatColor(value: unknown): string | unknown {
  if (Array.isArray(value) && value.length >= 3) {
    const [r, g, b] = value.map((v: number) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0")
    );
    return `#${r}${g}${b}`;
  }
  return value;
}

function summarizeTransform(ks: Record<string, unknown> | undefined): TransformSummary {
  if (!ks) return {};
  return {
    position: extractValue(ks.p),
    scale: extractValue(ks.s),
    rotation: extractValue(ks.r),
    opacity: extractValue(ks.o),
    anchorPoint: extractValue(ks.a),
  };
}

function summarizeShapes(
  items: Record<string, unknown>[],
  parentPath: string,
  depth: number
): ShapeSummary[] {
  if (depth > MAX_DEPTH) return [];
  const result: ShapeSummary[] = [];

  for (const item of items) {
    const ty = item.ty as string;
    const name = (item.nm as string) || ty;
    const typeName = SHAPE_TYPES[ty] || ty;
    const shapePath = parentPath ? `${parentPath} > ${name}` : name;

    const summary: ShapeSummary = {
      name,
      type: typeName,
      path: shapePath,
    };

    if (ty === "fl" || ty === "gf") {
      summary.fillColor = formatColor(extractValue(item.c));
    }
    if (ty === "st" || ty === "gs") {
      summary.strokeColor = formatColor(extractValue(item.c));
      summary.strokeWidth = extractValue(item.w);
    }
    if (ty === "rc") {
      summary.size = extractValue(item.s);
      summary.roundness = extractValue(item.r);
    }
    if (ty === "el") {
      summary.size = extractValue(item.s);
    }
    if (ty === "sr") {
      // Star/polygon
      summary.size = extractValue(item.or);
    }

    // Group: recurse into items
    if (ty === "gr" && Array.isArray(item.it)) {
      summary.children = summarizeShapes(
        item.it as Record<string, unknown>[],
        shapePath,
        depth + 1
      );
    }

    result.push(summary);
  }

  return result;
}

function summarizeLayers(data: Record<string, unknown>): LayerSummary[] {
  const layers = data.layers as Record<string, unknown>[];
  if (!Array.isArray(layers)) return [];

  return layers.map((layer, idx) => {
    const ty = layer.ty as number;
    const summary: LayerSummary = {
      name: (layer.nm as string) || `Layer ${idx}`,
      type: LAYER_TYPES[ty] || `unknown(${ty})`,
      index: (layer.ind as number) ?? idx,
      transform: summarizeTransform(layer.ks as Record<string, unknown> | undefined),
      layerPath: `layers[${idx}]`,
    };

    // Shape layers have shapes array
    if (ty === 4 && Array.isArray(layer.shapes)) {
      summary.shapes = summarizeShapes(
        layer.shapes as Record<string, unknown>[],
        "",
        0
      );
    }

    return summary;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id);

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Animation file not found" }, { status: 404 });
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const summary = {
    id,
    name: (row as Record<string, unknown>).name,
    canvas: { width: data.w, height: data.h },
    frameRate: data.fr,
    totalFrames: data.op - (data.ip || 0),
    layers: summarizeLayers(data),
  };

  return Response.json(summary);
}
