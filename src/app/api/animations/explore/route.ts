import { db, ANIMATIONS_DIR } from "@/lib/db";
import { checkRate, extractIp } from "@/lib/rateLimit";
import { TAG_VOCABULARY } from "@/lib/tag-inference";
import type { AnimationTag } from "@/lib/tag-inference";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = extractIp(request);
  const rateResult = checkRate(ip);
  if (!rateResult.ok) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateResult.retryAfterSec) },
      }
    );
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "24", 10)));
  const offset = (page - 1) * limit;
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "newest";
  const tagParam = url.searchParams.get("tag")?.trim() ?? "";

  // Build WHERE clauses
  const conditions: string[] = ["share_chat = 1", "frame_count IS NOT NULL"];
  const params: (string | number)[] = [];

  if (q) {
    conditions.push("name LIKE ?");
    params.push(`%${q}%`);
  }

  if (tagParam && TAG_VOCABULARY.includes(tagParam as AnimationTag)) {
    // Match tag in comma-separated tags column
    // Handles: exact match, start of string, end of string, or middle
    conditions.push("(tags = ? OR tags LIKE ? OR tags LIKE ? OR tags LIKE ?)");
    params.push(tagParam, `${tagParam},%`, `%,${tagParam}`, `%,${tagParam},%`);
  }

  const whereClause = "WHERE " + conditions.join(" AND ");

  let orderBy: string;
  switch (sort) {
    case "oldest":
      orderBy = "created_at ASC";
      break;
    case "name-asc":
      orderBy = "name COLLATE NOCASE ASC";
      break;
    case "name-desc":
      orderBy = "name COLLATE NOCASE DESC";
      break;
    case "most-viewed":
      orderBy = "COALESCE(view_count, 0) DESC";
      break;
    default:
      orderBy = "created_at DESC";
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM animations ${whereClause}`)
    .get(...params) as { count: number };
  const total = totalRow.count;

  const rows = db
    .prepare(
      `SELECT id, name, description, created_at, frame_count, tags, COALESCE(view_count, 0) as view_count
       FROM animations
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    frame_count: number | null;
    tags: string | null;
    view_count: number;
  }[];

  // Enrich with layer_count, w, h from the animation JSON files
  const animations = rows.map((row) => {
    const filePath = path.join(ANIMATIONS_DIR, `${row.id}.json`);
    let layerCount: number | null = null;
    let w: number | null = null;
    let h: number | null = null;
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        layerCount = Array.isArray(data.layers) ? data.layers.length : null;
        w = data.w ?? null;
        h = data.h ?? null;
      }
    } catch {
      // ignore parse errors
    }
    return { ...row, layer_count: layerCount, w, h };
  });

  // Compute tag counts for all shared animations (for filter chip counts)
  const tagCountRows = db
    .prepare(
      `SELECT tags FROM animations WHERE share_chat = 1 AND frame_count IS NOT NULL AND tags IS NOT NULL AND tags != ''`
    )
    .all() as { tags: string }[];

  const tagCounts: Record<string, number> = {};
  for (const row of tagCountRows) {
    const tags = row.tags.split(",");
    for (const tag of tags) {
      const trimmed = tag.trim();
      if (trimmed && TAG_VOCABULARY.includes(trimmed as AnimationTag)) {
        tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
      }
    }
  }

  return Response.json({
    animations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    tagCounts,
  });
}
