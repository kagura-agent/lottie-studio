import { EventEmitter } from "node:events";
import { dispatchWebhookEvent, type WebhookEvent } from "@/lib/webhooks";

export const animationEvents = new EventEmitter();

export interface AnimationUpdatedEvent {
  animationId: string;
}

export function emitWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  userId?: string
) {
  dispatchWebhookEvent(event, data, userId).catch(() => {});
}
