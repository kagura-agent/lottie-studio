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
import { trimAnimation, resolveRange } from "@/lib/trim";
import type { LottieJson } from "@/lib/retime";
import type { TrimPoint } from "@/lib/commands";

export async function handleTrim(
  animationId: string | undefined,
  range: { start: TrimPoint; end: TrimPoint },
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can trim it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const lottie = animJson as LottieJson;
  const { startFrame, endFrame } = resolveRange(range, lottie.fr, lottie.op);

  if (startFrame >= endFrame) {
    return sendDoneEvent({ reply: `Invalid trim range: start frame (${startFrame}) must be less than end frame (${endFrame}).` });
  }

  if (startFrame < 0 || endFrame > lottie.op) {
    return sendDoneEvent({ reply: `Trim range out of bounds. Animation is 0-${lottie.op} frames.` });
  }

  const trimmed = trimAnimation(lottie, startFrame, endFrame);

  writeAnimationFile(animationId, trimmed);
  updateAnimationMetadata(animationId, trimmed as Record<string, unknown>);

  const lottieStr = JSON.stringify(trimmed);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const duration = endFrame - startFrame;
  const reply = `Trimmed animation to frames ${startFrame}-${endFrame} (${duration} frames, ${(duration / lottie.fr).toFixed(2)}s at ${lottie.fr}fps).`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: trimmed,
    animationId,
    previousLottieJson: animJson,
  });
}
