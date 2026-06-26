import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT id, name, description, created_at, frame_count, tags,
              COALESCE(view_count, 0) as view_count,
              COALESCE(like_count, 0) as like_count
       FROM animations
       WHERE share_chat = 1
         AND (COALESCE(like_count, 0) > 0 OR COALESCE(view_count, 0) > 0)
       ORDER BY (COALESCE(like_count, 0) * 3 + COALESCE(view_count, 0)) DESC
       LIMIT 10`
    )
    .all() as {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    frame_count: number | null;
    tags: string | null;
    view_count: number;
    like_count: number;
  }[];

  if (rows.length === 0) {
    return new Response(null, { status: 204 });
  }

  // Deterministically pick one using today's date char code sum
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let sum = 0;
  for (let i = 0; i < today.length; i++) {
    sum += today.charCodeAt(i);
  }
  const featured = rows[sum % rows.length];

  return Response.json(featured);
}
