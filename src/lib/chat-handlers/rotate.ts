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
import { rotateAnimation } from "@/lib/rotate";

export async function handleRotate(
  animationId: string | undefined,
  degrees: number,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can rotate it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const rotated = rotateAnimation(animJson, degrees);

  writeAnimationFile(animationId, rotated);
  updateAnimationMetadata(animationId, rotated as Record<string, unknown>);

  const lottieStr = JSON.stringify(rotated);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const direction = degrees >= 0 ? "clockwise" : "counter-clockwise";
  const reply = `Animation rotated ${Math.abs(degrees)}° ${direction}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: rotated,
    animationId,
    previousLottieJson: animJson,
  });
}
