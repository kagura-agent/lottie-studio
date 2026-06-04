"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";

interface AnimationCardProps {
  id: string;
  name: string;
  frameCount: number | null;
  durationSeconds: number | null;
}

export default function AnimationCard({
  id,
  name,
  frameCount,
  durationSeconds,
}: AnimationCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    fetch(`/api/animations/${id}`)
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

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [id]);

  const duration =
    durationSeconds != null ? `${durationSeconds.toFixed(1)}s` : "—";
  const frames = frameCount != null ? `${frameCount} frames` : "—";

  return (
    <Link
      href={`/editor/${id}`}
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
          {name}
        </h3>
        <div className="mt-1 flex gap-3 text-xs text-zinc-500">
          <span>{duration}</span>
          <span>{frames}</span>
        </div>
      </div>
    </Link>
  );
}
