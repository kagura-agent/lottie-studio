"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface Version {
  id: number;
  version_num: number;
  trigger_message: string | null;
  created_at: string;
}

interface VersionHistoryProps {
  animationId: string;
  open: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // SQLite stores UTC without Z
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Renders a small Lottie preview thumbnail for a single version entry.
 * Uses IntersectionObserver to lazy-load the Lottie JSON only when
 * the entry scrolls into view.
 */
function VersionPreview({
  animationId,
  versionNum,
  cache,
}: {
  animationId: string;
  versionNum: number;
  cache: React.MutableRefObject<Map<number, object | "error">>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animInstanceRef = useRef<AnimationItem | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          loadPreview();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);

    async function loadPreview() {
      // Check cache first
      const cached = cache.current.get(versionNum);
      if (cached === "error") {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cached) {
        if (!cancelled) mountAnimation(cached);
        return;
      }

      if (!cancelled) setStatus("loading");

      try {
        const res = await fetch(
          `/api/animations/${animationId}/versions/${versionNum}`
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const lottieJson = data.lottie_json;
        cache.current.set(versionNum, lottieJson);
        if (!cancelled) mountAnimation(lottieJson);
      } catch {
        cache.current.set(versionNum, "error");
        if (!cancelled) setStatus("error");
      }
    }

    function mountAnimation(animationData: object) {
      if (!containerRef.current || cancelled) return;
      try {
        animInstanceRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
        setStatus("loaded");
      } catch {
        setStatus("error");
      }
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }
    };
  }, [animationId, versionNum, cache]);

  return (
    <div className="relative w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] shrink-0 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/50">
      {/* Lottie container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Shimmer / skeleton loading state */}
      {(status === "idle" || status === "loading") && (
        <div className="absolute inset-0 bg-zinc-700/50 animate-pulse rounded-lg" />
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-zinc-600"
          >
            <path
              d="M8 5v3m0 2.5h.007M14 8A6 6 0 112 8a6 6 0 0112 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function VersionHistory({
  animationId,
  open,
  onClose,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const lottieCache = useRef<Map<number, object | "error">>(new Map());

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/animations/${animationId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [animationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching: setState is in an async callback, not synchronous in the effect body
    if (open) fetchVersions();
  }, [open, fetchVersions]);

  // Clear cache when panel closes so stale data doesn't persist across
  // unrelated opens (restoring a version changes content).
  useEffect(() => {
    if (!open) {
      lottieCache.current.clear();
    }
  }, [open]);

  const handleRestore = async (versionNum: number) => {
    setRestoring(versionNum);
    try {
      const res = await fetch(
        `/api/animations/${animationId}/versions/${versionNum}`,
        { method: "POST" }
      );
      if (res.ok) {
        // Invalidate cache since restore changes the version list
        lottieCache.current.clear();
        await fetchVersions();
      }
    } catch {
      // ignore
    } finally {
      setRestoring(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              Loading...
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm px-4 text-center">
              No versions yet. Versions are created when the AI modifies your
              animation.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`px-4 py-3 ${idx === 0 ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"} transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    {/* Lottie preview thumbnail */}
                    <VersionPreview
                      animationId={animationId}
                      versionNum={v.version_num}
                      cache={lottieCache}
                    />

                    {/* Text metadata + restore button */}
                    <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-400">
                            v{v.version_num}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                              Latest
                            </span>
                          )}
                        </div>
                        {v.trigger_message && (
                          <p className="text-sm text-zinc-300 mt-1 line-clamp-2">
                            {v.trigger_message}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">
                          {timeAgo(v.created_at)}
                        </p>
                      </div>
                      {idx !== 0 && (
                        <button
                          onClick={() => handleRestore(v.version_num)}
                          disabled={restoring !== null}
                          className="shrink-0 px-2.5 py-1 rounded text-xs font-medium border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {restoring === v.version_num ? "..." : "Restore"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
