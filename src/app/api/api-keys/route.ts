import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "name must be 100 characters or less" }, { status: 400 });
  }

  const result = generateApiKey(name.trim());

  return NextResponse.json({
    id: result.id,
    key: result.key,
    name: result.name,
    created_at: new Date().toISOString(),
  }, { status: 201 });
}
