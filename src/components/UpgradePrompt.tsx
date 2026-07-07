"use client";

import Link from "next/link";

interface UpgradePromptProps {
  apiCallPercent: number;
  generationPercent: number;
  tier: string;
}

export default function UpgradePrompt({
  apiCallPercent,
  generationPercent,
  tier,
}: UpgradePromptProps) {
  if (tier !== "free" && tier !== "pro") return null;

  const approaching = apiCallPercent >= 0.8 || generationPercent >= 0.8;
  if (!approaching) return null;

  const resource = generationPercent > apiCallPercent ? "generations" : "API calls";
  const percent = Math.round(Math.max(apiCallPercent, generationPercent) * 100);

  return (
    <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <svg
          className="w-5 h-5 text-amber-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p className="text-sm text-amber-200">
          You&apos;ve used <span className="font-medium">{percent}%</span> of your daily{" "}
          {resource} limit.{" "}
          {tier === "free" ? "Upgrade to Pro for higher limits." : "Upgrade to Team for higher limits."}
        </p>
      </div>
      <Link
        href="/pricing"
        className="shrink-0 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Upgrade
      </Link>
    </div>
  );
}
