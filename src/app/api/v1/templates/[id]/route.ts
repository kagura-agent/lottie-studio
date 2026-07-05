import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { withApiKey } from "@/lib/api-middleware";
import { templates } from "@/data/templates";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

export const dynamic = "force-dynamic";

export const GET = withApiKey(async ({ request }) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  const template = templates.find((t) => t.id === id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const jsonPath = path.join(TEMPLATES_DIR, template.filename);
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ error: "Template data not found" }, { status: 404 });
  }

  const lottieJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  return NextResponse.json({
    id: template.id,
    name: template.name,
    category: template.category,
    lottieJson,
  });
});
