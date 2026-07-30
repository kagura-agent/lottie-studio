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
import { applyGradientToLayer, generateGradientAnimation, GradientCommandOptions, LottieLayer } from "@/lib/gradient";

interface LottieAnimation {
  layers: LottieLayer[];
  op?: number;
  fr?: number;
  [key: string]: unknown;
}

export async function handleGradient(
  animationId: string | undefined,
  options: GradientCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    const animation = generateGradientAnimation(options);
    const preset = options.preset ?? "shimmer";
    const gradType = options.type ?? "linear";
    const reply = `Created a new ${gradType} gradient animation using the "${preset}" preset.`;

    return sendDoneEvent({
      reply,
      lottieJson: animation,
    });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;
  const totalFrames = animation.op ?? 90;
  const modifiedLayers = applyGradientToLayer(animation.layers, options, totalFrames);

  if (modifiedLayers.length === 0) {
    return sendDoneEvent({
      reply: "No shape layers found to apply gradient to. The gradient command works on shape layers (ty:4).",
    });
  }

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);

  const lottieStr = JSON.stringify(animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const gradType = options.type ?? "linear";
  const mode = options.mode ?? "fill";
  const layerInfo = modifiedLayers.length <= 3
    ? modifiedLayers.map((n) => `"${n}"`).join(", ")
    : `${modifiedLayers.length} layers`;
  const reply = `Applied ${gradType} gradient ${mode} to ${modifiedLayers.length} layer${modifiedLayers.length === 1 ? "" : "s"}: ${layerInfo}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
