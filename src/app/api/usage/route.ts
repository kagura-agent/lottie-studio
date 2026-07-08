import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import { getTierLimits, getTodayUsage, type ApiTier } from "@/lib/tier-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const tierRow = db
    .prepare(`SELECT api_tier FROM users WHERE id = ?`)
    .get(user.id) as { api_tier: string } | undefined;
  const tier = (tierRow?.api_tier as ApiTier) ?? "free";
  const limits = getTierLimits(tier);
  const usage = getTodayUsage(user.id);

  return Response.json({
    tier,
    today: {
      apiCalls: usage.apiCalls,
      generations: usage.generations,
    },
    limits: {
      apiCallsPerDay: limits.apiCallsPerDay,
      generationsPerDay: limits.generationsPerDay,
    },
  });
}
