"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import lottie, { AnimationItem } from "lottie-web";

interface InlineLottiePreviewProps {
  lottieJson: object;
  previousLottieJson?: object;
}

export default function InlineLottiePreview({ lottieJson, previousLottieJson }: InlineLottiePreviewProps) {
  const t = useTranslations("chat.inlinePreview");
  const [showBefore, setShowBefore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isVisibleRef = useRef(false);

  const activeData = showBefore && previousLottieJson ? previousLottieJson : lottieJson;

  const destroyAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
  }, []);

  const createAnim = useCallback(() => {
    if (!containerRef.current) return;
    destroyAnim();
    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: activeData,
      });
    } catch {
      // invalid animation data — silently ignore
    }
  }, [activeData, destroyAnim]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
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
    <div className="flex flex-col items-center mb-2">
      <div className="relative">
        <div
          ref={containerRef}
          className="w-[160px] h-[160px] rounded-lg bg-zinc-800/50 border border-zinc-600/30 overflow-hidden transition-opacity duration-200"
        />
      </div>
      {previousLottieJson && (
        <div className="mt-1.5 flex rounded-full bg-zinc-800 border border-zinc-700 p-0.5 text-xs">
          <button
            onClick={() => setShowBefore(true)}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${
              showBefore
                ? "bg-zinc-600 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t("before")}
          </button>
          <button
            onClick={() => setShowBefore(false)}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${
              !showBefore
                ? "bg-zinc-600 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t("after")}
          </button>
        </div>
      )}
    </div>
  );
}
