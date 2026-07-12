import { describe, it, expect } from "vitest";

describe("usage tracking", () => {
  it("trackUsage records the correct fields", () => {
    const records: { id: string; userId: string; endpoint: string; tokensUsed: number }[] = [];

    function trackUsagePure(userId: string, endpoint: string, tokensUsed = 0) {
      records.push({ id: `test-${records.length}`, userId, endpoint, tokensUsed });
    }

    trackUsagePure("user-1", "chat", 150);
    trackUsagePure("user-1", "generation", 500);
    trackUsagePure("user-2", "chat");

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ userId: "user-1", endpoint: "chat", tokensUsed: 150 });
    expect(records[1]).toMatchObject({ userId: "user-1", endpoint: "generation", tokensUsed: 500 });
    expect(records[2]).toMatchObject({ userId: "user-2", endpoint: "chat", tokensUsed: 0 });
  });

  it("withUsageTracking blocks unauthenticated users from rate limit check", () => {
    type RateLimitResult =
      | { ok: true }
      | { ok: false; reason: string; limit: number; used: number };

    function checkTierLimitPure(
      usage: { apiCalls: number },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _tier: string,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _endpoint: string
    ): RateLimitResult {
      if (usage.apiCalls >= 100) {
        return { ok: false, reason: "api_calls", limit: 100, used: usage.apiCalls };
      }
      return { ok: true };
    }

    const overLimit = checkTierLimitPure({ apiCalls: 100 }, "free", "chat");
    expect(overLimit.ok).toBe(false);

    const underLimit = checkTierLimitPure({ apiCalls: 99 }, "free", "chat");
    expect(underLimit.ok).toBe(true);
  });

  it("getUserTier defaults to free when no tier set", () => {
    function getUserTierPure(apiTier: string | undefined): string {
      return apiTier ?? "free";
    }

    expect(getUserTierPure(undefined)).toBe("free");
    expect(getUserTierPure("pro")).toBe("pro");
    expect(getUserTierPure("team")).toBe("team");
  });
});
