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
import { generatePhysicsKeyframes, PhysicsCommandOptions } from "@/lib/physics";

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

export async function handlePhysics(
  animationId: string | undefined,
  options: PhysicsCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply physics effects." });
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

  const keyframes = generatePhysicsKeyframes(options.effect, options, startFrame, fps);

  let modifiedCount = 0;
  const modifiedLayers: string[] = [];

  for (const layer of animation.layers) {
    if (options.layer && layer.nm !== options.layer) {
      continue;
    }
    if (!layer.ks) continue;

    if (options.effect === "pendulum") {
      layer.ks.r = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: kf.s })) };
    } else {
      const baseX = getBaseValue(layer.ks.p, [256, 256]);
      layer.ks.p = {
        a: 1,
        k: keyframes.map((kf) => ({
          t: kf.t,
          s: [baseX[0] + kf.s[0], baseX[1] + (kf.s[1] ?? 0), ...(baseX.length > 2 ? [baseX[2]] : [])],
        })),
      };
    }

    modifiedCount++;
    const layerName = layer.nm || "unnamed";
    if (!modifiedLayers.includes(layerName)) {
      modifiedLayers.push(layerName);
    }
  }

  if (modifiedCount === 0) {
    return sendDoneEvent({
      reply: "No layers found to apply physics to. Make sure your animation has layers.",
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
  const reply = `Applied ${options.effect} physics to ${modifiedLayers.length} layer${modifiedLayers.length === 1 ? "" : "s"}: ${layerInfo}. (duration=${options.duration ?? 2000}ms, gravity=${options.gravity ?? 980})`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}

function getBaseValue(prop: AnimatedProperty | undefined, fallback: number[]): number[] {
  if (!prop) return fallback;
  if (typeof prop.k === "number") return [prop.k];
  if (Array.isArray(prop.k) && prop.k.length > 0 && typeof prop.k[0] === "number") {
    return prop.k as number[];
  }
  return fallback;
}
