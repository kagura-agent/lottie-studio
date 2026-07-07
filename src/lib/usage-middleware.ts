import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import { checkTierLimit, type ApiTier } from "@/lib/tier-rate-limit";
import crypto from "node:crypto";

export function trackUsage(userId: string, endpoint: string, tokensUsed = 0): void {
  db.prepare(
    `INSERT INTO api_usage (id, user_id, endpoint, tokens_used) VALUES (?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, endpoint, tokensUsed);
}

function getUserTier(userId: string): ApiTier {
  const row = db
    .prepare(`SELECT api_tier FROM users WHERE id = ?`)
    .get(userId) as { api_tier: string } | undefined;
  return (row?.api_tier as ApiTier) ?? "free";
}

type RouteHandler = (request: Request, ...args: unknown[]) => Promise<Response> | Response;

export function withUsageTracking(endpoint: string, handler: RouteHandler): RouteHandler {
  return async (request: Request, ...args: unknown[]) => {
    const user = getAuthUser(request);
    if (!user) {
      return handler(request, ...args);
    }

    const tier = getUserTier(user.id);
    const result = checkTierLimit(user.id, tier, endpoint);

    if (!result.ok) {
      return Response.json(
        {
          error: "Rate limit exceeded",
          reason: result.reason,
          limit: result.limit,
          used: result.used,
          tier,
          upgradeUrl: "/pricing",
        },
        { status: 429 }
      );
    }

    trackUsage(user.id, endpoint);
    return handler(request, ...args);
  };
}
