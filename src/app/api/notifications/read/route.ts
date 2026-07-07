import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body means mark all as read
  }

  if (body.id) {
    db.prepare(
      "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?"
    ).run(body.id, user.id);
  } else {
    db.prepare(
      "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0"
    ).run(user.id);
  }

  return Response.json({ success: true });
}
