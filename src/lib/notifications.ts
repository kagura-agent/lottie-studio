import { db } from "@/lib/db";
import crypto from "node:crypto";

export function createNotification({
  userId,
  type,
  actorId,
  animationId,
  commentId,
}: {
  userId: string;
  type: "follow" | "comment" | "like";
  actorId: string;
  animationId?: string;
  commentId?: string;
}): void {
  if (userId === actorId) return;

  db.prepare(
    `INSERT INTO notifications (id, user_id, type, actor_id, animation_id, comment_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, type, actorId, animationId ?? null, commentId ?? null);
}
