"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-24 text-zinc-100">
      <div className="relative mb-10 select-none" aria-hidden="true">
        <svg
          viewBox="0 0 280 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-64 sm:w-72"
        >
          <style>{`
            @keyframes shatter-1 {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              15% { transform: translate(-3px, -2px) rotate(-1deg); }
              30% { transform: translate(0, 0) rotate(0deg); }
            }
            @keyframes shatter-2 {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              15% { transform: translate(4px, -1px) rotate(1.5deg); }
              30% { transform: translate(0, 0) rotate(0deg); }
            }
            @keyframes shatter-3 {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              15% { transform: translate(-2px, 3px) rotate(-0.5deg); }
              30% { transform: translate(0, 0) rotate(0deg); }
            }
            @keyframes glitch-line {
              0%, 100% { transform: scaleX(0); opacity: 0; }
              10% { transform: scaleX(1); opacity: 0.6; }
              20% { transform: scaleX(0); opacity: 0; }
            }
            @keyframes warning-pulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
            .shard-1 { animation: shatter-1 4s ease-in-out infinite; transform-origin: center; }
            .shard-2 { animation: shatter-2 4s ease-in-out infinite 0.1s; transform-origin: center; }
            .shard-3 { animation: shatter-3 4s ease-in-out infinite 0.2s; transform-origin: center; }
            .glitch { animation: glitch-line 4s ease-in-out infinite; transform-origin: left; }
            .glitch-2 { animation: glitch-line 4s ease-in-out infinite 0.15s; transform-origin: left; }
            .warn-pulse { animation: warning-pulse 2s ease-in-out infinite; }
          `}</style>

          <g className="shard-1">
            <polygon points="100,40 140,35 145,90 95,85" fill="#18181b" stroke="#ef4444" strokeWidth="0.8" opacity="0.8" />
          </g>
          <g className="shard-2">
            <polygon points="140,35 185,42 180,95 145,90" fill="#18181b" stroke="#f87171" strokeWidth="0.8" opacity="0.7" />
          </g>
          <g className="shard-3">
            <polygon points="95,85 145,90 140,140 90,135" fill="#18181b" stroke="#ef4444" strokeWidth="0.8" opacity="0.6" />
          </g>
          <g className="shard-2">
            <polygon points="145,90 180,95 175,145 140,140" fill="#18181b" stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
          </g>

          <rect className="glitch" x="60" y="72" width="160" height="1" fill="#ef4444" opacity="0.5" rx="0.5" />
          <rect className="glitch-2" x="70" y="110" width="140" height="1" fill="#f87171" opacity="0.4" rx="0.5" />

          <text className="warn-pulse" x="140" y="98" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="20" fontWeight="600" fill="#f87171" letterSpacing="6">
            ERR
          </text>

          <circle cx="140" cy="155" r="8" stroke="#3f3f46" strokeWidth="1" fill="none" />
          <text x="140" y="159" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#71717a">!</text>
        </svg>
      </div>

      <h1 className="mb-3 text-center font-[family-name:var(--font-geist-mono)] text-2xl font-semibold tracking-tight text-zinc-100">
        {t("runtimeTitle")}
      </h1>
      <p className="mb-10 max-w-md text-center text-sm leading-relaxed text-zinc-400">
        {t("runtimeDescription")}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          {t("tryAgain")}
        </button>
        <Link
          href="/explore"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        >
          {t("backToGallery")}
        </Link>
      </div>
    </div>
  );
}
