import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import crypto from "node:crypto";
import type { ApiTier } from "@/lib/tier-rate-limit";

export const dynamic = "force-dynamic";

const VALID_TIERS: ApiTier[] = ["free", "pro", "team"];

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const subscription = db
    .prepare(
      `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    )
    .get(user.id) as Record<string, unknown> | undefined;

  const tierRow = db
    .prepare(`SELECT api_tier FROM users WHERE id = ?`)
    .get(user.id) as { api_tier: string } | undefined;

  return Response.json({
    subscription: subscription ?? null,
    currentTier: tierRow?.api_tier ?? "free",
  });
}

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { tier?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tier = body.tier as ApiTier;
  if (!tier || !VALID_TIERS.includes(tier)) {
    return Response.json(
      { error: "Invalid tier. Must be one of: free, pro, team" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `UPDATE subscriptions SET status = 'superseded', updated_at = datetime('now')
     WHERE user_id = ? AND status = 'active'`
  ).run(user.id);

  db.prepare(
    `INSERT INTO subscriptions (id, user_id, tier, status, current_period_start, current_period_end)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(id, user.id, tier, now, periodEnd);

  db.prepare(`UPDATE users SET api_tier = ? WHERE id = ?`).run(tier, user.id);

  const subscription = db
    .prepare(`SELECT * FROM subscriptions WHERE id = ?`)
    .get(id);

  return Response.json({ subscription, currentTier: tier }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const result = db
    .prepare(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now')
       WHERE user_id = ? AND status = 'active'`
    )
    .run(user.id);

  if (result.changes === 0) {
    return Response.json({ error: "No active subscription found" }, { status: 404 });
  }

  db.prepare(`UPDATE users SET api_tier = 'free' WHERE id = ?`).run(user.id);

  return Response.json({ message: "Subscription cancelled", currentTier: "free" });
}
