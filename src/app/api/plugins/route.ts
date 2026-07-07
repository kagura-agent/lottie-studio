import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["transition", "effect", "generator", "modifier", "utility"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");

  let query = "SELECT p.*, u.display_name as author_name FROM plugins p LEFT JOIN users u ON u.id = p.author_id";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push("p.category = ?");
    params.push(category);
  }

  if (search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.downloads DESC, p.created_at DESC";

  const plugins = db.prepare(query).all(...params);
  return Response.json(plugins);
}

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: {
    name?: string;
    description?: string;
    version?: string;
    code?: string;
    config_schema?: unknown;
    category?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  if (!body.code || typeof body.code !== "string") {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
    return Response.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const slug = slugify(body.name.trim());
  if (!slug) {
    return Response.json({ error: "name produces an invalid slug" }, { status: 400 });
  }

  const existing = db.prepare("SELECT id FROM plugins WHERE slug = ?").get(slug);
  if (existing) {
    return Response.json({ error: "A plugin with this slug already exists" }, { status: 409 });
  }

  let configSchema = "{}";
  if (body.config_schema) {
    try {
      configSchema = JSON.stringify(body.config_schema);
    } catch {
      return Response.json({ error: "Invalid config_schema" }, { status: 400 });
    }
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO plugins (id, name, slug, description, version, author_id, code, config_schema, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name.trim(),
    slug,
    body.description?.trim() || "",
    body.version || "1.0.0",
    user.id,
    body.code,
    configSchema,
    body.category
  );

  const plugin = db.prepare("SELECT * FROM plugins WHERE id = ?").get(id);
  return Response.json(plugin, { status: 201 });
}
