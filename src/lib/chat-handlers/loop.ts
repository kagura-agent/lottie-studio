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

interface LottieKeyframe {
  t: number;
  s?: number[];
  e?: number[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
  [key: string]: unknown;
}

interface AnimatedProperty {
  a: number;
  k: LottieKeyframe[] | number | number[];
}

interface LayerTransform {
  [key: string]: unknown;
}

interface LottieLayer {
  nm?: string;
  ks?: LayerTransform;
  [key: string]: unknown;
}

interface LottieAnimation {
  fr: number;
  ip: number;
  op: number;
  layers: LottieLayer[];
  [key: string]: unknown;
}

const EASE_IN_OUT = {
  i: { x: [0.42], y: [0] },
  o: { x: [0.58], y: [1] },
};

function findAnimatedProperties(layer: LottieLayer): { key: string; prop: AnimatedProperty }[] {
  const results: { key: string; prop: AnimatedProperty }[] = [];
  if (!layer.ks) return results;
  for (const key of Object.keys(layer.ks)) {
    const prop = layer.ks[key] as AnimatedProperty | undefined;
    if (prop && prop.a === 1 && Array.isArray(prop.k) && prop.k.length >= 2) {
      results.push({ key, prop });
    }
  }
  return results;
}

function applySeamless(animation: LottieAnimation): number {
  let count = 0;
  for (const layer of animation.layers) {
    const animated = findAnimatedProperties(layer);
    for (const { prop } of animated) {
      const keyframes = prop.k as LottieKeyframe[];
      const first = keyframes[0];
      const last = keyframes[keyframes.length - 1];
      if (!first.s) continue;
      last.s = [...first.s];
      if (keyframes.length >= 2) {
        const secondLast = keyframes[keyframes.length - 2];
        secondLast.i = { ...EASE_IN_OUT.i };
        secondLast.o = { ...EASE_IN_OUT.o };
      }
      count++;
    }
  }
  return count;
}

function applyPingpong(animation: LottieAnimation): number {
  let count = 0;
  const originalOp = animation.op;

  for (const layer of animation.layers) {
    const animated = findAnimatedProperties(layer);
    for (const { prop } of animated) {
      const keyframes = prop.k as LottieKeyframe[];
      const reversed: LottieKeyframe[] = [];
      for (let i = keyframes.length - 2; i >= 0; i--) {
        const src = keyframes[i];
        const timeOffset = originalOp + (originalOp - src.t);
        const kf: LottieKeyframe = { t: timeOffset, s: src.s ? [...src.s] : undefined };
        if (i > 0) {
          kf.i = { x: [0.42], y: [0] };
          kf.o = { x: [0.58], y: [1] };
        }
        reversed.push(kf);
      }
      prop.k = [...keyframes, ...reversed];
      count++;
    }
  }

  animation.op = originalOp * 2;
  return count;
}

export async function handleLoop(
  animationId: string | undefined,
  mode: "seamless" | "pingpong" | "freeze",
  message: string
): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then you can apply loop settings." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const animation = JSON.parse(JSON.stringify(animJson)) as LottieAnimation;

  let reply: string;

  if (mode === "seamless") {
    const count = applySeamless(animation);
    if (count === 0) {
      return sendDoneEvent({
        reply: "No animated properties found to make seamless. The animation needs keyframed properties.",
      });
    }
    reply = `Applied seamless looping to ${count} propert${count === 1 ? "y" : "ies"} — last keyframe values now match the first for smooth cycling.`;
  } else if (mode === "pingpong") {
    const count = applyPingpong(animation);
    if (count === 0) {
      return sendDoneEvent({
        reply: "No animated properties found for ping-pong. The animation needs keyframed properties.",
      });
    }
    reply = `Applied ping-pong looping to ${count} propert${count === 1 ? "y" : "ies"} — animation now plays forward then reverses (duration doubled to ${animation.op} frames).`;
  } else {
    reply = "Freeze mode set — the animation will hold on its last frame when playback completes. Loop behavior is controlled by the player configuration.";
  }

  if (mode !== "freeze") {
    writeAnimationFile(animationId, animation);
    updateAnimationMetadata(animationId, animation as unknown as Record<string, unknown>);
  }

  const lottieStr = JSON.stringify(mode === "freeze" ? animJson : animation);
  saveVersion(animationId, lottieStr, message);

  saveUserMessage(animationId, message);
  saveAssistantMessage(animationId, reply, lottieStr, JSON.stringify(animJson));

  emitUpdated(animationId);

  return sendDoneEvent({
    reply,
    lottieJson: mode === "freeze" ? animJson : animation,
    animationId,
    previousLottieJson: animJson,
  });
}
