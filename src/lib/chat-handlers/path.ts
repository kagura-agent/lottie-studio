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
import { applyPathMotion, PathMotionOptions, PathShape } from "@/lib/path-motion";
import { PathCommandOptions } from "@/lib/commands";

export async function handlePath(
  animationId: string | undefined,
  parsedCmd: PathCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply path motion." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const pathOptions: PathMotionOptions = {
    duration: parsedCmd.duration,
    easing: parsedCmd.easing,
    loops: parsedCmd.loops,
    radius: parsedCmd.radius,
    amplitude: parsedCmd.amplitude,
    frequency: parsedCmd.frequency,
    clockwise: parsedCmd.clockwise,
    layer: parsedCmd.layer,
    from: parsedCmd.from,
    to: parsedCmd.to,
    center: parsedCmd.center,
    orient: parsedCmd.orient,
    svgPath: parsedCmd.svgPath,
  };

  const result = applyPathMotion(
    animJson as object,
    parsedCmd.shape as PathShape,
    pathOptions
  );

  writeAnimationFile(animationId, result);
  updateAnimationMetadata(animationId, result as Record<string, unknown>);

  const lottieStr = JSON.stringify(result);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const parts: string[] = [`path ${parsedCmd.shape}`];
  if (parsedCmd.duration) parts.push(`${parsedCmd.duration}s duration`);
  if (parsedCmd.easing) parts.push(`${parsedCmd.easing} easing`);
  if (parsedCmd.loops && parsedCmd.loops > 1) parts.push(`${parsedCmd.loops} loops`);
  if (parsedCmd.radius) parts.push(`${parsedCmd.radius}px radius`);
  if (parsedCmd.layer !== undefined) parts.push(`layer: ${parsedCmd.layer}`);
  if (parsedCmd.orient) parts.push(`auto-orient`);
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
