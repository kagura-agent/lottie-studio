import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);

    const animationCount = db
      .prepare("SELECT COUNT(*) as count FROM animations WHERE user_id = ?")
      .get(user.id) as { count: number };

    const oauthRows = db
      .prepare("SELECT provider FROM oauth_accounts WHERE user_id = ?")
      .all(user.id) as { provider: string }[];

    const providers = oauthRows.map((r) => r.provider);

    return Response.json({
      user,
      animationCount: animationCount.count,
      providers,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PATCH(request: Request) {
  try {
    const user = requireAuth(request);

    let body: { displayName?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (typeof body.displayName !== "string") {
      return Response.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const displayName = body.displayName.trim();
    if (displayName.length > 100) {
      return Response.json(
        { error: "Display name too long (max 100 characters)" },
        { status: 400 }
      );
    }

    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
      displayName || null,
      user.id
    );

    const updated = db
      .prepare(
        "SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?"
      )
      .get(user.id) as { id: string; email: string; display_name: string | null; avatar_url: string | null; created_at: string };

    return Response.json({ user: updated });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
