import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));

  const animations = db
    .prepare(
      `SELECT a.id, a.name, a.description, a.view_count, a.like_count, a.comment_count,
              a.created_at, a.frame_count, a.duration_seconds,
              u.display_name as creator_name
       FROM animations a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.share_chat = 1 AND a.view_count > 0
       ORDER BY a.view_count DESC, a.like_count DESC
       LIMIT ?`
    )
    .all(limit) as {
    id: string;
    name: string;
    description: string | null;
    view_count: number;
    like_count: number;
    comment_count: number;
    created_at: string;
    frame_count: number | null;
    duration_seconds: number | null;
    creator_name: string | null;
  }[];

  return Response.json({ animations });
}
