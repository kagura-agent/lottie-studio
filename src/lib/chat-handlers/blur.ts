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
import { applyBlurToLayers, BlurCommandOptions, LottieLayerWithEffects } from "@/lib/blur";

interface LottieAnimation {
  layers: LottieLayerWithEffects[];
  [key: string]: unknown;
}

export async function handleBlur(
  animationId: string | undefined,
  options: BlurCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply a blur effect." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;
  const modifiedLayers = applyBlurToLayers(animation.layers, options);

  if (modifiedLayers.length === 0) {
    return sendDoneEvent({
      reply: "No layers found to apply blur to. Make sure your animation has layers.",
    });
  }

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);

  const lottieStr = JSON.stringify(animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const mode = options.mode ?? "in";
  const layerInfo = modifiedLayers.length <= 3
    ? modifiedLayers.map((n) => `"${n}"`).join(", ")
    : `${modifiedLayers.length} layers`;
  const reply = `Applied ${mode} blur to ${modifiedLayers.length} layer${modifiedLayers.length === 1 ? "" : "s"}: ${layerInfo}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
