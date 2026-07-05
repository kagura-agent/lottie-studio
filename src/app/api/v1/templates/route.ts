import { NextResponse } from "next/server";
import { withApiKey } from "@/lib/api-middleware";
import { templates } from "@/data/templates";

export const dynamic = "force-dynamic";

export const GET = withApiKey(async () => {
  const list = templates.map(({ id, name, category }) => ({
    id,
    name,
    category,
  }));

  return NextResponse.json({ templates: list });
});
