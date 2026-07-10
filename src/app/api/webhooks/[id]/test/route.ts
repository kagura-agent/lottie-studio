import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import { dispatchWebhookEvent, type WebhookEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = db
    .prepare("SELECT * FROM webhooks WHERE id = ? AND user_id = ?")
    .get(id, user.id) as { id: string; events: string; url: string; secret: string; format: string } | undefined;

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const events: string[] = JSON.parse(webhook.events);
  const testEvent = (events[0] || "animation.created") as WebhookEvent;

  await dispatchWebhookEvent(
    testEvent,
    {
      id: crypto.randomUUID(),
      name: "Test Animation",
      test: true,
      triggered_by: user.id,
    },
    user.id
  );

  return Response.json({ success: true, event: testEvent });
}
