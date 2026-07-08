import { describe, it, expect } from "vitest";

type ApiTier = "free" | "pro" | "team";

interface TierLimits {
  apiCallsPerDay: number;
  generationsPerDay: number;
}

const TIER_LIMITS: Record<ApiTier, TierLimits> = {
  free: { apiCallsPerDay: 100, generationsPerDay: 10 },
  pro: { apiCallsPerDay: 5000, generationsPerDay: 200 },
  team: { apiCallsPerDay: 50000, generationsPerDay: 2000 },
};

function getTierLimits(tier: ApiTier): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "api_calls" | "generations"; limit: number; used: number };

function checkTierLimitPure(
  usage: { apiCalls: number; generations: number },
  tier: ApiTier,
  endpoint: string
): RateLimitResult {
  const limits = getTierLimits(tier);

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

function isApproachingLimitPure(
  usage: { apiCalls: number; generations: number },
  tier: ApiTier,
  threshold = 0.8
): { approaching: boolean; apiCallPercent: number; generationPercent: number } {
  const limits = getTierLimits(tier);
  const apiCallPercent = usage.apiCalls / limits.apiCallsPerDay;
  const generationPercent = usage.generations / limits.generationsPerDay;

  return {
    approaching: apiCallPercent >= threshold || generationPercent >= threshold,
    apiCallPercent,
    generationPercent,
  };
}

describe("getTierLimits", () => {
  it("returns correct limits for free tier", () => {
    const limits = getTierLimits("free");
    expect(limits.apiCallsPerDay).toBe(100);
    expect(limits.generationsPerDay).toBe(10);
  });

  it("returns correct limits for pro tier", () => {
    const limits = getTierLimits("pro");
    expect(limits.apiCallsPerDay).toBe(5000);
    expect(limits.generationsPerDay).toBe(200);
  });

  it("returns correct limits for team tier", () => {
    const limits = getTierLimits("team");
    expect(limits.apiCallsPerDay).toBe(50000);
    expect(limits.generationsPerDay).toBe(2000);
  });
});

describe("checkTierLimit", () => {
  it("allows request within free tier limits", () => {
    const result = checkTierLimitPure(
      { apiCalls: 50, generations: 5 },
      "free",
      "chat"
    );
    expect(result.ok).toBe(true);
  });

  it("blocks when free tier api calls exceeded", () => {
    const result = checkTierLimitPure(
      { apiCalls: 100, generations: 0 },
      "free",
      "chat"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("api_calls");
      expect(result.limit).toBe(100);
      expect(result.used).toBe(100);
    }
  });

  it("blocks when free tier generation limit exceeded", () => {
    const result = checkTierLimitPure(
      { apiCalls: 50, generations: 10 },
      "free",
      "generation"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generations");
      expect(result.limit).toBe(10);
    }
  });

  it("does not check generation limit for non-generation endpoints", () => {
    const result = checkTierLimitPure(
      { apiCalls: 50, generations: 100 },
      "free",
      "chat"
    );
    expect(result.ok).toBe(true);
  });

  it("pro tier allows much higher usage", () => {
    const result = checkTierLimitPure(
      { apiCalls: 4999, generations: 199 },
      "pro",
      "generation"
    );
    expect(result.ok).toBe(true);
  });

  it("team tier allows highest usage", () => {
    const result = checkTierLimitPure(
      { apiCalls: 49999, generations: 1999 },
      "team",
      "generation"
    );
    expect(result.ok).toBe(true);
  });
});

describe("isApproachingLimit", () => {
  it("returns not approaching when usage is low", () => {
    const result = isApproachingLimitPure(
      { apiCalls: 10, generations: 1 },
      "free"
    );
    expect(result.approaching).toBe(false);
    expect(result.apiCallPercent).toBe(0.1);
    expect(result.generationPercent).toBe(0.1);
  });

  it("returns approaching when api calls at 80%", () => {
    const result = isApproachingLimitPure(
      { apiCalls: 80, generations: 0 },
      "free"
    );
    expect(result.approaching).toBe(true);
    expect(result.apiCallPercent).toBe(0.8);
  });

  it("returns approaching when generations at 80%", () => {
    const result = isApproachingLimitPure(
      { apiCalls: 10, generations: 8 },
      "free"
    );
    expect(result.approaching).toBe(true);
    expect(result.generationPercent).toBe(0.8);
  });

  it("respects custom threshold", () => {
    const result = isApproachingLimitPure(
      { apiCalls: 90, generations: 0 },
      "free",
      0.9
    );
    expect(result.approaching).toBe(true);
  });

  it("not approaching with custom high threshold", () => {
    const result = isApproachingLimitPure(
      { apiCalls: 80, generations: 0 },
      "free",
      0.9
    );
    expect(result.approaching).toBe(false);
  });
});
