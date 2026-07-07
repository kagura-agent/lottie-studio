import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const plugin = db
    .prepare("SELECT id FROM plugins WHERE slug = ?")
    .get(slug) as { id: string } | undefined;

  if (!plugin) {
    return Response.json({ error: "Plugin not found" }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT id FROM plugin_installs WHERE user_id = ? AND plugin_id = ?")
    .get(user.id, plugin.id);

  if (existing) {
    return Response.json({ error: "Plugin already installed" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO plugin_installs (id, user_id, plugin_id) VALUES (?, ?, ?)"
  ).run(id, user.id, plugin.id);

  db.prepare(
    "UPDATE plugins SET downloads = downloads + 1 WHERE id = ?"
  ).run(plugin.id);

  return Response.json({ success: true, installed: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const plugin = db
    .prepare("SELECT id FROM plugins WHERE slug = ?")
    .get(slug) as { id: string } | undefined;

  if (!plugin) {
    return Response.json({ error: "Plugin not found" }, { status: 404 });
  }

  const result = db
    .prepare("DELETE FROM plugin_installs WHERE user_id = ? AND plugin_id = ?")
    .run(user.id, plugin.id);

  if (result.changes === 0) {
    return Response.json({ error: "Plugin not installed" }, { status: 404 });
  }

  return Response.json({ success: true, installed: false });
}
