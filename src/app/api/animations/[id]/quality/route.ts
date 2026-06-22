import { ANIMATIONS_DIR } from "@/lib/db";
import { analyzeQuality } from "@/lib/quality";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const jsonString = fs.readFileSync(filePath, "utf-8");
  let animation: Record<string, unknown>;
  try {
    animation = JSON.parse(jsonString);
  } catch {
    return Response.json({ error: "Invalid animation JSON" }, { status: 500 });
  }

  const result = analyzeQuality(animation, jsonString);

  return Response.json(result);
}
