import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const webhooks = db
    .prepare("SELECT id, url, events, format, active, created_at, updated_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as { id: string; url: string; events: string; format: string; active: number; created_at: string; updated_at: string }[];

  return Response.json({
    webhooks: webhooks.map((w) => ({
      ...w,
      events: JSON.parse(w.events),
      active: w.active === 1,
    })),
  });
}

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { url?: string; events?: string[]; format?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, events, format = "generic" } = body;

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return Response.json({ error: "URL must use http or https" }, { status: 400 });
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return Response.json({ error: "events must be a non-empty array" }, { status: 400 });
  }

  if (!["generic", "slack", "discord"].includes(format)) {
    return Response.json({ error: "format must be generic, slack, or discord" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;

  db.prepare(
    "INSERT INTO webhooks (id, user_id, url, secret, events, format) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, url, secret, JSON.stringify(events), format);

  return Response.json({ id, url, secret, events, format, active: true }, { status: 201 });
}
