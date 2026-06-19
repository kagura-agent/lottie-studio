import { db, ANIMATIONS_DIR } from "@/lib/db";
import { checkRate, extractIp } from "@/lib/rateLimit";
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

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM animations WHERE share_chat = 1")
    .get() as { count: number };
  const total = totalRow.count;

  const rows = db
    .prepare(
      `SELECT id, name, created_at, frame_count
       FROM animations
       WHERE share_chat = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as {
    id: string;
    name: string;
    created_at: string;
    frame_count: number | null;
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

  return Response.json({
    animations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
