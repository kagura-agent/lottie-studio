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
import { morphAnimation, MorphShape, MorphOptions, VALID_MORPH_SHAPES } from "@/lib/morph";

export async function handleMorph(
  animationId: string | undefined,
  targetShape: MorphShape,
  options: MorphOptions,
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can morph its shapes." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  if (!VALID_MORPH_SHAPES.includes(targetShape)) {
    return sendDoneEvent({
      reply: `Unknown shape "${targetShape}". Available shapes: ${VALID_MORPH_SHAPES.filter(s => s !== "rectangle").join(", ")}`,
    });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  let morphed: object;
  try {
    morphed = morphAnimation(animJson, targetShape, options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Morph failed";
    return sendDoneEvent({ reply: msg });
  }

  writeAnimationFile(animationId, morphed);
  updateAnimationMetadata(animationId, morphed as Record<string, unknown>);

  const lottieStr = JSON.stringify(morphed);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const shapeName = targetShape === "rectangle" ? "rect" : targetShape;
  const reply = `Shape morphed to ${shapeName}${options.duration ? ` over ${options.duration}s` : ""}.`;
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: morphed,
    animationId,
    previousLottieJson: animJson,
  });
}
