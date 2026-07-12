import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, animationId, rating, comment } = body;

    if (!messageId || !animationId || (rating !== 1 && rating !== -1)) {
      return NextResponse.json(
        { error: "messageId, animationId, and rating (1 or -1) are required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id, rating FROM feedback WHERE message_id = ?")
      .get(messageId) as { id: string; rating: number } | undefined;

    if (existing) {
      if (existing.rating === rating) {
        db.prepare("DELETE FROM feedback WHERE id = ?").run(existing.id);
        return NextResponse.json({ status: "removed" });
      }
      db.prepare("UPDATE feedback SET rating = ?, comment = ? WHERE id = ?").run(
        rating,
        comment || null,
        existing.id
      );
      return NextResponse.json({ status: "updated", rating });
    }

    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO feedback (id, animation_id, message_id, rating, comment) VALUES (?, ?, ?, ?, ?)"
    ).run(id, animationId, messageId, rating, comment || null);

    return NextResponse.json({ status: "created", id, rating });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
