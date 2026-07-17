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
import { retime } from "@/lib/retime";
import type { LottieJson } from "@/lib/retime";

export async function handleRetime(animationId: string | undefined, durationMs: number, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can change its duration." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const lottie = animJson as LottieJson;
  const oldDurationMs = Math.round((lottie.op / lottie.fr) * 1000);
  const retimed = retime(lottie, durationMs);

  writeAnimationFile(animationId, retimed);
  updateAnimationMetadata(animationId, retimed as Record<string, unknown>);

  const lottieStr = JSON.stringify(retimed);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const reply = `Duration changed from ${oldDurationMs}ms to ${durationMs}ms (${retimed.op} frames at ${retimed.fr}fps).`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: retimed,
    animationId,
    previousLottieJson: animJson,
  });
}
