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
import { applyEasing, EasingPreset } from "@/lib/easing";

export async function handleEasing(
  animationId: string | undefined,
  preset: EasingPreset,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply easing." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const { result, keyframeCount } = applyEasing(animJson, preset);

  if (keyframeCount === 0) {
    return sendDoneEvent({ reply: "No keyframes found to apply easing to. The animation needs animated properties with keyframes." });
  }

  writeAnimationFile(animationId, result);
  updateAnimationMetadata(animationId, result as Record<string, unknown>);

  const lottieStr = JSON.stringify(result);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const reply = `Applied "${preset}" easing to ${keyframeCount} keyframe${keyframeCount === 1 ? "" : "s"}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: result,
    animationId,
    previousLottieJson: animJson,
  });
}
