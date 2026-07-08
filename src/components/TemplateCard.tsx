"use client";

import { useEffect, useRef, useState } from "react";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";
import { useTranslations } from 'next-intl';

interface TemplateCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
}

export default function TemplateCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface requires id for key prop usage by parent
  id: _id,
  name,
  description,
  category,
  file,
}: TemplateCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const animDataRef = useRef<object | null>(null);
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    fetch(`/templates/${file}`)
      .then((res) => res.json())
      .then(async (json) => {
        if (cancelled || !containerRef.current) return;

        animDataRef.current = json;

        try {
          const anim = await loadAnimation({
            container: containerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json,
          });
          if (cancelled) {
            anim.destroy();
          } else {
            animRef.current = anim;
            setLoaded(true);
          }
        } catch {
          if (!cancelled) setError(true);
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
  }, [file]);

  const handleUseTemplate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (creating || !animDataRef.current) return;
    setCreating(true);

    try {
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `My ${name}`,
          data: animDataRef.current,
          templateName: name,
          templateDesc: description,
        }),
      });

      if (!res.ok) throw new Error("Failed to create animation");
      const result = await res.json();
      router.push(`/editor/${result.id}`);
    } catch {
      setCreating(false);
    }
  };

  const categoryColors: Record<string, string> = {
    Motion: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Rotation: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Scale: "bg-red-500/20 text-red-400 border-red-500/30",
    Looping: "bg-green-500/20 text-green-400 border-green-500/30",
    Opacity: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Multi-layer": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  };

  const categoryClass =
    categoryColors[category] ||
    "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  return (
    <div className="group relative rounded-xl border border-zinc-700/60 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 overflow-hidden transition-all hover:border-zinc-500 hover:shadow-lg hover:shadow-zinc-900/50">
      {/* Template badge */}
      <div className="absolute top-2 left-2 z-10">
        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-700/80 text-zinc-300 rounded backdrop-blur-sm">
          {t('templateCard.template')}
        </span>
      </div>

      {/* Preview area */}
      <div
        className="relative aspect-square flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1a1f 25%, transparent 25%), linear-gradient(-45deg, #1a1a1f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1f 75%), linear-gradient(-45deg, transparent 75%, #1a1a1f 75%)",
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
      </div>

      {/* Info area */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
              {name}
            </h3>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${categoryClass}`}
            >
              {category}
            </span>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-1">{description}</p>
        </div>

        <button
          onClick={handleUseTemplate}
          disabled={creating || !loaded}
          className="w-full px-3 py-2 rounded-lg bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          aria-label={`Use ${name} as starter template`}
        >
          {creating ? (
            <>
              <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
              {t('common.creating')}
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {t('templateCard.useAsStarter')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
