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
import { generateTransitionKeyframes, TransitionCommandOptions } from "@/lib/transition";

interface AnimatedProperty {
  a: number;
  k: unknown;
}

interface LayerTransform {
  o?: AnimatedProperty;
  p?: AnimatedProperty;
  s?: AnimatedProperty;
  r?: AnimatedProperty;
  [key: string]: unknown;
}

interface LottieLayer {
  nm?: string;
  ks?: LayerTransform;
  ip?: number;
  op?: number;
  hasMask?: boolean;
  masksProperties?: unknown[];
  [key: string]: unknown;
}

interface LottieAnimation {
  fr: number;
  ip: number;
  op: number;
  layers: LottieLayer[];
  [key: string]: unknown;
}

export async function handleTransition(
  animationId: string | undefined,
  options: TransitionCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply transitions." });
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

  let modifiedCount = 0;
  const modifiedLayers: string[] = [];

  for (let idx = 0; idx < animation.layers.length; idx++) {
    const layer = animation.layers[idx];
    if (options.layer && layer.nm !== options.layer) continue;
    if (!layer.ks) continue;

    const staggerOffset = options.stagger ? idx * Math.round((options.stagger / 1000) * fps) : 0;
    const keyframes = generateTransitionKeyframes(options.type, options, startFrame + staggerOffset, fps);

    switch (options.type) {
      case "fade":
        layer.ks.o = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: [kf.s[0]] })) };
        break;
      case "slide":
        layer.ks.p = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: [256 + kf.s[0], 256 + kf.s[1]] })) };
        break;
      case "wipe":
        layer.hasMask = true;
        layer.masksProperties = [{
          inv: false,
          mode: "a",
          pt: { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: { i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]], v: [[kf.s[0], kf.s[1]], [kf.s[0] + kf.s[2], kf.s[1]], [kf.s[0] + kf.s[2], kf.s[1] + kf.s[3]], [kf.s[0], kf.s[1] + kf.s[3]]] } })) },
          o: { a: 0, k: 100 },
          x: { a: 0, k: 0 },
        }];
        break;
      case "zoom":
        layer.ks.s = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: [kf.s[0], kf.s[1], 100] })) };
        break;
      case "flip":
        layer.ks.r = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: [kf.s[0] + kf.s[1]] })) };
        break;
      case "dissolve":
        layer.ks.o = { a: 1, k: keyframes.map((kf) => ({ t: kf.t, s: [kf.s[0]] })) };
        break;
    }

    modifiedCount++;
    const layerName = layer.nm || "unnamed";
    if (!modifiedLayers.includes(layerName)) {
      modifiedLayers.push(layerName);
    }
  }

  if (modifiedCount === 0) {
    return sendDoneEvent({
      reply: "No layers found to apply the transition to. Make sure your animation has layers.",
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
  const reply = `Applied ${options.type} transition to ${modifiedLayers.length} layer${modifiedLayers.length === 1 ? "" : "s"}: ${layerInfo}. (duration=${options.duration ?? 600}ms, easing=${options.easing ?? "ease-in-out"})`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
