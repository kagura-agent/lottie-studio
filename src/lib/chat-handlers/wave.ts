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
import { generateWaveAnimation, WaveCommandOptions } from "@/lib/wave";

export async function handleWave(
  animationId: string | undefined,
  options: WaveCommandOptions,
  message: string
): Promise<Response> {
  const waveType = options.type ?? "sine";
  const animation = generateWaveAnimation(options);
  const lottieStr = JSON.stringify(animation);

  let previousJson: object | null = null;

  if (!animationId) {
    animationId = randomUUID();
    db.prepare(
      "INSERT INTO animations (id, name) VALUES (?, ?)"
    ).run(animationId, `wave: ${waveType}`);
  } else {
    if (!animationExists(animationId)) {
      return Response.json({ error: "Animation not found" }, { status: 404 });
    }
    previousJson = readAnimationFile(animationId);
  }

  writeAnimationFile(animationId, animation);
  updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);

  const reply = `Here is your ${waveType} wave animation! 🌊`;
  saveAssistantMessage(animationId, reply, lottieStr, previousJson ? JSON.stringify(previousJson) : null);

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: animation,
    animationId,
    ...(previousJson ? { previousLottieJson: previousJson } : {}),
  });
}
