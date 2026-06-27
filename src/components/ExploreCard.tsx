"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { useToast } from "@/contexts/ToastContext";

interface ExploreCardProps {
  animation: {
    id: string;
    name: string;
    description?: string | null;
    frame_count: number | null;
    layer_count: number | null;
    w: number | null;
    h: number | null;
    view_count?: number;
    like_count?: number;
    creator_id?: string | null;
  };
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  isOwnAnimation?: boolean;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

export default function ExploreCard({ animation, isFavorite, onToggleFavorite, isOwnAnimation }: ExploreCardProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [liked, setLiked] = useState(() => {
    if (typeof window !== "undefined") {
      const likedIds = JSON.parse(localStorage.getItem("likedAnimations") || "[]");
      return likedIds.includes(animation.id);
    }
    return false;
  });
  const [likeCount, setLikeCount] = useState(animation.like_count ?? 0);
  const t = useTranslations();
  const { toast } = useToast();

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

  const handleRemix = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (remixing) return;
      setRemixing(true);
      try {
        const res = await fetch(`/api/animations/${animation.id}/remix`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Remix failed");
        const data = await res.json();
        router.push(`/editor/${data.id}`);
      } catch {
        toast({ message: "Failed to remix animation. Please try again.", type: "error" });
      } finally {
        setRemixing(false);
      }
    },
    [animation.id, remixing, router]
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const res = await fetch(`/api/animations/${animation.id}`);
        if (!res.ok) throw new Error("Download failed");
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json.data)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${animation.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        toast({ message: "Failed to download animation. Please try again.", type: "error" });
      }
    },
    [animation.id, animation.name]
  );

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleFavorite?.(animation.id);
    },
    [animation.id, onToggleFavorite]
  );

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (liked) return;
      setLiked(true);
      setLikeCount((c) => c + 1);
      // Persist to localStorage
      const likedIds = JSON.parse(localStorage.getItem("likedAnimations") || "[]");
      if (!likedIds.includes(animation.id)) {
        likedIds.push(animation.id);
        localStorage.setItem("likedAnimations", JSON.stringify(likedIds));
      }
      try {
        const res = await fetch(`/api/animations/${animation.id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setLikeCount(data.like_count);
        }
      } catch {
        // Keep optimistic UI state
      }
    },
    [animation.id, liked]
  );

  const frames =
    animation.frame_count != null ? t('animationCard.frames', { count: animation.frame_count }) : null;
  const layers =
    animation.layer_count != null
      ? `${animation.layer_count} layer${animation.layer_count === 1 ? '' : 's'}`
      : null;
  const views =
    animation.view_count != null && animation.view_count > 0
      ? t('explore.views', { count: formatViewCount(animation.view_count) })
      : null;
  const likes = likeCount > 0 ? formatViewCount(likeCount) : null;

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
            {t('common.failedToLoad')}
          </div>
        )}

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={handleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-zinc-700/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className={`w-5 h-5 transition-transform active:scale-125 ${isFavorite ? "text-red-500" : "text-zinc-300"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        )}

        {/* Quick-action buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-black/60 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleRemix}
            disabled={remixing}
            aria-label="Remix animation"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">✨</span>
            {remixing ? t('explore.remixing') : t('explore.remix')}
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download animation as JSON"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">⬇️</span>
            {"Download"}
          </button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
          {animation.name}
          {isOwnAnimation && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25">
              By you
            </span>
          )}
        </h3>
        {animation.description && (
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
            {animation.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
          {frames && <span>{frames}</span>}
          {layers && <span>{layers}</span>}
          {views && <span>{views}</span>}
          <button
            onClick={handleLike}
            aria-label={liked ? t('explore.liked') : t('explore.like')}
            className={`ml-auto flex items-center gap-1 transition-colors ${liked ? "text-red-500" : "text-zinc-500 hover:text-red-400"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            {likes && <span>{likes}</span>}
          </button>
        </div>
      </div>
    </Link>
  );
}
