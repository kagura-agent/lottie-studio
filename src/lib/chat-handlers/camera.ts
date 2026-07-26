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
import { applyCamera, CameraOptions, CameraMovement } from "@/lib/camera";
import { CameraCommandOptions } from "@/lib/commands";

export async function handleCamera(
  animationId: string | undefined,
  parsedCmd: CameraCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply camera effects." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const cameraOptions: CameraOptions = {
    duration: parsedCmd.duration,
    easing: parsedCmd.easing,
    intensity: parsedCmd.intensity,
    from: parsedCmd.from,
    to: parsedCmd.to,
    point: parsedCmd.point,
  };

  const result = applyCamera(
    animJson as object,
    parsedCmd.movement as CameraMovement,
    cameraOptions
  );

  writeAnimationFile(animationId, result);
  updateAnimationMetadata(animationId, result as Record<string, unknown>);

  const lottieStr = JSON.stringify(result);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const parts: string[] = [`camera ${parsedCmd.movement}`];
  if (parsedCmd.duration) parts.push(`${parsedCmd.duration}s duration`);
  if (parsedCmd.easing) parts.push(`${parsedCmd.easing} easing`);
  if (parsedCmd.intensity) parts.push(`${parsedCmd.intensity}x intensity`);
  if (parsedCmd.point) parts.push(`point [${parsedCmd.point.join(",")}]`);
  const reply = `Applied ${parts.join(", ")} to the animation.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: result,
    animationId,
    previousLottieJson: animJson,
  });
}
