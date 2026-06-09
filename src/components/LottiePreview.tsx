"use client";

import { useEffect, useRef, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import type { CanvasBackground } from "./BackgroundPicker";
import type { LoopConfig } from "@/types/loopConfig";

interface LottiePreviewProps {
  animationData: object | null;
  isPlaying: boolean;
  speed: number;
  loopConfig: LoopConfig;
  onFrameChange?: (currentFrame: number, totalFrames: number) => void;
  seekToFrame?: number;
  background?: CanvasBackground;
}

function getBackgroundStyle(bg: CanvasBackground = "checkered"): { className: string; style?: React.CSSProperties } {
  if (bg === "white") return { className: "bg-white" };
  if (bg === "black") return { className: "bg-black" };
  if (bg.startsWith("#")) return { className: "", style: { backgroundColor: bg } };
  // checkered (default)
  return {
    className: "bg-zinc-900",
    style: {
      backgroundImage:
        "linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    },
  };
}

export default function LottiePreview({
  animationData,
  isPlaying,
  speed,
  loopConfig,
  onFrameChange,
  seekToFrame,
  background = "checkered",
}: LottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const frameCallbackRef = useRef(onFrameChange);
  frameCallbackRef.current = onFrameChange;
  const loopConfigRef = useRef(loopConfig);
  loopConfigRef.current = loopConfig;
  const directionRef = useRef<1 | -1>(1);
  const loopCountRef = useRef(0);

  const destroyAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !animationData) {
      destroyAnim();
      return;
    }

    destroyAnim();
    directionRef.current = 1;
    loopCountRef.current = 0;

    const needsLoop = loopConfig.mode === "loop" || loopConfig.mode === "bounce";

    try {
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: needsLoop,
        autoplay: isPlaying,
        animationData,
      });

      anim.setSpeed(speed);
      anim.setDirection(1);

      anim.addEventListener("enterFrame", () => {
        frameCallbackRef.current?.(
          Math.floor(anim.currentFrame),
          Math.floor(anim.totalFrames)
        );
      });

      anim.addEventListener("loopComplete", () => {
        const cfg = loopConfigRef.current;
        if (cfg.mode === "bounce") {
          directionRef.current = directionRef.current === 1 ? -1 : 1;
          anim.setDirection(directionRef.current);
        }
      });

      anim.addEventListener("complete", () => {
        const cfg = loopConfigRef.current;
        if (cfg.mode === "count") {
          loopCountRef.current++;
          const target = cfg.count ?? 3;
          if (loopCountRef.current < target) {
            anim.goToAndPlay(0, true);
          }
        }
      });

      animRef.current = anim;
    } catch {
      // invalid animation data
    }

    return destroyAnim;
    // Re-create animation when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData]);

  useEffect(() => {
    if (!animRef.current) return;
    if (isPlaying) {
      animRef.current.play();
    } else {
      animRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (animRef.current) {
      animRef.current.setSpeed(speed);
    }
  }, [speed]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;

    directionRef.current = 1;
    loopCountRef.current = 0;
    anim.setDirection(1);

    if (loopConfig.mode === "loop") {
      anim.loop = true;
    } else if (loopConfig.mode === "once") {
      anim.loop = false;
    } else if (loopConfig.mode === "bounce") {
      anim.loop = true;
    } else if (loopConfig.mode === "count") {
      anim.loop = false;
      loopCountRef.current = 0;
    }

    if (isPlaying) {
      anim.goToAndPlay(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopConfig]);

  useEffect(() => {
    if (animRef.current && seekToFrame !== undefined) {
      animRef.current.goToAndStop(seekToFrame, true);
    }
  }, [seekToFrame]);

  const bgProps = getBackgroundStyle(background);

  return (
    <div
      className={`preview-area relative flex items-center justify-center flex-1 rounded-lg overflow-hidden ${bgProps.className}`}
      style={bgProps.style}
    >
      {animationData ? (
        <div ref={containerRef} className="w-full h-full max-w-[500px] max-h-[500px]" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/50 rounded-lg">
          <span className="text-red-400 text-sm font-mono">Invalid JSON</span>
        </div>
      )}
    </div>
  );
}
