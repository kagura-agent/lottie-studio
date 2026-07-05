import { authenticateRequest } from "@/lib/apiAuth";
import { checkApiRate } from "@/lib/rateLimiter";
import { templates } from "@/data/templates";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // Rate limit
  const rate = checkApiRate(auth.keyId, auth.rateLimit);
  if (!rate.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const { id } = await params;
  const template = templates.find((t) => t.id === id);

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "templates",
    template.filename
  );

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Template file not found" }, { status: 404 });
  }

  const lottieJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  return Response.json({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    lottieJson,
  });
}
