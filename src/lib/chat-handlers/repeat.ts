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
import { repeatPattern, RepeatCommandOptions, LottieLayer } from "@/lib/repeat";

interface LottieAnimation {
  w?: number;
  h?: number;
  fr?: number;
  layers: LottieLayer[];
  [key: string]: unknown;
}

export async function handleRepeat(
  animationId: string | undefined,
  options: RepeatCommandOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply a repeat pattern." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;

  const sourceLayer = animation.layers.find((l) => l.ty === 4);
  if (!sourceLayer) {
    return sendDoneEvent({
      reply: "No shape layer found to repeat. Make sure your animation has at least one shape layer.",
    });
  }

  const maxInd = Math.max(0, ...animation.layers.map((l) => l.ind ?? 0));

  const newLayers = repeatPattern(sourceLayer, options.pattern, {
    ...options,
    canvasW: animation.w ?? 512,
    canvasH: animation.h ?? 512,
    frameRate: animation.fr ?? 30,
    maxInd,
  });

  const sourceIdx = animation.layers.indexOf(sourceLayer);
  animation.layers.splice(sourceIdx, 1, ...newLayers);

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);

  const lottieStr = JSON.stringify(animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const countDesc = newLayers.length;
  const patternDesc = options.pattern === "grid"
    ? `${options.cols ?? 3}×${options.rows ?? 3} grid`
    : options.pattern === "circle"
      ? `circle of ${countDesc}`
      : `${options.direction ?? "horizontal"} line of ${countDesc}`;
  const reply = `Repeated layer into a ${patternDesc} (${countDesc} copies).${options.stagger ? ` Stagger: ${options.stagger}ms.` : ""}`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    previousLottieJson: animJson,
  });
}
