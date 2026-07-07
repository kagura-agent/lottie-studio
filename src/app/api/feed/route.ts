import { db, ANIMATIONS_DIR } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "24", 10)));
  const offset = (page - 1) * limit;

  const totalRow = db
    .prepare(`
      SELECT COUNT(*) as count FROM animations
      WHERE (user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
             OR creator_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
        AND share_chat = 1
        AND frame_count IS NOT NULL
    `)
    .get(user.id, user.id) as { count: number };
  const total = totalRow.count;

  const rows = db
    .prepare(`
      SELECT a.id, a.name, a.description, a.created_at, a.frame_count, a.tags,
        COALESCE(a.view_count, 0) as view_count,
        COALESCE(a.like_count, 0) as like_count,
        COALESCE(a.comment_count, 0) as comment_count,
        a.creator_id,
        (SELECT m.content FROM messages m WHERE m.animation_id = a.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt,
        a.remixed_from,
        (SELECT COUNT(*) FROM animations a2 WHERE a2.remixed_from = a.id) as remix_count,
        (SELECT a3.name FROM animations a3 WHERE a3.id = a.remixed_from) as remixed_from_name,
        COALESCE(u.display_name, u.email) as creator_name
      FROM animations a
      LEFT JOIN users u ON u.id = COALESCE(a.user_id, a.creator_id)
      WHERE (a.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
             OR a.creator_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
        AND a.share_chat = 1
        AND a.frame_count IS NOT NULL
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(user.id, user.id, limit, offset) as {
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      frame_count: number | null;
      tags: string | null;
      view_count: number;
      like_count: number;
      comment_count: number;
      creator_id: string | null;
      creation_prompt: string | null;
      remixed_from: string | null;
      remix_count: number;
      remixed_from_name: string | null;
      creator_name: string | null;
    }[];

  const animations = rows.map((row) => {
    const filePath = path.join(ANIMATIONS_DIR, `${row.id}.json`);
    let layer_count: number | null = null;
    let w: number | null = null;
    let h: number | null = null;
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        layer_count = Array.isArray(data.layers) ? data.layers.length : null;
        w = data.w ?? null;
        h = data.h ?? null;
      }
    } catch {
      // ignore parse errors
    }
    return { ...row, layer_count, w, h };
  });

  return Response.json({
    animations,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
