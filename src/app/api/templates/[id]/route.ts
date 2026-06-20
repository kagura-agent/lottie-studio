import { templates } from "../../../../../data/templates";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = templates.find((t) => t.id === id);

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "templates", template.filename);

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Template file not found" }, { status: 404 });
  }

  const lottieJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  return Response.json({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    filename: template.filename,
    lottieJson,
  });
}
