import crypto from "node:crypto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body as { name?: string };
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json(
      { error: "name is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return Response.json(
      { error: "name must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const rawKey = crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  db.prepare(
    "INSERT INTO api_keys (id, key_hash, name) VALUES (?, ?, ?)"
  ).run(id, keyHash, name.trim());

  return Response.json(
    {
      id,
      key: rawKey,
      name: name.trim(),
      message:
        "Save this key — it will not be shown again.",
    },
    { status: 201 }
  );
}
