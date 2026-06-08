"use client";

import { useEffect, useRef, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import type { CanvasBackground } from "./BackgroundPicker";

interface LottiePreviewProps {
  animationData: object | null;
  isPlaying: boolean;
  speed: number;
  loop: boolean;
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
  loop,
  onFrameChange,
  seekToFrame,
  background = "checkered",
}: LottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const frameCallbackRef = useRef(onFrameChange);
  frameCallbackRef.current = onFrameChange;

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

    try {
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay: isPlaying,
        animationData,
      });

      anim.setSpeed(speed);

      anim.addEventListener("enterFrame", () => {
        frameCallbackRef.current?.(
          Math.floor(anim.currentFrame),
          Math.floor(anim.totalFrames)
        );
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
    if (animRef.current) {
      animRef.current.loop = loop;
    }
  }, [loop]);

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
