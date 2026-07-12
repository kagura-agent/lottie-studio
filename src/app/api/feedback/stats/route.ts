import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const total = db
      .prepare("SELECT COUNT(*) as count FROM feedback")
      .get() as { count: number };

    const positive = db
      .prepare("SELECT COUNT(*) as count FROM feedback WHERE rating = 1")
      .get() as { count: number };

    const positivePercent =
      total.count > 0 ? Math.round((positive.count / total.count) * 100) : 0;

    const topRated = db
      .prepare(
        `SELECT f.animation_id, a.name, COUNT(*) as total_ratings,
           SUM(CASE WHEN f.rating = 1 THEN 1 ELSE 0 END) as positive_count
         FROM feedback f
         LEFT JOIN animations a ON a.id = f.animation_id
         GROUP BY f.animation_id
         ORDER BY positive_count DESC
         LIMIT 10`
      )
      .all();

    return NextResponse.json({
      totalRatings: total.count,
      positivePercent,
      topRated,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
