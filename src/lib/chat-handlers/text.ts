import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  sendDoneEvent,
  saveVersion,
  updateAnimationMetadata,
  emitUpdated,
  animationExists,
  writeAnimationFile,
  readAnimationFile,
  saveUserMessage,
  saveAssistantMessage,
} from "./helpers";
import { generateTextAnimation, TextOptions, TextPreset } from "@/lib/text";

export async function handleText(
  animationId: string | undefined,
  text: string,
  options: TextOptions,
  message: string
): Promise<Response> {
  const lottie = generateTextAnimation(text, options);
  const lottieStr = JSON.stringify(lottie);

  let previousJson: object | null = null;

  if (!animationId) {
    animationId = randomUUID();
    db.prepare(
      "INSERT INTO animations (id, name) VALUES (?, ?)"
    ).run(animationId, `text: ${text.slice(0, 30)}`);
  } else {
    if (!animationExists(animationId)) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    previousJson = readAnimationFile(animationId);
  }

  writeAnimationFile(animationId, lottie);
  updateAnimationMetadata(animationId, lottie as Record<string, unknown>);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  const preset = options.style || "typewriter";
  const reply = `Here's your "${text}" text animation with ${preset} effect! ✨`;
  saveAssistantMessage(animationId, reply, lottieStr, previousJson ? JSON.stringify(previousJson) : null);

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: lottie,
    animationId,
    ...(previousJson ? { previousLottieJson: previousJson } : {}),
  });
}
