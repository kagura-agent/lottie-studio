import crypto from "node:crypto";
import { db } from "@/lib/db";

export type WebhookEvent =
  | "animation.created"
  | "animation.updated"
  | "animation.shared"
  | "animation.commented"
  | "animation.liked"
  | "template.submitted"
  | "template.approved";

interface Webhook {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  events: string;
  format: string;
  active: number;
}

interface DeliveryResult {
  statusCode: number | null;
  responseBody: string | null;
  success: boolean;
}

function formatPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
  format: string
): unknown {
  const timestamp = new Date().toISOString();

  if (format === "slack") {
    return {
      text: `[Lottie Studio] ${event}`,
      attachments: [
        {
          color: "#6366f1",
          title: event,
          fields: Object.entries(data).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true,
          })),
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  }

  if (format === "discord") {
    return {
      embeds: [
        {
          title: event,
          color: 0x6366f1,
          fields: Object.entries(data).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true,
          })),
          timestamp,
        },
      ],
    };
  }

  return { event, data, timestamp };
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliver(
  url: string,
  payload: string,
  secret: string
): Promise<DeliveryResult> {
  const signature = sign(payload, secret);
  const delays = [1000, 4000, 16000];

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lottie-Signature": `sha256=${signature}`,
          "User-Agent": "LottieStudio-Webhooks/1.0",
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      const body = await res.text().catch(() => "");
      if (res.ok) {
        return { statusCode: res.status, responseBody: body, success: true };
      }
      if (attempt === 2 || res.status < 500) {
        return { statusCode: res.status, responseBody: body, success: false };
      }
    } catch {
      if (attempt === 2) {
        return { statusCode: null, responseBody: "Connection failed", success: false };
      }
    }

    await new Promise((r) => setTimeout(r, delays[attempt]));
  }

  return { statusCode: null, responseBody: "Exhausted retries", success: false };
}

const logDelivery = db.prepare(`
  INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status_code, response_body, success)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const query = userId
    ? `SELECT * FROM webhooks WHERE active = 1 AND user_id = ?`
    : `SELECT * FROM webhooks WHERE active = 1`;

  const webhooks = (
    userId
      ? db.prepare(query).all(userId)
      : db.prepare(query).all()
  ) as Webhook[];

  const matching = webhooks.filter((w) => {
    const events: string[] = JSON.parse(w.events);
    return events.includes(event);
  });

  await Promise.allSettled(
    matching.map(async (webhook) => {
      const payload = JSON.stringify(
        formatPayload(event, data, webhook.format)
      );
      const result = await deliver(webhook.url, payload, webhook.secret);
      logDelivery.run(
        crypto.randomUUID(),
        webhook.id,
        event,
        payload,
        result.statusCode,
        result.responseBody,
        result.success ? 1 : 0
      );
    })
  );
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = `sha256=${sign(payload, secret)}`;
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
