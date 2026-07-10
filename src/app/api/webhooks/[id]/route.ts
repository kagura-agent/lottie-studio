import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const existing = db
    .prepare("SELECT * FROM webhooks WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { url?: string; events?: string[]; format?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.url !== undefined) {
    try {
      new URL(body.url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }
    updates.push("url = ?");
    values.push(body.url);
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return Response.json({ error: "events must be a non-empty array" }, { status: 400 });
    }
    updates.push("events = ?");
    values.push(JSON.stringify(body.events));
  }

  if (body.format !== undefined) {
    if (!["generic", "slack", "discord"].includes(body.format)) {
      return Response.json({ error: "format must be generic, slack, or discord" }, { status: 400 });
    }
    updates.push("format = ?");
    values.push(body.format);
  }

  if (body.active !== undefined) {
    updates.push("active = ?");
    values.push(body.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(id, user.id);

  db.prepare(
    `UPDATE webhooks SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
  ).run(...values);

  return Response.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const result = db
    .prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?")
    .run(id, user.id);

  if (result.changes === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = db
    .prepare("SELECT id, url, events, format, active, created_at, updated_at FROM webhooks WHERE id = ? AND user_id = ?")
    .get(id, user.id) as { id: string; url: string; events: string; format: string; active: number; created_at: string; updated_at: string } | undefined;

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const deliveries = db
    .prepare("SELECT id, event, status_code, success, created_at FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(id) as { id: string; event: string; status_code: number | null; success: number; created_at: string }[];

  return Response.json({
    ...webhook,
    events: JSON.parse(webhook.events),
    active: webhook.active === 1,
    deliveries: deliveries.map((d) => ({ ...d, success: d.success === 1 })),
  });
}
