"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import { useTranslations } from 'next-intl';

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
  onPreview?: (lottieJson: object, versionNum: number) => void;
  onExitPreview?: () => void;
  previewingVersion?: number | null;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
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

    async function mountAnimation(animationData: object) {
      if (!containerRef.current || cancelled) return;
      try {
        animInstanceRef.current = await loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
        if (!cancelled) setStatus("loaded");
      } catch {
        if (!cancelled) setStatus("error");
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
      <div ref={containerRef} className="w-full h-full" />
      {(status === "idle" || status === "loading") && (
        <div className="absolute inset-0 bg-zinc-700/50 animate-pulse rounded-lg" />
      )}
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

function DiffPlayer({
  animationData,
  versionNum,
  triggerMessage,
}: {
  animationData: object;
  versionNum: number;
  triggerMessage: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      try {
        animRef.current = await loadAnimation({
          container: el,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [animationData]);

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <span className="text-xs font-mono text-zinc-400">v{versionNum}</span>
      <div className="w-full aspect-square bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      {triggerMessage && (
        <p className="text-xs text-zinc-400 text-center line-clamp-2 max-w-full px-2">
          {triggerMessage}
        </p>
      )}
    </div>
  );
}

function CompareModal({
  animationId,
  versions,
  selectedVersions,
  cache,
  onClose,
}: {
  animationId: string;
  versions: Version[];
  selectedVersions: [number, number];
  cache: React.MutableRefObject<Map<number, object | "error">>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [leftData, setLeftData] = useState<object | null>(null);
  const [rightData, setRightData] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);

  const [leftNum, rightNum] = selectedVersions[0] < selectedVersions[1]
    ? [selectedVersions[0], selectedVersions[1]]
    : [selectedVersions[1], selectedVersions[0]];

  const leftVersion = versions.find(v => v.version_num === leftNum);
  const rightVersion = versions.find(v => v.version_num === rightNum);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersion(num: number): Promise<object | null> {
      const cached = cache.current.get(num);
      if (cached && cached !== "error") return cached;
      try {
        const res = await fetch(`/api/animations/${animationId}/versions/${num}`);
        if (!res.ok) return null;
        const data = await res.json();
        cache.current.set(num, data.lottie_json);
        return data.lottie_json;
      } catch {
        return null;
      }
    }

    (async () => {
      const [l, r] = await Promise.all([
        fetchVersion(leftNum),
        fetchVersion(rightNum),
      ]);
      if (!cancelled) {
        setLeftData(l);
        setRightData(r);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [animationId, leftNum, rightNum, cache]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('versionHistory.compareTitle')}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-zinc-100 text-base font-semibold">
            {t('versionHistory.compareTitle')}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {t('versionHistory.exitCompare')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
              {t('common.loading')}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              {leftData && leftVersion && (
                <DiffPlayer
                  animationData={leftData}
                  versionNum={leftNum}
                  triggerMessage={leftVersion.trigger_message}
                />
              )}
              {rightData && rightVersion && (
                <DiffPlayer
                  animationData={rightData}
                  versionNum={rightNum}
                  triggerMessage={rightVersion.trigger_message}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VersionHistory({
  animationId,
  open,
  onClose,
  onPreview,
  onExitPreview,
  previewingVersion,
}: VersionHistoryProps) {
  const t = useTranslations();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const lottieCache = useRef<Map<number, object | "error">>(new Map());
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<number[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

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

  // Reset compare state when dialog closes (render-phase transition check)
  if (prevOpen && !open) {
    setCompareMode(false);
    setCompareSelection([]);
    setShowDiff(false);
  }
  if (open !== prevOpen) setPrevOpen(open);

  // Clear lottie cache in effect (refs cannot be accessed during render)
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
        lottieCache.current.clear();
        onExitPreview?.();
        await fetchVersions();
      }
    } catch {
      // ignore
    } finally {
      setRestoring(null);
    }
  };

  const handleVersionClick = async (v: Version, idx: number) => {
    if (compareMode) {
      setCompareSelection((prev) => {
        if (prev.includes(v.version_num)) {
          return prev.filter((n) => n !== v.version_num);
        }
        if (prev.length >= 2) {
          return [prev[1], v.version_num];
        }
        return [...prev, v.version_num];
      });
      return;
    }

    if (idx === 0) return;

    const cached = lottieCache.current.get(v.version_num);
    if (cached && cached !== "error") {
      onPreview?.(cached, v.version_num);
      return;
    }

    try {
      const res = await fetch(
        `/api/animations/${animationId}/versions/${v.version_num}`
      );
      if (res.ok) {
        const data = await res.json();
        lottieCache.current.set(v.version_num, data.lottie_json);
        onPreview?.(data.lottie_json, v.version_num);
      }
    } catch {
      // ignore
    }
  };

  const handleCompareToggle = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareSelection([]);
    } else {
      onExitPreview?.();
      setCompareMode(true);
      setCompareSelection([]);
    }
  };

  const handleOpenDiff = () => {
    if (compareSelection.length === 2) {
      setShowDiff(true);
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
      <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col shadow-2xl" role="dialog" aria-modal="true" aria-label="Version history">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            {t('versionHistory.title')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCompareToggle}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                compareMode
                  ? "bg-indigo-600/40 text-indigo-300 border border-indigo-500/50"
                  : "border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('versionHistory.compare')}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label="Close version history"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compare instructions / action bar */}
        {compareMode && (
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-800/50 flex items-center justify-between shrink-0">
            <span className="text-xs text-zinc-400">
              {compareSelection.length < 2
                ? t('versionHistory.selectTwo')
                : `v${Math.min(...compareSelection)} vs v${Math.max(...compareSelection)}`}
            </span>
            {compareSelection.length === 2 && (
              <button
                onClick={handleOpenDiff}
                className="px-2.5 py-1 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                {t('versionHistory.compare')}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              {t('common.loading')}
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm px-4 text-center">
              {t('versionHistory.noVersions')}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {versions.map((v, idx) => {
                const isPreviewing = previewingVersion === v.version_num;
                const isCompareSelected = compareSelection.includes(v.version_num);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleVersionClick(v, idx)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isPreviewing
                        ? "bg-indigo-600/20 border-l-2 border-l-indigo-500"
                        : isCompareSelected
                        ? "bg-indigo-600/15 border-l-2 border-l-indigo-400"
                        : idx === 0
                        ? "bg-zinc-800/50"
                        : "hover:bg-zinc-800/30 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <VersionPreview
                        animationId={animationId}
                        versionNum={v.version_num}
                        cache={lottieCache}
                      />
                      <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-zinc-400">
                              v{v.version_num}
                            </span>
                            {idx === 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                                {t('versionHistory.current')}
                              </span>
                            )}
                            {isPreviewing && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium">
                                {t('versionHistory.preview')}
                              </span>
                            )}
                            {isCompareSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                                {t('versionHistory.selected')}
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
                        {idx !== 0 && !compareMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(v.version_num);
                            }}
                            disabled={restoring !== null}
                            className="shrink-0 px-2.5 py-1 rounded text-xs font-medium border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {restoring === v.version_num ? "..." : t('versionHistory.restore')}
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compare diff modal */}
      {showDiff && compareSelection.length === 2 && (
        <CompareModal
          animationId={animationId}
          versions={versions}
          selectedVersions={compareSelection as [number, number]}
          cache={lottieCache}
          onClose={() => setShowDiff(false)}
        />
      )}
    </>
  );
}
