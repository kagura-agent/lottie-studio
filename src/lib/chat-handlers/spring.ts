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
  generateSpringKeyframes,
  resolveSpringOptions,
  SpringCommandOptions,
  SpringProperty,
} from "@/lib/spring";

/** Lottie property key to human-readable name */
const PROPERTY_NAMES: Record<string, string> = {
  p: "position",
  s: "scale",
  r: "rotation",
  o: "opacity",
};

/** Map from spring property filter to Lottie ks key */
const PROPERTY_TO_KEY: Record<SpringProperty, string> = {
  position: "p",
  scale: "s",
  rotation: "r",
  opacity: "o",
};

interface LottieKeyframe {
  t: number;
  s?: number[];
  e?: number[];
  [key: string]: unknown;
}

interface AnimatedProperty {
  a: number;
  k: LottieKeyframe[] | number | number[];
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

/**
 * Apply spring physics interpolation to keyframed properties in the animation.
 */
export async function handleSpring(
  animationId: string | undefined,
  options: SpringCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply spring physics." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;
  const springOpts = resolveSpringOptions(options);
  const fps = animation.fr || 30;

  // Determine which property keys to process
  const targetKeys: string[] = options.property
    ? [PROPERTY_TO_KEY[options.property]]
    : Object.keys(PROPERTY_TO_KEY).map((k) => PROPERTY_TO_KEY[k as SpringProperty]);

  let modifiedCount = 0;
  const modifiedLayers: string[] = [];

  for (const layer of animation.layers) {
    // Filter by layer name if specified
    if (options.layer && layer.nm !== options.layer) {
      continue;
    }

    if (!layer.ks) continue;

    for (const key of targetKeys) {
      const prop = layer.ks[key] as AnimatedProperty | undefined;
      if (!prop || prop.a !== 1 || !Array.isArray(prop.k) || prop.k.length < 2) {
        continue;
      }

      const keyframes = prop.k as LottieKeyframe[];
      const lastIdx = keyframes.length - 1;
      const secondLastIdx = lastIdx - 1;

      // Get start and end values from the last two keyframes
      const startKf = keyframes[secondLastIdx];
      const endKf = keyframes[lastIdx];

      // Determine start/end values
      // In Lottie format, keyframe.s = start value at this keyframe,
      // keyframe.e = end value (interpolating to next keyframe)
      // For the last segment: startKf.s or startKf.e is the start, endKf.s is the end
      const startValue = startKf.e ?? startKf.s;
      const endValue = endKf.s;

      if (!startValue || !endValue) continue;

      // For single-value properties (rotation, opacity), unwrap
      const isScalar = key === "r" || (key === "o" && startValue.length === 1);
      const sv = isScalar ? startValue[0] : startValue;
      const ev = isScalar ? endValue[0] : endValue;

      // Generate spring keyframes
      const springFrames = generateSpringKeyframes(sv, ev, springOpts, fps);

      if (springFrames.length < 2) continue;

      // Calculate time span between the two original keyframes
      const startTime = startKf.t;
      const endTime = endKf.t;
      const timeSpan = endTime - startTime;

      // Distribute spring frames across the time span
      const frameInterval = timeSpan / (springFrames.length - 1);

      // Build new keyframes for the spring section
      const newKeyframes: LottieKeyframe[] = [];

      // Keep all keyframes before the last two
      for (let i = 0; i < secondLastIdx; i++) {
        newKeyframes.push(keyframes[i]);
      }

      // Add spring-interpolated keyframes
      for (let i = 0; i < springFrames.length; i++) {
        const t = Math.round(startTime + i * frameInterval);
        const value = springFrames[i];
        const s = isScalar ? [value as number] : (value as number[]);

        const kf: LottieKeyframe = { t, s };

        // Add easing handles for all but the last frame
        if (i < springFrames.length - 1) {
          kf.o = { x: [0], y: [0] };
          kf.i = { x: [1], y: [1] };
        }

        newKeyframes.push(kf);
      }

      prop.k = newKeyframes;
      modifiedCount++;

      const layerName = layer.nm || "unnamed";
      if (!modifiedLayers.includes(layerName)) {
        modifiedLayers.push(layerName);
      }
    }
  }

  if (modifiedCount === 0) {
    return sendDoneEvent({
      reply: "No keyframed properties found to apply spring physics to. The animation needs layers with at least two keyframes on position, scale, rotation, or opacity.",
    });
  }

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);

  const lottieStr = JSON.stringify(animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const presetInfo = options.preset ? ` (preset: ${options.preset})` : "";
  const layerInfo = modifiedLayers.length <= 3
    ? modifiedLayers.map((n) => `"${n}"`).join(", ")
    : `${modifiedLayers.length} layers`;
  const propInfo = options.property ? ` on ${options.property}` : "";
  const reply = `Applied spring physics${presetInfo}${propInfo} to ${modifiedCount} propert${modifiedCount === 1 ? "y" : "ies"} across ${layerInfo}. (stiffness=${springOpts.stiffness}, damping=${springOpts.damping}, mass=${springOpts.mass})`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
