import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
  animationExists,
  readAnimationFile,
  writeAnimationFile,
  saveUserMessage,
  saveAssistantMessage,
} from "./helpers";
import type { ColorSubcommand } from "@/lib/commands";
import {
  type LottieColor,
  hueShift,
  saturate,
  brighten,
  invert,
  monochrome,
  hexToLottie,
  lottieToHex,
  colorsEqual,
} from "@/lib/color-utils";

interface ColorStats {
  colorsModified: number;
  layersAffected: Set<string>;
}

type ColorTransformFn = (color: LottieColor) => LottieColor;

/**
 * Extract a valid LottieColor from a k array value.
 * Returns null if the value doesn't look like a color.
 */
function extractColor(k: unknown): LottieColor | null {
  if (!Array.isArray(k) || k.length < 3) return null;
  const [r, g, b] = k;
  if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") return null;
  const a = k.length >= 4 && typeof k[3] === "number" ? k[3] : 1;
  return [r, g, b, a];
}

/**
 * Check if two color arrays differ
 */
function colorChanged(a: LottieColor, b: LottieColor): boolean {
  return (
    Math.abs(a[0] - b[0]) > 1e-10 ||
    Math.abs(a[1] - b[1]) > 1e-10 ||
    Math.abs(a[2] - b[2]) > 1e-10 ||
    Math.abs(a[3] - b[3]) > 1e-10
  );
}

/**
 * Apply a color transform to a color property value (static or animated)
 */
function transformColorProperty(
  prop: Record<string, unknown>,
  transform: ColorTransformFn,
  stats: ColorStats,
  layerName: string
): void {
  if (prop.a === 0) {
    // Static color
    const color = extractColor(prop.k);
    if (color) {
      const result = transform(color);
      if (colorChanged(color, result)) {
        prop.k = result.length === 4 ? result : [...result];
        stats.colorsModified++;
        stats.layersAffected.add(layerName);
      }
    }
  } else if (prop.a === 1 && Array.isArray(prop.k)) {
    // Animated color (keyframes)
    for (const kf of prop.k as Record<string, unknown>[]) {
      if (kf.s) {
        const sColor = extractColor(kf.s);
        if (sColor) {
          const result = transform(sColor);
          if (colorChanged(sColor, result)) {
            kf.s = result.length === 4 ? result : [...result];
            stats.colorsModified++;
            stats.layersAffected.add(layerName);
          }
        }
      }
      if (kf.e) {
        const eColor = extractColor(kf.e);
        if (eColor) {
          const result = transform(eColor);
          if (colorChanged(eColor, result)) {
            kf.e = result.length === 4 ? result : [...result];
            stats.colorsModified++;
            stats.layersAffected.add(layerName);
          }
        }
      }
    }
  }
}

/**
 * Collect colors from a color property (static or animated)
 */
function collectColorsFromProperty(prop: Record<string, unknown>, colors: Set<string>): void {
  if (prop.a === 0) {
    const color = extractColor(prop.k);
    if (color) {
      colors.add(lottieToHex(color));
    }
  } else if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const kf of prop.k as Record<string, unknown>[]) {
      if (kf.s) {
        const sColor = extractColor(kf.s);
        if (sColor) colors.add(lottieToHex(sColor));
      }
      if (kf.e) {
        const eColor = extractColor(kf.e);
        if (eColor) colors.add(lottieToHex(eColor));
      }
    }
  }
}

/**
 * Walk shapes recursively, applying a visitor to fill/stroke color properties
 */
function walkShapes(
  shapes: Record<string, unknown>[],
  visitor: (colorProp: Record<string, unknown>) => void
): void {
  for (const shape of shapes) {
    const ty = shape.ty;
    // Fill
    if (ty === "fl" && shape.c && typeof shape.c === "object") {
      visitor(shape.c as Record<string, unknown>);
    }
    // Stroke
    if (ty === "st" && shape.c && typeof shape.c === "object") {
      visitor(shape.c as Record<string, unknown>);
    }
    // Gradient fill (gf) and gradient stroke (gs) - handle stops
    if ((ty === "gf" || ty === "gs") && shape.g && typeof shape.g === "object") {
      const g = shape.g as Record<string, unknown>;
      if (g.k && typeof g.k === "object") {
        // Gradient stops are more complex, skip for now
      }
    }
    // Group - recurse
    if (ty === "gr" && Array.isArray(shape.it)) {
      walkShapes(shape.it as Record<string, unknown>[], visitor);
    }
  }
}

/**
 * Walk all layers recursively (including precomps)
 */
