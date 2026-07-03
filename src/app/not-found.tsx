"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("error");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-24 text-zinc-100">
      <div className="relative mb-10 select-none" aria-hidden="true">
        <svg
          viewBox="0 0 320 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-72 sm:w-80"
        >
          <style>{`
            @keyframes drift {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(-12px) rotate(2deg); }
            }
            @keyframes orbit {
              0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
              100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
            }
            @keyframes pulse-ring {
              0%, 100% { opacity: 0.08; r: 50; }
              50% { opacity: 0.18; r: 58; }
            }
            @keyframes flicker {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            .digit-group { animation: drift 5s ease-in-out infinite; transform-origin: center; }
            .orbit-dot { animation: orbit 8s linear infinite; transform-origin: 160px 90px; }
            .orbit-dot-2 { animation: orbit 12s linear infinite reverse; transform-origin: 160px 90px; }
            .pulse { animation: pulse-ring 4s ease-in-out infinite; }
            .flicker { animation: flicker 3s ease-in-out infinite; }
          `}</style>

          <circle className="pulse" cx="160" cy="90" r="50" stroke="#6366f1" strokeWidth="1" fill="none" />
          <circle cx="160" cy="90" r="70" stroke="#3f3f46" strokeWidth="0.5" fill="none" strokeDasharray="4 6" />

          <circle className="orbit-dot" cx="160" cy="90" r="3" fill="#818cf8" opacity="0.7" />
          <circle className="orbit-dot-2" cx="160" cy="90" r="2" fill="#a78bfa" opacity="0.5" />

          <g className="digit-group">
            <text x="160" y="100" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="64" fontWeight="700" fill="#e4e4e7" letterSpacing="-2">
              404
            </text>
            <text className="flicker" x="160" y="100" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="64" fontWeight="700" fill="#6366f1" opacity="0.15" letterSpacing="-2">
              404
            </text>
          </g>

          <line x1="80" y1="130" x2="240" y2="130" stroke="#27272a" strokeWidth="1" />
          <circle cx="100" cy="130" r="2" fill="#3f3f46" />
          <circle cx="220" cy="130" r="2" fill="#3f3f46" />
        </svg>
      </div>

      <h1 className="mb-3 text-center font-[family-name:var(--font-geist-mono)] text-2xl font-semibold tracking-tight text-zinc-100">
        {t("notFoundTitle")}
      </h1>
      <p className="mb-10 max-w-md text-center text-sm leading-relaxed text-zinc-400">
        {t("notFoundDescription")}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/explore"
          className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          {t("backToGallery")}
        </Link>
        <Link
          href="/editor/new"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        >
          {t("createNew")}
        </Link>
      </div>
    </div>
  );
}
