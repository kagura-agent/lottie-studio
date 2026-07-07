"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/auth/UserMenu";
import UpgradePrompt from "@/components/UpgradePrompt";

interface UsageData {
  tier: string;
  today: { apiCalls: number; generations: number };
  limits: { apiCallsPerDay: number; generationsPerDay: number };
}

interface HistoryEntry {
  date: string;
  api_calls: number;
  generations: number;
  total_tokens: number;
}

export default function UsageDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoadingData(true);
      try {
        const [usageRes, historyRes] = await Promise.all([
          fetch("/api/usage"),
          fetch("/api/usage/history?days=30"),
        ]);
        if (cancelled) return;
        if (usageRes.ok) setUsage(await usageRes.json());
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(data.history);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoadingData(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  const tierLabel = usage?.tier
    ? usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1)
    : "Free";

  const apiPercent = usage
    ? Math.min(100, (usage.today.apiCalls / usage.limits.apiCallsPerDay) * 100)
    : 0;
  const genPercent = usage
    ? Math.min(100, (usage.today.generations / usage.limits.generationsPerDay) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              &larr; Back to profile
            </Link>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-8">Usage & Billing</h1>

        {loadingData ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current tier */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm text-zinc-400 mb-1">Current plan</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white">{tierLabel}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        usage?.tier === "pro"
                          ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                          : usage?.tier === "team"
                          ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      {tierLabel}
                    </span>
                  </div>
                </div>
                {usage?.tier === "free" && (
                  <Link
                    href="/pricing"
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </div>

            {/* Upgrade prompt */}
            {usage && (apiPercent >= 80 || genPercent >= 80) && (
              <UpgradePrompt
                apiCallPercent={apiPercent / 100}
                generationPercent={genPercent / 100}
                tier={usage.tier}
              />
            )}

            {/* Today's usage */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">
                Today&apos;s usage
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-zinc-400">API calls</span>
                    <span className="text-zinc-300">
                      {usage?.today.apiCalls.toLocaleString()} /{" "}
                      {usage?.limits.apiCallsPerDay.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        apiPercent >= 90
                          ? "bg-red-500"
                          : apiPercent >= 80
                          ? "bg-amber-500"
                          : "bg-violet-500"
                      }`}
                      style={{ width: `${apiPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-zinc-400">Generations</span>
                    <span className="text-zinc-300">
                      {usage?.today.generations.toLocaleString()} /{" "}
                      {usage?.limits.generationsPerDay.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        genPercent >= 90
                          ? "bg-red-500"
                          : genPercent >= 80
                          ? "bg-amber-500"
                          : "bg-violet-500"
                      }`}
                      style={{ width: `${genPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Usage history */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">
                Usage history (last 30 days)
              </h2>

              {history.length === 0 ? (
                <div className="text-center py-8 text-sm text-zinc-500">
                  No usage data yet
                </div>
              ) : (
                <>
                  {/* Bar chart */}
                  <div className="h-40 mb-6">
                    {(() => {
                      const maxCalls = Math.max(
                        ...history.map((d) => d.api_calls),
                        1
                      );
                      return (
                        <div className="flex items-end gap-1 h-full">
                          {history
                            .slice()
                            .reverse()
                            .map((d) => {
                              const pct = (d.api_calls / maxCalls) * 100;
                              return (
                                <div
                                  key={d.date}
                                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                  title={`${d.date}: ${d.api_calls} calls, ${d.generations} generations`}
                                >
                                  <div
                                    className="w-full bg-violet-600 rounded-t-sm transition-all"
                                    style={{
                                      height: `${Math.max(pct, 2)}%`,
                                      minHeight: "2px",
                                    }}
                                  />
                                </div>
                              );
                            })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* History table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                          <th className="text-left px-4 py-2 font-medium">Date</th>
                          <th className="text-right px-4 py-2 font-medium">
                            API Calls
                          </th>
                          <th className="text-right px-4 py-2 font-medium">
                            Generations
                          </th>
                          <th className="text-right px-4 py-2 font-medium">
                            Tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => (
                          <tr
                            key={entry.date}
                            className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                          >
                            <td className="px-4 py-2 text-zinc-300">
                              {new Date(entry.date + "T00:00:00").toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-zinc-300">
                              {entry.api_calls.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-zinc-300">
                              {entry.generations.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-zinc-400">
                              {entry.total_tokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
