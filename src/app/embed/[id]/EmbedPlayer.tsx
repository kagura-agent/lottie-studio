"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";

export type EmbedMode = "scroll" | "hover" | "click" | "cursor";

interface EmbedPlayerProps {
  animationData: object;
  bg: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  mode?: EmbedMode;
}

export default function EmbedPlayer({
  animationData,
  bg,
  autoplay,
  loop,
  controls,
  mode,
}: EmbedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay,
      animationData,
    });

    animRef.current = anim;

    anim.addEventListener("complete", () => {
      if (!loop) setIsPlaying(false);
    });

    return () => {
      anim.destroy();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData, loop, autoplay]);

  // Scroll mode: map scroll position to frame
  useEffect(() => {
    if (mode !== "scroll") return;
    const anim = animRef.current;
    if (!anim) return;

    const handleScroll = () => {
      if (!animRef.current) return;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const progress = Math.min(Math.max(window.scrollY / scrollHeight, 0), 1);
      const frame = Math.round(progress * (animRef.current.totalFrames - 1));
      animRef.current.goToAndStop(frame, true);
    };

    // Initial position
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mode, animationData]);

  // Hover mode: play on mouseenter, stop+rewind on mouseleave
  useEffect(() => {
    if (mode !== "hover") return;
    const root = rootRef.current;
    if (!root) return;

    const handleEnter = () => {
      const anim = animRef.current;
      if (!anim) return;
      anim.loop = true;
      anim.play();
      setIsPlaying(true);
    };

    const handleLeave = () => {
      const anim = animRef.current;
      if (!anim) return;
      anim.pause();
      anim.goToAndStop(0, true);
      setIsPlaying(false);
    };

    root.addEventListener("mouseenter", handleEnter);
    root.addEventListener("mouseleave", handleLeave);
    return () => {
      root.removeEventListener("mouseenter", handleEnter);
      root.removeEventListener("mouseleave", handleLeave);
    };
  }, [mode, animationData]);

  // Click mode: click to toggle play/pause
  useEffect(() => {
    if (mode !== "click") return;
    const root = rootRef.current;
    if (!root) return;

    const handleClick = () => {
      const anim = animRef.current;
      if (!anim) return;
      if (isPlaying) {
        anim.pause();
        setIsPlaying(false);
      } else {
        anim.loop = true;
        anim.play();
        setIsPlaying(true);
      }
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [mode, isPlaying, animationData]);

  // Cursor mode: map horizontal cursor position to frame
  useEffect(() => {
    if (mode !== "cursor") return;
    const root = rootRef.current;
    if (!root) return;

    const mapPositionToFrame = (clientX: number) => {
      const anim = animRef.current;
      if (!anim) return;
      const rect = root.getBoundingClientRect();
      const relativeX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const progress = rect.width > 0 ? relativeX / rect.width : 0;
      const frame = Math.round(progress * (anim.totalFrames - 1));
      anim.goToAndStop(frame, true);
    };

    const handleMouseMove = (e: MouseEvent) => mapPositionToFrame(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mapPositionToFrame(e.touches[0].clientX);
      }
    };

    root.addEventListener("mousemove", handleMouseMove);
    root.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      root.removeEventListener("mousemove", handleMouseMove);
      root.removeEventListener("touchmove", handleTouchMove);
    };
  }, [mode, animationData]);

  const togglePlay = useCallback(() => {
    const anim = animRef.current;
    if (!anim) return;

    if (isPlaying) {
      anim.pause();
      setIsPlaying(false);
    } else {
      // If animation completed (not looping), restart
      if (!loop && anim.currentFrame >= anim.totalFrames - 1) {
        anim.goToAndPlay(0, true);
      } else {
        anim.play();
      }
      setIsPlaying(true);
    }
  }, [isPlaying, loop]);

  // Compute background style
  const bgStyle: React.CSSProperties = {};
  if (bg) {
    // Support hex colors with or without # prefix
    const color = bg.startsWith("#") ? bg : `#${bg}`;
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
      bgStyle.backgroundColor = color;
    }
  }

  return (
    <div
      ref={rootRef}
      className="embed-root"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        margin: 0,
        padding: 0,
        cursor: mode === "cursor" ? "crosshair" : mode === "click" ? "pointer" : undefined,
        ...bgStyle,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
      {controls && (
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="3,1 13,7 3,13" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
