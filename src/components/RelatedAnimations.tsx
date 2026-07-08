"use client";

import { useEffect, useRef, useState } from "react";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import Link from "next/link";
import { useTranslations } from 'next-intl';

interface RelatedAnimation {
  id: string;
  name: string;
  tags: string | null;
  description: string | null;
}

function RelatedCard({ animation }: { animation: RelatedAnimation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const t = useTranslations('common');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const init = async () => {
      try {
        const res = await fetch(`/api/animations/${animation.id}/json`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();

        if (cancelled || !containerRef.current) return;

        try {
          animRef.current = await loadAnimation({
            container: containerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json,
          });

          if (cancelled) {
            animRef.current.destroy();
            animRef.current = null;
            return;
          }

          setLoaded(true);
        } catch {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [animation.id]);

  return (
    <Link
      href={`/share/${animation.id}`}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-zinc-900/50"
    >
      <div
        className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        <div ref={containerRef} className="w-full h-full p-4" />
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            {t('failedToLoad')}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
          {animation.name}
        </h3>
        {animation.description && (
          <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">
            {animation.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="aspect-square bg-zinc-950 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

export default function RelatedAnimations({ animationId }: { animationId: string }) {
  const [related, setRelated] = useState<RelatedAnimation[] | null>(null);
  const t = useTranslations();

  useEffect(() => {
    fetch(`/api/animations/${animationId}/related`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data: RelatedAnimation[]) => {
        setRelated(data);
      })
      .catch(() => {
        setRelated([]);
      });
  }, [animationId]);

  // Hide section entirely when no results
  if (related !== null && related.length === 0) {
    return null;
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">
        {t('relatedAnimations.title')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {related === null
          ? Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)
          : related.map((anim) => (
              <RelatedCard key={anim.id} animation={anim} />
            ))}
      </div>
    </section>
  );
}
