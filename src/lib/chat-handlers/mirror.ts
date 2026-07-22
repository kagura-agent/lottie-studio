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
import { mirrorAnimation } from "@/lib/mirror";
import type { MirrorAxis } from "@/lib/mirror";

export async function handleMirror(
  animationId: string | undefined,
  axis: MirrorAxis,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can mirror it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const mirrored = mirrorAnimation(animJson, axis);

  writeAnimationFile(animationId, mirrored);
  updateAnimationMetadata(animationId, mirrored as Record<string, unknown>);

  const lottieStr = JSON.stringify(mirrored);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const direction = axis === "horizontal" ? "horizontally" : "vertically";
  const reply = `Animation mirrored ${direction}. All layers have been flipped on the ${axis === "horizontal" ? "X" : "Y"} axis.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: mirrored,
    animationId,
    previousLottieJson: animJson,
  });
}