function walkLayers(
  layers: Record<string, unknown>[],
  assets: Record<string, unknown>[] | undefined,
  visitor: (shapes: Record<string, unknown>[], layerName: string) => void
): void {
  for (const layer of layers) {
    const layerName = (layer.nm as string) || `Layer ${layer.ind ?? "?"}`;

    // Shape layer (ty: 4)
    if (Array.isArray(layer.shapes)) {
      visitor(layer.shapes as Record<string, unknown>[], layerName);
    }

    // Precomp layer (ty: 0) - recurse into referenced asset
    if (layer.ty === 0 && layer.refId && Array.isArray(assets)) {
      const asset = assets.find(
        (a) => (a as Record<string, unknown>).id === layer.refId
      ) as Record<string, unknown> | undefined;
      if (asset && Array.isArray(asset.layers)) {
        walkLayers(
          asset.layers as Record<string, unknown>[],
          assets,
          visitor
        );
      }
    }
  }
}

export async function handleColor(
  animationId: string | undefined,
  subcommand: ColorSubcommand,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can use color commands." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId) as Record<string, unknown> | null;
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const layers = (animJson.layers as Record<string, unknown>[]) || [];
  const assets = animJson.assets as Record<string, unknown>[] | undefined;

  // Handle palette subcommand (read-only)
  if (subcommand.action === "palette") {
    const colors = new Set<string>();
    walkLayers(layers, assets, (shapes) => {
      walkShapes(shapes, (colorProp) => {
        collectColorsFromProperty(colorProp, colors);
      });
    });

    if (colors.size === 0) {
      return sendDoneEvent({ reply: "No colors found in this animation." });
    }

    const colorList = Array.from(colors).sort();
    const reply = `Found ${colorList.length} unique color${colorList.length === 1 ? "" : "s"}:\n${colorList.map((c) => `• ${c}`).join("\n")}`;
    return sendDoneEvent({ reply });
  }

  // Build transform function based on subcommand
  let transform: ColorTransformFn;
  let description: string;

  switch (subcommand.action) {
    case "shift":
      transform = (c) => hueShift(c, subcommand.degrees);
      description = `Shifted hues by ${subcommand.degrees}°`;
      break;
    case "warm":
      transform = (c) => hueShift(c, 15);
      description = "Applied warm tone (+15° hue shift)";
      break;
    case "cool":
      transform = (c) => hueShift(c, -15);
      description = "Applied cool tone (-15° hue shift)";
      break;
    case "mono":
      transform = (c) => monochrome(c);
      description = "Converted to monochrome";
      break;
    case "invert":
      transform = (c) => invert(c);
      description = "Inverted all colors";
      break;
    case "saturate":
      transform = (c) => saturate(c, subcommand.amount);
      description = `Adjusted saturation by ${subcommand.amount > 0 ? "+" : ""}${Math.round(subcommand.amount * 100)}%`;
      break;
    case "brighten":
      transform = (c) => brighten(c, subcommand.amount);
      description = `Adjusted brightness by ${subcommand.amount > 0 ? "+" : ""}${Math.round(subcommand.amount * 100)}%`;
      break;
    case "swap": {
      const fromColor = hexToLottie(subcommand.from);
      const toColor = hexToLottie(subcommand.to);
      if (!fromColor) {
        return sendDoneEvent({ reply: `Invalid source color: "${subcommand.from}". Use hex format like #ff0000.` });
      }
      if (!toColor) {
        return sendDoneEvent({ reply: `Invalid target color: "${subcommand.to}". Use hex format like #00ff00.` });
      }
      transform = (c) => (colorsEqual(c, fromColor) ? toColor : c);
      description = `Swapped ${subcommand.from} → ${subcommand.to}`;
      break;
    }
    default:
      return sendDoneEvent({ reply: "Unknown color subcommand." });
  }

  // Apply transform
  const stats: ColorStats = { colorsModified: 0, layersAffected: new Set() };
  const previousJson = JSON.stringify(animJson);

  walkLayers(layers, assets, (shapes, layerName) => {
    walkShapes(shapes, (colorProp) => {
      transformColorProperty(colorProp, transform, stats, layerName);
    });
  });

  if (stats.colorsModified === 0) {
    return sendDoneEvent({ reply: "No colors found to transform in this animation." });
  }

  // Save changes
  writeAnimationFile(animationId, animJson);
  updateAnimationMetadata(animationId, animJson);

  const lottieStr = JSON.stringify(animJson);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const reply = `${description}. Modified ${stats.colorsModified} color value${stats.colorsModified === 1 ? "" : "s"} across ${stats.layersAffected.size} layer${stats.layersAffected.size === 1 ? "" : "s"}.`;
  saveAssistantMessage(animationId, reply, lottieStr, previousJson);

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animJson,
    animationId,
    previousLottieJson: JSON.parse(previousJson),
  });
}
