"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/auth/UserMenu";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started creating animations with AI",
    features: [
      "100 API calls / day",
      "10 generations / day",
      "Access to free templates",
      "Community support",
      "Basic export (JSON)",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For professionals who need more power",
    features: [
      "5,000 API calls / day",
      "200 generations / day",
      "Access to all templates",
      "Priority support",
      "All export formats",
      "Version history",
      "Custom presets",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "/month per seat",
    description: "For teams building animations at scale",
    features: [
      "50,000 API calls / day",
      "2,000 generations / day",
      "Access to all templates",
      "Dedicated support",
      "All export formats",
      "Version history",
      "Custom presets",
      "Collaborative editing",
      "Admin dashboard",
      "Usage analytics",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const COMPARISON_ROWS = [
  { feature: "API calls / day", free: "100", pro: "5,000", team: "50,000" },
  { feature: "Generations / day", free: "10", pro: "200", team: "2,000" },
  { feature: "Free templates", free: true, pro: true, team: true },
  { feature: "Premium templates", free: false, pro: true, team: true },
  { feature: "Export JSON", free: true, pro: true, team: true },
  { feature: "Export GIF / MP4", free: false, pro: true, team: true },
  { feature: "Version history", free: false, pro: true, team: true },
  { feature: "Custom presets", free: false, pro: true, team: true },
  { feature: "Collaborative editing", free: false, pro: false, team: true },
  { feature: "Admin dashboard", free: false, pro: false, team: true },
  { feature: "Support", free: "Community", pro: "Priority", team: "Dedicated" },
];

export default function PricingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            &larr; Back to gallery
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <UserMenu />
            ) : (
              <Link
                href="/"
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Start for free, upgrade when you need more. All plans include the full
            animation editor.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-8 flex flex-col ${
                tier.highlighted
                  ? "border-violet-500 bg-zinc-900 shadow-lg shadow-violet-500/10"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded-full">
                  Most popular
                </div>
              )}

              <h2 className="text-xl font-semibold text-white mb-2">{tier.name}</h2>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-white">{tier.price}</span>
                <span className="text-sm text-zinc-500">{tier.period}</span>
              </div>
              <p className="text-sm text-zinc-400 mb-6">{tier.description}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-4 h-4 text-violet-400 mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={`block w-full text-center py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  tier.highlighted
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Compare plans
          </h2>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-6 py-4 text-zinc-400 font-medium">
                    Feature
                  </th>
                  <th className="text-center px-6 py-4 text-zinc-400 font-medium">
                    Free
                  </th>
                  <th className="text-center px-6 py-4 text-violet-400 font-medium">
                    Pro
                  </th>
                  <th className="text-center px-6 py-4 text-zinc-400 font-medium">
                    Team
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-zinc-800/50 ${
                      i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"
                    }`}
                  >
                    <td className="px-6 py-3 text-zinc-300">{row.feature}</td>
                    {(["free", "pro", "team"] as const).map((tier) => {
                      const val = row[tier];
                      return (
                        <td key={tier} className="px-6 py-3 text-center">
                          {typeof val === "boolean" ? (
                            val ? (
                              <svg
                                className="w-5 h-5 text-green-400 mx-auto"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-5 h-5 text-zinc-600 mx-auto"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )
                          ) : (
                            <span className="text-zinc-300">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
