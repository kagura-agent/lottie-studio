import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { withApiKey } from "@/lib/api-middleware";
import { db, ANIMATIONS_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async ({ request }) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  if (!id) {
    return NextResponse.json({ error: "Animation ID required" }, { status: 400 });
  }

  const row = db.prepare(
    "SELECT id, name, created_at FROM animations WHERE id = ?"
  ).get(id) as { id: string; name: string; created_at: string } | undefined;

  if (!row) {
    return NextResponse.json({ error: "Animation not found" }, { status: 404 });
  }

  const jsonPath = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ error: "Animation data not found" }, { status: 404 });
  }

  const lottieJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  return NextResponse.json({
    id: row.id,
    name: row.name,
    lottieJson,
    created_at: row.created_at,
  });
});
