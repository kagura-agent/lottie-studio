import { createSequence, listSequences } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return Response.json(
      { error: "creator_id query parameter is required" },
      { status: 400 }
    );
  }

  const rows = listSequences(creatorId);
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, description, creator_id } = body;

  if (!name || !creator_id) {
    return Response.json(
      { error: "name and creator_id are required" },
      { status: 400 }
    );
  }

  const seq = createSequence(name, description || "", creator_id);
  return Response.json(seq, { status: 201 });
}
