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
import { generateTrail, TrailOptions } from "@/lib/trail";

export async function handleTrail(
  animationId: string | undefined,
  options: TrailOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply a trail effect." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const result = generateTrail(animJson, options);

  writeAnimationFile(animationId, result);
  updateAnimationMetadata(animationId, result as Record<string, unknown>);

  const lottieStr = JSON.stringify(result);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const fadeInfo = options.fade !== "exponential" ? ` (${options.fade} fade)` : "";
  const scaleInfo = options.scale ? ", scaling down" : "";
  const colorInfo = options.color ? `, tinted ${options.color}` : "";
  const layerInfo = options.layer ? ` on "${options.layer}"` : "";
  const reply = `Added ${options.count}-copy trail${layerInfo}${fadeInfo}${scaleInfo}${colorInfo}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: result,
    animationId,
    previousLottieJson: animJson,
  });
}
