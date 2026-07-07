import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const plugin = db
    .prepare(
      `SELECT p.*, u.display_name as author_name,
        (SELECT COUNT(*) FROM plugin_installs WHERE plugin_id = p.id) as install_count
       FROM plugins p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.slug = ?`
    )
    .get(slug);

  if (!plugin) {
    return Response.json({ error: "Plugin not found" }, { status: 404 });
  }

  return Response.json(plugin);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const plugin = db
    .prepare("SELECT id, author_id FROM plugins WHERE slug = ?")
    .get(slug) as { id: string; author_id: string } | undefined;

  if (!plugin) {
    return Response.json({ error: "Plugin not found" }, { status: 404 });
  }

  if (plugin.author_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    description?: string;
    version?: string;
    code?: string;
    config_schema?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.version !== undefined) {
    updates.push("version = ?");
    values.push(body.version);
  }
  if (body.code !== undefined) {
    updates.push("code = ?");
    values.push(body.code);
  }
  if (body.config_schema !== undefined) {
    updates.push("config_schema = ?");
    values.push(JSON.stringify(body.config_schema));
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(plugin.id);

  db.prepare(`UPDATE plugins SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values
  );

  const updated = db.prepare("SELECT * FROM plugins WHERE id = ?").get(plugin.id);
  return Response.json(updated);
}
