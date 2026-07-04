import { getSequence, addSequenceItem, VALID_TRANSITIONS } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const seq = getSequence(id);
  if (!seq) {
    return Response.json({ error: "Sequence not found" }, { status: 404 });
  }

  const body = await request.json();
  const { animation_id, position, transition_type, transition_duration_ms } = body;

  if (!animation_id) {
    return Response.json(
      { error: "animation_id is required" },
      { status: 400 }
    );
  }

  if (
    transition_type &&
    !VALID_TRANSITIONS.includes(transition_type)
  ) {
    return Response.json(
      { error: `Invalid transition_type. Valid types: ${VALID_TRANSITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const item = addSequenceItem(
    id,
    animation_id,
    position,
    transition_type,
    transition_duration_ms
  );

  return Response.json(item, { status: 201 });
}
