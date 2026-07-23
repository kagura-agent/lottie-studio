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
import { scaleAnimation } from "@/lib/scale";

export async function handleScale(
  animationId: string | undefined,
  factor: number,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can scale it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const scaled = scaleAnimation(animJson, factor);

  writeAnimationFile(animationId, scaled);
  updateAnimationMetadata(animationId, scaled as Record<string, unknown>);

  const lottieStr = JSON.stringify(scaled);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const pct = Math.round(factor * 100);
  const reply = `Animation scaled to ${pct}% (${factor}x).`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: scaled,
    animationId,
    previousLottieJson: animJson,
  });
}
