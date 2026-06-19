"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";

interface ExploreCardProps {
  animation: {
    id: string;
    name: string;
    frame_count: number | null;
    layer_count: number | null;
    w: number | null;
    h: number | null;
  };
}

export default function ExploreCard({ animation }: ExploreCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const loadAnim = () => {
      fetch(`/api/animations/${animation.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled || !containerRef.current || !json.data) return;
          try {
            animRef.current = lottie.loadAnimation({
              container: containerRef.current,
              renderer: "svg",
              loop: true,
              autoplay: true,
              animationData: json.data,
            });
            setLoaded(true);
          } catch {
            setError(true);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };

    const destroyAnim = () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
        setLoaded(false);
      }
    };

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!animRef.current && !loaded) loadAnim();
        } else {
          destroyAnim();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(el);

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      destroyAnim();
    };
  }, [animation.id, loaded]);

  const frames =
    animation.frame_count != null ? `${animation.frame_count} frames` : null;
  const layers =
    animation.layer_count != null
      ? `${animation.layer_count} layer${animation.layer_count !== 1 ? "s" : ""}`
      : null;

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
            Failed to load
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
          {animation.name}
        </h3>
        <div className="mt-1 flex gap-3 text-xs text-zinc-500">
          {frames && <span>{frames}</span>}
          {layers && <span>{layers}</span>}
        </div>
      </div>
    </Link>
  );
}
