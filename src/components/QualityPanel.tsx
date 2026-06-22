"use client";

import { useState, useMemo, useCallback } from "react";
import type { CheckStatus } from "@/lib/quality";
import { analyzeQuality } from "@/lib/quality";

interface QualityPanelProps {
  animationData: object | null;
  onSuggestionClick?: (suggestion: string) => void;
}

const statusColors: Record<CheckStatus, string> = {
  pass: "text-emerald-400",
  warn: "text-yellow-400",
  fail: "text-red-400",
};

const statusBgColors: Record<CheckStatus, string> = {
  pass: "bg-emerald-500/20 border-emerald-500/30",
  warn: "bg-yellow-500/20 border-yellow-500/30",
  fail: "bg-red-500/20 border-red-500/30",
};

const statusIcons: Record<CheckStatus, string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
};

export default function QualityPanel({ animationData, onSuggestionClick }: QualityPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if (!animationData) return null;
    const json = JSON.stringify(animationData);
    return analyzeQuality(animationData as Record<string, unknown>, json);
  }, [animationData]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    onSuggestionClick?.(suggestion);
  }, [onSuggestionClick]);

  if (!result) return null;

  return (
    <div className="relative">
      {/* Badge */}
      <button
        onClick={() => setExpanded((v) => !v)}
        title={`Quality: ${result.score}/100`}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${statusBgColors[result.status]} hover:opacity-80`}
      >
        <span className={statusColors[result.status]}>{statusIcons[result.status]}</span>
        <span className="text-zinc-200">{result.score}</span>
      </button>

      {/* Expandable panel */}
      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${statusColors[result.status]}`}>
                {result.score}
              </span>
              <span className="text-xs text-zinc-400">/100 Quality Score</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Checks */}
          <div className="divide-y divide-zinc-700/50">
            {result.checks.map((check) => (
              <div key={check.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm ${statusColors[check.status]}`}>
                    {statusIcons[check.status]}
                  </span>
                  <span className="text-sm font-medium text-zinc-200">
                    {check.label}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    {check.score}/100
                  </span>
                </div>
                <p className="text-xs text-zinc-400 ml-5">{check.detail}</p>
                {check.suggestion && (
                  <button
                    onClick={() => handleSuggestionClick(check.suggestion!)}
                    className="mt-1.5 ml-5 text-xs text-blue-400 hover:text-blue-300 transition-colors text-left hover:underline"
                  >
                    💡 {check.suggestion}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
