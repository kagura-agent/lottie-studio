import { getSequence, updateSequence, deleteSequence } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const seq = getSequence(id);
  if (!seq) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(seq);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const seq = getSequence(id);
  if (!seq) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, description } = body;

  const updates: { name?: string; description?: string } = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  updateSequence(id, updates);
  const updated = getSequence(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const seq = getSequence(id);
  if (!seq) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  deleteSequence(id);
  return Response.json({ success: true });
}
