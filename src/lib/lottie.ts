import type { AnimationItem, AnimationConfigWithData } from "lottie-web";

export type { AnimationItem };

let lottieModule: typeof import("lottie-web") | null = null;

export async function loadLottie() {
  if (lottieModule) return lottieModule.default;
  lottieModule = await import("lottie-web");
  return lottieModule.default;
}

export async function loadAnimation(
  config: AnimationConfigWithData<"svg" | "canvas" | "html">
): Promise<AnimationItem> {
  const lottie = await loadLottie();
  return lottie.loadAnimation(config);
}
