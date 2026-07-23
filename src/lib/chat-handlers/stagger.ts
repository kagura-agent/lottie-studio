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
import { staggerAnimation } from "@/lib/stagger";
import type { StaggerOrder } from "@/lib/stagger";

export async function handleStagger(
  animationId: string | undefined,
  delayMs: number,
  order: StaggerOrder,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can stagger it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const staggered = staggerAnimation(animJson, delayMs, order);

  writeAnimationFile(animationId, staggered);
  updateAnimationMetadata(animationId, staggered as Record<string, unknown>);

  const lottieStr = JSON.stringify(staggered);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const reply = `Stagger applied: ${delayMs}ms delay between layers (${order} order).`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: staggered,
    animationId,
    previousLottieJson: animJson,
  });
}
