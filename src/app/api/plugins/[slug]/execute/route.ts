import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-middleware";
import { executePluginTransform } from "@/lib/plugin-sandbox";

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
    .prepare("SELECT id, code, config_schema FROM plugins WHERE slug = ?")
    .get(slug) as { id: string; code: string; config_schema: string } | undefined;

  if (!plugin) {
    return Response.json({ error: "Plugin not found" }, { status: 404 });
  }

  let body: { animation_json?: unknown; config?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.animation_json) {
    return Response.json({ error: "animation_json is required" }, { status: 400 });
  }

  const result = executePluginTransform(
    plugin.code,
    body.animation_json,
    body.config || {}
  );

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ success: true, output: result.output });
}
