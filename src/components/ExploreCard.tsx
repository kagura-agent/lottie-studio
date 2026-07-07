"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

function truncatePrompt(text: string, maxLen: number = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

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
    creation_prompt?: string | null;
    remix_count?: number;
    remixed_from?: string | null;
    remixed_from_name?: string | null;
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
  const { user } = useAuth();
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [hovering, setHovering] = useState(false);
  const [animLoaded, setAnimLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(animation.like_count ?? 0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const t = useTranslations();
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/animations/${animation.id}/like`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setLiked(data.liked);
          setLikeCount(data.likeCount);
        }
      })
      .catch(() => {});
  }, [animation.id]);

  useEffect(() => {
    if (!hovering || !lottieContainerRef.current) return;

    let cancelled = false;

    fetch(`/api/animations/${animation.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !lottieContainerRef.current || !json.data) return;
        try {
          animRef.current = lottie.loadAnimation({
            container: lottieContainerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json.data,
          });
          setAnimLoaded(true);
        } catch {
          // Lottie load failed — keep showing thumbnail
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      setAnimLoaded(false);
    };
  }, [hovering, animation.id]);

  const handleMouseEnter = useCallback(() => setHovering(true), []);
  const handleMouseLeave = useCallback(() => setHovering(false), []);

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
    [animation.id, remixing, router, toast]
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
    [animation.id, animation.name, toast]
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

      if (!user) {
        router.push("/login");
        return;
      }

      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 300);

      try {
        const res = await fetch(`/api/animations/${animation.id}/like`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setLiked(data.liked);
          setLikeCount(data.likeCount);
        } else {
          setLiked(wasLiked);
          setLikeCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
        }
      } catch {
        setLiked(wasLiked);
        setLikeCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
      }
    },
    [animation.id, liked, user, router]
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {(!hovering || !animLoaded) && (
          <img
            src={`/api/animations/${animation.id}/thumbnail`}
            alt={animation.name}
            className="w-full h-full object-contain p-4"
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ display: imgError ? "none" : undefined }}
          />
        )}

        {hovering && (
          <div
            ref={lottieContainerRef}
            className={`absolute inset-0 p-4 ${animLoaded ? "" : "pointer-events-none"}`}
          />
        )}

        {hovering && !animLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}

        {imgError && !hovering && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            {t('common.failedToLoad')}
          </div>
        )}

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

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-black/60 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleRemix}
            disabled={remixing}
            aria-label="Remix animation"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">{"✨"}</span>
            {remixing ? t('explore.remixing') : t('explore.remix')}
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download animation as JSON"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">{"⬇️"}</span>
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
        {animation.remixed_from && animation.remixed_from_name && (
          <Link
            href={`/editor/${animation.remixed_from}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block text-[11px] text-zinc-500 hover:text-zinc-300 truncate transition-colors"
          >
            {t('explore.remixedFrom', { name: animation.remixed_from_name })}
          </Link>
        )}
        {animation.description && (
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
            {animation.description}
          </p>
        )}
        {animation.creation_prompt && (
          <p
            className="mt-1 text-xs text-zinc-500 italic truncate"
            title={animation.creation_prompt}
          >
            {truncatePrompt(animation.creation_prompt)}
          </p>
        )}
        {animation.creation_prompt && (
          <Link
            href={`/editor/new?prompt=${encodeURIComponent(animation.creation_prompt)}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
          >
            {t('explore.tryThis')} {"✨"}
          </Link>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
          {frames && <span>{frames}</span>}
          {layers && <span>{layers}</span>}
          {views && <span>{views}</span>}
          {(animation.remix_count ?? 0) > 0 && (
            <span title={t('explore.remixCount', { count: animation.remix_count! })}>
              {"🔀 "}{animation.remix_count}
            </span>
          )}
          <button
            onClick={handleLike}
            aria-label={liked ? t('explore.liked') : t('explore.like')}
            className={`ml-auto flex items-center gap-1 transition-all duration-200 ${liked ? "text-red-500" : "text-zinc-500 hover:text-red-400"} ${likeAnimating ? "scale-125" : "scale-100"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5 transition-all duration-200"
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
