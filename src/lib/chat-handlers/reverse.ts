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
import { reverseAnimation } from "@/lib/reverse";

export async function handleReverse(animationId: string | undefined, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can reverse it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const reversed = reverseAnimation(animJson) as Record<string, unknown>;

  writeAnimationFile(animationId, reversed);
  updateAnimationMetadata(animationId, reversed);

  const lottieStr = JSON.stringify(reversed);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const reply = "Animation reversed — all keyframes now play in the opposite direction.";
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: reversed,
    animationId,
    previousLottieJson: animJson,
  });
}
