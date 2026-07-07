import { db } from "@/lib/db";

export type ApiTier = "free" | "pro" | "team";

interface TierLimits {
  apiCallsPerDay: number;
  generationsPerDay: number;
}

const TIER_LIMITS: Record<ApiTier, TierLimits> = {
  free: { apiCallsPerDay: 100, generationsPerDay: 10 },
  pro: { apiCallsPerDay: 5000, generationsPerDay: 200 },
  team: { apiCallsPerDay: 50000, generationsPerDay: 2000 },
};

export function getTierLimits(tier: ApiTier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

interface UsageCounts {
  apiCalls: number;
  generations: number;
}

export function getTodayUsage(userId: string): UsageCounts {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const apiRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM api_usage WHERE user_id = ? AND timestamp >= ?`
    )
    .get(userId, todayIso) as { count: number };

  const genRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM api_usage WHERE user_id = ? AND timestamp >= ? AND endpoint = 'generation'`
    )
    .get(userId, todayIso) as { count: number };

  return {
    apiCalls: apiRow.count,
    generations: genRow.count,
  };
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "api_calls" | "generations"; limit: number; used: number };

export function checkTierLimit(
  userId: string,
  tier: ApiTier,
  endpoint: string
): RateLimitResult {
  const limits = getTierLimits(tier);
  const usage = getTodayUsage(userId);

  if (usage.apiCalls >= limits.apiCallsPerDay) {
    return {
      ok: false,
      reason: "api_calls",
      limit: limits.apiCallsPerDay,
      used: usage.apiCalls,
    };
  }

  if (endpoint === "generation" && usage.generations >= limits.generationsPerDay) {
    return {
      ok: false,
      reason: "generations",
      limit: limits.generationsPerDay,
      used: usage.generations,
    };
  }

  return { ok: true };
}

export function isApproachingLimit(
  userId: string,
  tier: ApiTier,
  threshold = 0.8
): { approaching: boolean; apiCallPercent: number; generationPercent: number } {
  const limits = getTierLimits(tier);
  const usage = getTodayUsage(userId);

  const apiCallPercent = usage.apiCalls / limits.apiCallsPerDay;
  const generationPercent = usage.generations / limits.generationsPerDay;

  return {
    approaching: apiCallPercent >= threshold || generationPercent >= threshold,
    apiCallPercent,
    generationPercent,
  };
}
