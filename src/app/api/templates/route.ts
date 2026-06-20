import { templates } from "@/data/templates";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = templates.map(({ id, name, description, category }) => ({
    id,
    name,
    description,
    category,
  }));
  return Response.json(list);
}
