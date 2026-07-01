"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface TemplateDetail extends TemplateItem {
  lottieJson: object;
}

function TemplatePreviewCard({ template }: { template: TemplateItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [lottieData, setLottieData] = useState<object | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/templates/${template.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: TemplateDetail) => {
        if (cancelled) return;
        setLottieData(data.lottieJson);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [template.id]);

  useEffect(() => {
    if (!containerRef.current || !lottieData) return;

    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: lottieData,
      });
    } catch {
      queueMicrotask(() => setError(true));
    }

    return () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [lottieData]);

  const handleRemix = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (creating || !lottieData) return;
    setCreating(true);

    try {
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `My ${template.name}`,
          data: lottieData,
          templateName: template.name,
          templateDesc: template.description,
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
    Decorative: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  };

  const categoryClass =
    categoryColors[template.category] ||
    "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  return (
    <div className="group relative rounded-xl border border-zinc-700/60 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 overflow-hidden transition-all hover:border-zinc-500 hover:shadow-lg hover:shadow-zinc-900/50">
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
        {!lottieData && !error && (
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

      {/* Info area */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
              {template.name}
            </h3>
            <span
              className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border ${categoryClass}`}
            >
              {template.category}
            </span>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-2">
            {template.description}
          </p>
        </div>

        <button
          onClick={handleRemix}
          disabled={creating || !lottieData}
          className="w-full px-3 py-2 rounded-lg bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          aria-label={`Remix ${template.name}`}
        >
          {creating ? (
            <>
              <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Remix
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function TemplateGallery() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-700/60 bg-zinc-800/50 animate-pulse aspect-square"
          />
        ))}
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map((template) => (
        <TemplatePreviewCard key={template.id} template={template} />
      ))}
    </div>
  );
}
