import { updateSequenceItem, removeSequenceItem, VALID_TRANSITIONS } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;

  const body = await request.json();
  const { position, transition_type, transition_duration_ms } = body;

  if (
    transition_type &&
    !VALID_TRANSITIONS.includes(transition_type)
  ) {
    return Response.json(
      { error: `Invalid transition_type. Valid types: ${VALID_TRANSITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const fields: { position?: number; transitionType?: string; transitionDurationMs?: number } = {};
  if (position !== undefined) fields.position = position;
  if (transition_type !== undefined) fields.transitionType = transition_type;
  if (transition_duration_ms !== undefined) fields.transitionDurationMs = transition_duration_ms;

  if (Object.keys(fields).length === 0) {
    return Response.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = updateSequenceItem(itemId, fields);
  if (!updated) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params;

  const removed = removeSequenceItem(itemId);
  if (!removed) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
