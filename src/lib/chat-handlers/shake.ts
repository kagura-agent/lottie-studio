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
  generateShakeKeyframes,
  resolveShakeOptions,
  ShakeCommandOptions,
  ShakeAxis,
  ShakeOptions,
} from "@/lib/shake";

interface AnimatedProperty {
  a: number;
  k: unknown;
}

interface LayerTransform {
  p?: AnimatedProperty;
  r?: AnimatedProperty;
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

function getBaseValue(prop: AnimatedProperty | undefined, fallback: number[]): number[] {
  if (!prop) return fallback;
  if (typeof prop.k === "number") return [prop.k];
  if (Array.isArray(prop.k) && prop.k.length > 0 && typeof prop.k[0] === "number") {
    return prop.k as number[];
  }
  return fallback;
}

export async function handleShake(
  animationId: string | undefined,
  options: ShakeCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply a shake effect." });
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
  const axis: ShakeAxis = options.axis ?? "both";
  const shakeOpts = resolveShakeOptions(options);

  let modifiedCount = 0;
  const modifiedLayers: string[] = [];

  for (const layer of animation.layers) {
    if (options.layer && layer.nm !== options.layer) {
      continue;
    }
    if (!layer.ks) continue;

    const layerStart = layer.ip ?? startFrame;
    const layerEnd = options.duration != null
      ? layerStart + Math.round(options.duration * fps)
      : layer.op ?? endFrame;

    if (axis === "rotation") {
      const base = getBaseValue(layer.ks.r as AnimatedProperty | undefined, [0])[0];
      const offset = generateShakeKeyframes(layerStart, layerEnd, fps, shakeOpts);
      layer.ks.r = { a: 1, k: offset.map((kf) => ({ t: kf.t, s: [base + kf.s[0]] })) };
    } else {
      const base = getBaseValue(layer.ks.p as AnimatedProperty | undefined, [0, 0]);
      const xOffsetOpts: ShakeOptions = { ...shakeOpts, seed: shakeOpts.seed ?? 0 };
      const yOffsetOpts: ShakeOptions = { ...shakeOpts, seed: (shakeOpts.seed ?? 0) + 1 };

      const xOffset = axis === "y" ? null : generateShakeKeyframes(layerStart, layerEnd, fps, xOffsetOpts);
      const yOffset = axis === "x" ? null : generateShakeKeyframes(layerStart, layerEnd, fps, yOffsetOpts);
      const reference = xOffset ?? yOffset!;

      const keyframes = reference.map((kf, i) => {
        const s = [
          base[0] + (xOffset ? xOffset[i].s[0] : 0),
          base[1] + (yOffset ? yOffset[i].s[0] : 0),
        ];
        if (base.length > 2) s.push(base[2]);
        return { t: kf.t, s };
      });

      layer.ks.p = { a: 1, k: keyframes };
    }

    modifiedCount++;
    const layerName = layer.nm || "unnamed";
    if (!modifiedLayers.includes(layerName)) {
      modifiedLayers.push(layerName);
    }
  }

  if (modifiedCount === 0) {
    return sendDoneEvent({
      reply: "No layers found to apply shake to. Make sure your animation has layers.",
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
  const reply = `Applied shake (${axis}) to ${modifiedLayers.length} layer${modifiedLayers.length === 1 ? "" : "s"}: ${layerInfo}. (intensity=${shakeOpts.intensity}, frequency=${shakeOpts.frequency}, decay=${shakeOpts.decay})`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
