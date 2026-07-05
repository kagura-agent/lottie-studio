import { authenticateRequest } from "@/lib/apiAuth";
import { checkApiRate } from "@/lib/rateLimiter";
import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // Rate limit
  const rate = checkApiRate(auth.keyId, auth.rateLimit);
  if (!rate.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const { id } = await params;
  const row = db
    .prepare("SELECT id, name, created_at, description, tags FROM animations WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!row) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  let lottieJson = null;
  if (fs.existsSync(filePath)) {
    lottieJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  return Response.json({
    id: row.id,
    name: row.name,
    lottieJson,
    created_at: row.created_at,
  });
}
