"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import lottie, { AnimationItem } from "lottie-web";
import { apiFetch } from "@/lib/apiFetch";
import { exportToGif } from "@/lib/gifExporter";
import { exportToVideo, getVideoExtension } from "@/lib/videoExporter";
import { exportToMp4, isMP4ExportSupported, formatFileSize } from "@/lib/mp4Exporter";

const EXAMPLE_PROMPTS = [
  "Loading spinner",
  "Bouncing ball",
  "Fade-in text",
];

export default function QuickGenerate() {
  const t = useTranslations("quickGenerate");
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error" | "rateLimited">("idle");
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refineCount, setRefineCount] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const [webmProgress, setWebmProgress] = useState<number | null>(null);
  const [mp4Progress, setMp4Progress] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Render lottie animation when data is available
  useEffect(() => {
    if (!containerRef.current || !animationData) return;
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: !reducedMotion,
        autoplay: !reducedMotion,
        animationData,
      });
    } catch {
      // invalid data
    }
    return () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [animationData, reducedMotion]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setStatus("generating");
    setAnimationData(null);
    setErrorMessage("");

    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), width: 300, height: 300 }),
      });

      if (res.status === 429) {
        setStatus("rateLimited");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(t("error"));
        return;
      }

      const data = await res.json();
      if (data.success && data.animation) {
        setAnimationData(data.animation);
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMessage(t("error"));
      }
    } catch {
      setStatus("error");
      setErrorMessage(t("error"));
    }
  }, [prompt, t]);

  const handleOpenInEditor = useCallback(async () => {
    if (!animationData) return;
    try {
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prompt.trim(), data: animationData }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/editor/${id}`);
      }
    } catch {
      // navigation failed silently
    }
  }, [animationData, prompt, router]);

  const handleTryAnother = useCallback(() => {
    setStatus("idle");
    setAnimationData(null);
    setPrompt("");
    setErrorMessage("");
    setRefinePrompt("");
    setRefineCount(0);
    setIsRefining(false);
  }, []);

  const handleRefine = useCallback(async () => {
    if (!refinePrompt.trim() || !animationData || isRefining) return;
    setIsRefining(true);

    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: refinePrompt.trim(),
          currentAnimation: animationData,
          width: 300,
          height: 300,
        }),
      });

      if (res.status === 429) {
        setStatus("rateLimited");
        setIsRefining(false);
        return;
      }

      if (!res.ok) {
        setIsRefining(false);
        return;
      }

      const data = await res.json();
      if (data.success && data.animation) {
        setAnimationData(data.animation);
        setRefineCount((c) => c + 1);
        setRefinePrompt("");
      }
    } catch {
      // Refinement failed silently
    } finally {
      setIsRefining(false);
    }
  }, [refinePrompt, animationData, isRefining]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2000);
  }, []);

  const handleDownloadJson = useCallback(() => {
    if (!animationData) return;
    const json = JSON.stringify(animationData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "animation";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [animationData, prompt]);

  const handleCopyJson = useCallback(async () => {
    if (!animationData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(animationData, null, 2));
      showToast(t("copied"));
    } catch {
      // clipboard failed silently
    }
  }, [animationData, showToast, t]);

  const handleShareLink = useCallback(async () => {
    if (!animationData) return;
    try {
      const res = await apiFetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prompt.trim(), data: animationData }),
      });
      if (res.ok) {
        const { id } = await res.json();
        const shareUrl = `${window.location.origin}/share/${id}`;
        await navigator.clipboard.writeText(shareUrl);
        showToast(t("linkCopied"));
      }
    } catch {
      // share failed silently
    }
  }, [animationData, prompt, showToast, t]);

  const triggerDownload = useCallback((blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "animation";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [prompt]);

  const handleExportGif = useCallback(async () => {
    if (!animationData || gifProgress !== null) return;
    setGifProgress(0);
    try {
      const blob = await exportToGif({
        animationData,
        onProgress: (p) => setGifProgress(Math.round(p * 100)),
      });
      triggerDownload(blob, "gif");
    } catch {
      showToast(t("exportError"));
    } finally {
      setGifProgress(null);
    }
  }, [animationData, gifProgress, triggerDownload, showToast, t]);

  const handleExportWebm = useCallback(async () => {
    if (!animationData || webmProgress !== null) return;
    setWebmProgress(0);
    try {
      const blob = await exportToVideo({
        animationData,
        onProgress: (p) => setWebmProgress(Math.round(p * 100)),
      });
      triggerDownload(blob, getVideoExtension());
    } catch {
      showToast(t("exportError"));
    } finally {
      setWebmProgress(null);
    }
  }, [animationData, webmProgress, triggerDownload, showToast, t]);

  const handleExportMp4 = useCallback(async () => {
    if (!animationData || mp4Progress !== null) return;
    if (!isMP4ExportSupported()) {
      showToast("MP4 export requires Chrome 94+ or Edge 94+");
      return;
    }
    setMp4Progress(0);
    try {
      const blob = await exportToMp4({
        animationData,
        onProgress: (p) => setMp4Progress(Math.round(p * 100)),
      });
      triggerDownload(blob, "mp4");
      showToast(`MP4 exported (${formatFileSize(blob.size)})`);
    } catch {
      showToast(t("exportError"));
    } finally {
      setMp4Progress(null);
    }
  }, [animationData, mp4Progress, triggerDownload, showToast, t]);

  const handleChipClick = useCallback((example: string) => {
    setPrompt(example);
  }, []);

  return (
    <section className="relative my-12 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 shadow-[0_0_40px_-12px_rgba(139,92,246,0.15)]">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600/5 via-transparent to-violet-600/5 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <h2 className="text-xl font-semibold text-zinc-100 mb-1">
          {t("title")}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          {t("subtitle")}
        </p>

        {/* Input area */}
        <div className="w-full max-w-xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && status !== "generating") {
                  handleGenerate();
                }
              }}
              placeholder={t("placeholder")}
              disabled={status === "generating"}
              className="flex-1 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || status === "generating"}
              className="px-5 py-3 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {status === "generating" ? t("generating") : t("generate")}
            </button>
          </div>

          {/* Example chips */}
          {status === "idle" && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  onClick={() => handleChipClick(example)}
                  className="px-3 py-1 rounded-full border border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading state */}
        {status === "generating" && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="w-[300px] h-[300px] max-w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">{t("generating")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Animation preview */}
        {status === "done" && animationData && (
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div
                ref={containerRef}
                className="w-[300px] h-[300px] max-w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 overflow-hidden"
              />
              {/* Spinner overlay during refinement */}
              {isRefining && (
                <div className="absolute inset-0 rounded-xl bg-zinc-900/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                    <p className="text-xs text-zinc-400">{t("refining")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Refinement input */}
            {refineCount < 3 ? (
              <div className="w-full max-w-md">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isRefining) {
                        handleRefine();
                      }
                    }}
                    placeholder={t("refinePlaceholder")}
                    disabled={isRefining}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={!refinePrompt.trim() || isRefining}
                    className="px-4 py-2 rounded-lg bg-violet-600/80 text-white text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isRefining ? t("refining") : t("refine")}
                  </button>
                </div>
                {refineCount > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("refineCount", { count: refineCount })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                <button
                  onClick={handleOpenInEditor}
                  className="text-violet-400 hover:text-violet-300 underline transition-colors"
                >
                  {t("maxRefinements")}
                </button>
              </p>
            )}

            {/* Quick export actions */}
            <div className="flex gap-3 relative">
              <button
                onClick={handleDownloadJson}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t("downloadJson")}
              </button>
              <button
                onClick={handleCopyJson}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t("copyJson")}
              </button>
              <button
                onClick={handleExportGif}
                disabled={gifProgress !== null}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gifProgress !== null ? t("gifProgress", { progress: gifProgress }) : t("exportGif")}
              </button>
              <button
                onClick={handleExportWebm}
                disabled={webmProgress !== null}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {webmProgress !== null ? t("webmProgress", { progress: webmProgress }) : t("exportWebm")}
              </button>
              <button
                onClick={handleExportMp4}
                disabled={mp4Progress !== null}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mp4Progress !== null ? t("mp4Progress", { progress: mp4Progress }) : t("exportMp4")}
              </button>
              <button
                onClick={handleShareLink}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t("shareLink")}
              </button>
              {toastMessage && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-zinc-700 text-zinc-100 text-xs whitespace-nowrap animate-pulse">
                  {toastMessage}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleOpenInEditor}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
              >
                {t("openInEditor")}
              </button>
              <button
                onClick={handleTryAnother}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t("tryAnother")}
              </button>
            </div>
          </div>
        )}

        {/* Rate limit error */}
        {status === "rateLimited" && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-200 text-sm">
            {t("rateLimited")}
          </div>
        )}

        {/* Generic error */}
        {status === "error" && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 text-sm">
            {errorMessage || t("error")}
          </div>
        )}
      </div>
    </section>
  );
}
