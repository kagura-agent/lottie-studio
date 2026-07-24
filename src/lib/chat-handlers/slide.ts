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
import { applySlide, SlideOptions } from "@/lib/slide";

export async function handleSlide(
  animationId: string | undefined,
  options: SlideOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply slide effects." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const slid = applySlide(animJson as Record<string, unknown>, options);

  writeAnimationFile(animationId, slid);
  updateAnimationMetadata(animationId, slid as Record<string, unknown>);

  const lottieStr = JSON.stringify(slid);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const parts: string[] = [`slide ${options.direction}${options.out ? " out" : " in"}`];
  if (options.duration) parts.push(`${options.duration}s duration`);
  if (options.easing) parts.push(`${options.easing} easing`);
  if (options.layer) parts.push(`layer "${options.layer}"`);
  if (options.stagger) parts.push(`${options.stagger}ms stagger`);
  if (options.distance) parts.push(`${options.distance}px distance`);
  const reply = `Applied ${parts.join(", ")} to the animation.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: slid,
    animationId,
    previousLottieJson: animJson,
  });
}
