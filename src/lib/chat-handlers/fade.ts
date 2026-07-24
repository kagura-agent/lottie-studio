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
import { applyFade, FadeOptions } from "@/lib/fade";

export async function handleFade(
  animationId: string | undefined,
  options: FadeOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply fade effects." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const faded = applyFade(animJson as Record<string, unknown>, options);

  writeAnimationFile(animationId, faded);
  updateAnimationMetadata(animationId, faded as Record<string, unknown>);

  const lottieStr = JSON.stringify(faded);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const parts: string[] = [`fade ${options.mode}`];
  if (options.duration) parts.push(`${options.duration}s duration`);
  if (options.easing && options.easing !== "ease-in-out") parts.push(`${options.easing} easing`);
  if (options.layer) parts.push(`layer "${options.layer}"`);
  if (options.stagger) parts.push(`${options.stagger}ms stagger`);
  if (options.delay) parts.push(`${options.delay}s delay`);
  const reply = `Applied ${parts.join(", ")} to the animation.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: faded,
    animationId,
    previousLottieJson: animJson,
  });
}
