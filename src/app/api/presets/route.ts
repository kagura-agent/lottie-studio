import { getAllPresets, createPreset } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const presets = getAllPresets();
  return Response.json(presets);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, instructions } = body;

  if (!name?.trim() || !instructions?.trim()) {
    return Response.json(
      { error: "name and instructions are required" },
      { status: 400 }
    );
  }

  const creatorId = request.headers.get("x-creator-id") || undefined;

  try {
    const preset = createPreset(name.trim(), description?.trim() || null, instructions.trim(), creatorId);
    return Response.json(preset, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create preset";
    if (message.includes("UNIQUE constraint")) {
      return Response.json(
        { error: `A preset named "${name}" already exists` },
        { status: 409 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
