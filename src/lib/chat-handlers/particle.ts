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
import { generateParticleAnimation, ParticleType, ParticleOptions } from "@/lib/particle";

export async function handleParticle(
  animationId: string | undefined,
  particleType: ParticleType,
  options: ParticleOptions,
  message: string
): Promise<Response> {
  const lottie = generateParticleAnimation(particleType, options);
  const lottieStr = JSON.stringify(lottie);

  let previousJson: object | null = null;

  if (!animationId) {
    animationId = randomUUID();
    db.prepare(
      "INSERT INTO animations (id, name) VALUES (?, ?)"
    ).run(animationId, `${particleType} particles`);
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
  const reply = `Here's your ${particleType} particle effect! ✨`;
  saveAssistantMessage(animationId, reply, lottieStr, previousJson ? JSON.stringify(previousJson) : null);

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: lottie,
    animationId,
    ...(previousJson ? { previousLottieJson: previousJson } : {}),
  });
}
