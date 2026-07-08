"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface FeaturedAnimation {
  id: string;
  name: string;
  description: string | null;
  view_count: number;
  like_count: number;
}

export default function FeaturedSpotlight() {
  const t = useTranslations();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [featured, setFeatured] = useState<FeaturedAnimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [remixing, setRemixing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/animations/featured")
      .then((res) => {
        if (res.status === 204 || !res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setFeatured(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!featured || !containerRef.current) return;
    let cancelled = false;

    fetch(`/api/animations/${featured.id}`)
      .then((res) => res.json())
      .then(async (json) => {
        if (cancelled || !containerRef.current || !json.data) return;
        try {
          const anim = await loadAnimation({
            container: containerRef.current,
            renderer: "canvas",
            loop: true,
            autoplay: true,
            animationData: json.data,
          });
          if (cancelled) {
            anim.destroy();
          } else {
            animRef.current = anim;
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [featured]);

  const handleRemix = useCallback(async () => {
    if (!featured || remixing) return;
    setRemixing(true);
    try {
      const res = await fetch(`/api/animations/${featured.id}/remix`, { method: "POST" });
      if (!res.ok) throw new Error("Remix failed");
      const data = await res.json();
      router.push(`/editor/${data.id}`);
    } catch {
      setRemixing(false);
    }
  }, [featured, remixing, router]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 animate-pulse">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="w-[200px] h-[200px] shrink-0 bg-zinc-800 rounded-lg" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-16 bg-zinc-800 rounded" />
            <div className="h-5 w-48 bg-zinc-800 rounded" />
            <div className="h-4 w-full bg-zinc-800 rounded" />
            <div className="h-4 w-2/3 bg-zinc-800 rounded" />
            <div className="flex gap-3 mt-4">
              <div className="h-8 w-16 bg-zinc-800 rounded" />
              <div className="h-8 w-16 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!featured) return null;

  return (
    <div className="max-w-3xl mx-auto mb-8 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 to-zinc-800/50 p-5 relative">
      <span className="absolute top-3 left-3 text-xs text-indigo-300">
        &#10024; {t("explore.featured")}
      </span>
      <div className="flex flex-col md:flex-row gap-5 mt-4">
        <div
          ref={containerRef}
          className="w-[200px] h-[200px] shrink-0 rounded-lg bg-zinc-950 self-center md:self-start"
        />
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <h2 className="text-lg font-medium text-white truncate">
              {featured.name}
            </h2>
            {featured.description && (
              <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
                {featured.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3">
              {featured.view_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                  </svg>
                  {featured.view_count}
                </span>
              )}
              {featured.like_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0h-.002z" />
                  </svg>
                  {featured.like_count}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 justify-end">
            <Link
              href={`/share/${featured.id}`}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {t("explore.featuredView")}
            </Link>
            <button
              onClick={handleRemix}
              disabled={remixing}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {remixing ? t("explore.remixing") : t("explore.featuredRemix")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
