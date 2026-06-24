"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface EmbedPlayerProps {
  animationData: object;
  bg: string;
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
}

export default function EmbedPlayer({
  animationData,
  bg,
  autoplay,
  loop,
  controls,
}: EmbedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
