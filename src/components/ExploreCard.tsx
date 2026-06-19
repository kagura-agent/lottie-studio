"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [remixing, setRemixing] = useState(false);

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
        alert("Failed to remix animation. Please try again.");
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
        alert("Failed to download animation. Please try again.");
      }
    },
    [animation.id, animation.name]
  );

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

        {/* Quick-action buttons */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-black/60 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleRemix}
            disabled={remixing}
            aria-label="Remix animation"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">✨</span>
            {remixing ? "Remixing…" : "Remix"}
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download animation as JSON"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <span aria-hidden="true">⬇️</span>
            Download
          </button>
        </div>
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
