import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function isAdmin(request: Request): boolean {
  const token = request.headers.get("X-Admin-Token");
  const expected = process.env.ADMIN_TOKEN || "admin";
  return token === expected;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let query = `
    SELECT ts.*, a.name as animation_name, a.id as anim_id
    FROM template_submissions ts
    JOIN animations a ON a.id = ts.animation_id
  `;
  const params: string[] = [];

  if (status) {
    query += " WHERE ts.status = ?";
    params.push(status);
  }

  query += " ORDER BY ts.submitted_at DESC";

  const submissions = db.prepare(query).all(...params);
  return Response.json(submissions);
}
