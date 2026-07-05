import { authenticateRequest } from "@/lib/apiAuth";
import { checkApiRate } from "@/lib/rateLimiter";
import { templates } from "@/data/templates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const list = templates.map(({ id, name, description, category }) => ({
    id,
    name,
    description,
    category,
  }));

  return Response.json({ templates: list });
}
