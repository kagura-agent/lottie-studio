"use client";

import { useEffect, useRef, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface InlineLottiePreviewProps {
  lottieJson: object;
}

export default function InlineLottiePreview({ lottieJson }: InlineLottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const destroyAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
  }, []);

  const createAnim = useCallback(() => {
    if (!containerRef.current || animRef.current) return;
    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: lottieJson,
      });
    } catch {
      // invalid animation data — silently ignore
    }
  }, [lottieJson]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          createAnim();
        } else {
          destroyAnim();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
      destroyAnim();
    };
  }, [createAnim, destroyAnim]);

  return (
    <div className="flex justify-center mb-2">
      <div
        ref={containerRef}
        className="w-[160px] h-[160px] rounded-lg bg-zinc-800/50 border border-zinc-600/30 overflow-hidden"
      />
    </div>
  );
}
