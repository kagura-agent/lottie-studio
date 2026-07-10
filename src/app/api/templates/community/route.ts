import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const submissions = db.prepare(`
    SELECT ts.*, a.name as animation_name, a.id as anim_id
    FROM template_submissions ts
    JOIN animations a ON a.id = ts.animation_id
    WHERE ts.status = 'approved'
    ORDER BY ts.reviewed_at DESC
  `).all();

  return Response.json(submissions);
}
