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
import { drawAnimation, DrawOptions } from "@/lib/draw";

export async function handleDraw(
  animationId: string | undefined,
  options: DrawOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply draw effects." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const drawn = drawAnimation(animJson as Record<string, unknown>, options);

  writeAnimationFile(animationId, drawn);
  updateAnimationMetadata(animationId, drawn as Record<string, unknown>);

  const lottieStr = JSON.stringify(drawn);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const parts: string[] = [];
  if (options.reverse) {
    parts.push("stroke erase");
  } else {
    parts.push("stroke draw");
  }
  if (options.duration) parts.push(`${options.duration}s duration`);
  if (options.easing && options.easing !== "ease-out") parts.push(`${options.easing} easing`);
  if (options.stagger) parts.push(`${options.stagger}ms stagger`);
  const reply = `Applied ${parts.join(", ")} animation to shape layers with strokes.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: drawn,
    animationId,
    previousLottieJson: animJson,
  });
}
