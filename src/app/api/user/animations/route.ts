import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);

    const url = new URL(request.url);
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") ?? "1", 10)
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "24", 10))
    );
    const offset = (page - 1) * limit;
    const sort = url.searchParams.get("sort") ?? "recent";

    let orderBy: string;
    switch (sort) {
      case "oldest":
        orderBy = "created_at ASC";
        break;
      case "name":
        orderBy = "name COLLATE NOCASE ASC";
        break;
      default:
        orderBy = "created_at DESC";
    }

    const totalRow = db
      .prepare("SELECT COUNT(*) as count FROM animations WHERE user_id = ?")
      .get(user.id) as { count: number };

    const rows = db
      .prepare(
        `SELECT id, name, created_at, updated_at, frame_count, duration_seconds
         FROM animations
         WHERE user_id = ?
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(user.id, limit, offset) as {
      id: string;
      name: string;
      created_at: string;
      updated_at: string;
      frame_count: number | null;
      duration_seconds: number | null;
    }[];

    return Response.json({
      animations: rows,
      total: totalRow.count,
      page,
      limit,
      totalPages: Math.ceil(totalRow.count / limit),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
