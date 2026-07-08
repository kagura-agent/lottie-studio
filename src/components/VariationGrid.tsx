"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";

export interface Variation {
  style: string;
  animation: object;
  description: string;
}

interface VariationGridProps {
  variations: Variation[];
  loading?: boolean;
  onSelect: (variation: Variation) => void;
}

const STYLE_COLORS: Record<string, string> = {
  playful: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  smooth: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  dynamic: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

function VariationCard({ variation, onSelect }: { variation: Variation; onSelect: () => void }) {
  const t = useTranslations("variations");
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current || !variation.animation) return;

    let cancelled = false;

    (async () => {
      try {
        const anim = await loadAnimation({
          container: containerRef.current!,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: variation.animation,
        });
        if (cancelled) {
          anim.destroy();
        } else {
          animRef.current = anim;
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [variation.animation]);

  const badgeClass = STYLE_COLORS[variation.style] || "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";

  return (
    <div
      className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden hover:border-indigo-500/60 transition-colors focus-within:ring-2 focus-within:ring-indigo-500"
      role="article"
      aria-label={t("cardLabel", { style: variation.style })}
    >
      {/* Lottie Preview */}
      <div
        ref={containerRef}
        className="w-full aspect-square bg-zinc-900/50 p-2"
        aria-hidden="true"
      />

      {/* Card Content */}
      <div className="flex flex-col gap-2 p-3">
        {/* Style Badge */}
        <span className={`self-start px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
          {variation.style}
        </span>

        {/* Description */}
        <p className="text-xs text-zinc-400 line-clamp-2">
          {variation.description}
        </p>

        {/* Select Button */}
        <button
          onClick={onSelect}
          className="mt-1 w-full px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 active:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-800"
          aria-label={t("selectVariation", { style: variation.style })}
        >
          {t("select")}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden animate-pulse">
      <div className="w-full aspect-square bg-zinc-700/50" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-5 w-16 rounded-full bg-zinc-700/50" />
        <div className="h-3 w-full rounded bg-zinc-700/50" />
        <div className="h-3 w-3/4 rounded bg-zinc-700/50" />
        <div className="h-8 w-full rounded-lg bg-zinc-700/50 mt-1" />
      </div>
    </div>
  );
}

export default function VariationGrid({ variations, loading, onSelect }: VariationGridProps) {
  const t = useTranslations("variations");

  const handleSelect = useCallback(
    (variation: Variation) => {
      onSelect(variation);
    },
    [onSelect]
  );

  return (
    <div
      className="w-full"
      role="region"
      aria-label={t("gridLabel")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {variations.map((v) => (
          <VariationCard
            key={v.style}
            variation={v}
            onSelect={() => handleSelect(v)}
          />
        ))}
        {loading && variations.length < 3 && (
          <>
            {Array.from({ length: 3 - variations.length }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
