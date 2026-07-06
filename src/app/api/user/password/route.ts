import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import {
  requireAuth,
  AuthError,
  validatePassword,
  checkAuthRate,
} from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const rateResult = checkAuthRate(request);
  if (!rateResult.ok) {
    return Response.json(
      {
        error: "Too many attempts. Please try again later.",
        retryAfterSec: rateResult.retryAfterSec,
      },
      { status: 429 }
    );
  }

  try {
    const user = requireAuth(request);

    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.currentPassword || !body.newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(body.newPassword);
    if (passwordError) {
      return Response.json({ error: passwordError }, { status: 400 });
    }

    const userRow = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as { password_hash: string } | undefined;

    if (!userRow || !userRow.password_hash) {
      return Response.json(
        { error: "Password login not available for OAuth-only accounts" },
        { status: 400 }
      );
    }

    const valid = await verifyPassword(
      body.currentPassword,
      userRow.password_hash
    );
    if (!valid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    const newHash = await hashPassword(body.newPassword);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      newHash,
      user.id
    );

    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
