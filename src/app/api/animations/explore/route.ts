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
  const creatorParam = url.searchParams.get("creator")?.trim() ?? "";

  // Transform search query for FTS5: quote each token to handle special chars
  let ftsQuery = "";
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    ftsQuery = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
  }

  // Determine sort order
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
    case "most-liked":
      orderBy = "COALESCE(like_count, 0) DESC";
      break;
    default:
      orderBy = "created_at DESC";
  }

  // Build tag filter conditions (shared between FTS and non-FTS paths)
  const tagConditions: string[] = [];
  const tagParams: (string | number)[] = [];
  if (tagParam && TAG_VOCABULARY.includes(tagParam as AnimationTag)) {
    tagConditions.push("(animations.tags = ? OR animations.tags LIKE ? OR animations.tags LIKE ? OR animations.tags LIKE ?)");
    tagParams.push(tagParam, `${tagParam},%`, `%,${tagParam}`, `%,${tagParam},%`);
  }

  // Build creator filter conditions
  const creatorConditions: string[] = [];
  const creatorParams: (string | number)[] = [];
  if (creatorParam) {
    creatorConditions.push("animations.creator_id = ?");
    creatorParams.push(creatorParam);
  }

  let total = 0;
  let rows: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    frame_count: number | null;
    tags: string | null;
    view_count: number;
    like_count: number;
    creator_id: string | null;
    creation_prompt: string | null;
  }[] = [];

  // Use FTS5 when a search query is provided
  if (ftsQuery) {
    let useFts = true;
    try {
      const ftsConditions = ["animations_fts MATCH ?", ...(creatorParam ? [] : ["animations.share_chat = 1"]), "animations.frame_count IS NOT NULL", ...tagConditions, ...creatorConditions];
      const ftsWhere = "WHERE " + ftsConditions.join(" AND ");
      const ftsParams = [ftsQuery, ...tagParams, ...creatorParams];

      // Use bm25 relevance ranking for default sort, otherwise respect user's sort choice
      const ftsOrderBy = sort === "newest" ? "bm25(animations_fts)" : orderBy;

      const countRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM animations
           INNER JOIN animations_fts ON animations.rowid = animations_fts.rowid
           ${ftsWhere}`
        )
        .get(...ftsParams) as { count: number };
      total = countRow.count;

      rows = db
        .prepare(
          `SELECT animations.id, animations.name, animations.description, animations.created_at, animations.frame_count, animations.tags, COALESCE(animations.view_count, 0) as view_count, COALESCE(animations.like_count, 0) as like_count, animations.creator_id,
           (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
           FROM animations
           INNER JOIN animations_fts ON animations.rowid = animations_fts.rowid
           ${ftsWhere}
           ORDER BY ${ftsOrderBy}
           LIMIT ? OFFSET ?`
        )
        .all(...ftsParams, limit, offset) as typeof rows;
    } catch {
      // FTS MATCH failed (e.g. special chars) — fall back to LIKE
      useFts = false;
    }

    if (!useFts) {
      const conditions = ["name LIKE ?", ...(creatorParam ? [] : ["share_chat = 1"]), "frame_count IS NOT NULL", ...tagConditions, ...creatorConditions];
      const params = [`%${q}%`, ...tagParams, ...creatorParams];
      const whereClause = "WHERE " + conditions.join(" AND ");

      const totalRow = db
        .prepare(`SELECT COUNT(*) as count FROM animations ${whereClause}`)
        .get(...params) as { count: number };
      total = totalRow.count;

      rows = db
        .prepare(
          `SELECT id, name, description, created_at, frame_count, tags, COALESCE(view_count, 0) as view_count, COALESCE(like_count, 0) as like_count, creator_id,
           (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
           FROM animations
           ${whereClause}
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset) as typeof rows;
    }
  } else {
    // No search query — standard query
    const conditions = [...(creatorParam ? [] : ["share_chat = 1"]), "frame_count IS NOT NULL", ...tagConditions, ...creatorConditions];
    const params = [...tagParams, ...creatorParams];
    const whereClause = "WHERE " + conditions.join(" AND ");

    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM animations ${whereClause}`)
      .get(...params) as { count: number };
    total = totalRow.count;

    rows = db
      .prepare(
        `SELECT id, name, description, created_at, frame_count, tags, COALESCE(view_count, 0) as view_count, COALESCE(like_count, 0) as like_count, creator_id,
         (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
         FROM animations
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as typeof rows;
  }

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
    return { ...row, layer_count: layerCount, w, h, creation_prompt: row.creation_prompt ?? null };
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
