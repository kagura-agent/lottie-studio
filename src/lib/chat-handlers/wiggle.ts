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
import {
  generateWiggleKeyframes,
  resolveWiggleOptions,
  WiggleCommandOptions,
  WiggleProperty,
  VALID_WIGGLE_PROPERTIES,
} from "@/lib/wiggle";

const PROPERTY_TO_KEY: Record<WiggleProperty, string> = {
  position: "p",
  scale: "s",
  rotation: "r",
  opacity: "o",
};

interface AnimatedProperty {
  a: number;
  k: unknown;
}

interface LayerTransform {
  p?: AnimatedProperty;
  s?: AnimatedProperty;
  r?: AnimatedProperty;
  o?: AnimatedProperty;
  [key: string]: unknown;
}

interface LottieLayer {
  nm?: string;
  ks?: LayerTransform;
  ip?: number;
  op?: number;
  [key: string]: unknown;
}

interface LottieAnimation {
  fr: number;
  ip: number;
  op: number;
  layers: LottieLayer[];
  [key: string]: unknown;
}

export async function handleWiggle(
  animationId: string | undefined,
  options: WiggleCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply wiggle." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;
  const fps = animation.fr || 30;
  const startFrame = animation.ip ?? 0;
  const endFrame = animation.op ?? 60;

  const targetProperties: WiggleProperty[] = options.property
    ? [options.property]
    : [...VALID_WIGGLE_PROPERTIES];

  let modifiedCount = 0;
  const modifiedLayers: string[] = [];
  let seedOffset = 0;

  for (const layer of animation.layers) {
    if (options.layer && layer.nm !== options.layer) {
      continue;
    }

    if (!layer.ks) continue;

    const layerStart = layer.ip ?? startFrame;
    const layerEnd = layer.op ?? endFrame;

    for (const prop of targetProperties) {
      const key = PROPERTY_TO_KEY[prop];
      const existing = layer.ks[key] as AnimatedProperty | undefined;

      const baseValue = existing && !Array.isArray(existing.k) && typeof existing.k !== 'number'
        ? undefined
        : existing && Array.isArray(existing.k) && existing.k.length > 0 && typeof existing.k[0] === 'number'
          ? existing.k as unknown as number[]
          : existing && typeof existing.k === 'number'
            ? [existing.k]
            : undefined;

      const wiggleOpts = resolveWiggleOptions(
        { ...options, seed: (options.seed ?? 42) + seedOffset },
        prop
      );
      seedOffset++;

      const keyframes = generateWiggleKeyframes(
        prop,
        wiggleOpts,
        layerStart,
        layerEnd,
        fps,
        baseValue ?? undefined
      );

      if (!layer.ks[key]) {
        layer.ks[key] = { a: 1, k: keyframes };
      } else {
        (layer.ks[key] as AnimatedProperty).a = 1;
        (layer.ks[key] as AnimatedProperty).k = keyframes;
      }

      modifiedCount++;
      const layerName = layer.nm || "unnamed";
      if (!modifiedLayers.includes(layerName)) {
        modifiedLayers.push(layerName);
      }
    }
  }

  if (modifiedCount === 0) {
    return sendDoneEvent({
      reply: "No layers found to apply wiggle to. Make sure your animation has layers.",
    });
  }

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);

  const lottieStr = JSON.stringify(animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const layerInfo = modifiedLayers.length <= 3
    ? modifiedLayers.map((n) => `"${n}"`).join(", ")
    : `${modifiedLayers.length} layers`;
  const propInfo = options.property ? ` on ${options.property}` : "";
  const wiggleResolved = resolveWiggleOptions(options, options.property ?? "position");
  const reply = `Applied wiggle${propInfo} to ${modifiedCount} propert${modifiedCount === 1 ? "y" : "ies"} across ${layerInfo}. (freq=${wiggleResolved.freq}, amp=${wiggleResolved.amp}, smooth=${wiggleResolved.smooth})`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
