import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const current = db
    .prepare("SELECT id, tags FROM animations WHERE id = ?")
    .get(id) as { id: string; tags: string | null } | undefined;

  if (!current) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const currentTags = current.tags
    ? current.tags.split(",").filter(Boolean)
    : [];

  let results: { id: string; name: string; tags: string | null; description: string | null }[];

  if (currentTags.length > 0) {
    // Find animations with overlapping tags, ranked by overlap count
    const allCandidates = db
      .prepare(
        "SELECT id, name, tags, description FROM animations WHERE id != ? AND tags IS NOT NULL AND tags != ''"
      )
      .all(id) as { id: string; name: string; tags: string | null; description: string | null }[];

    const scored = allCandidates
      .map((row) => {
        const rowTags = row.tags ? row.tags.split(",").filter(Boolean) : [];
        const overlap = rowTags.filter((t) => currentTags.includes(t)).length;
        return { ...row, overlap };
      })
      .filter((r) => r.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 6);

    if (scored.length > 0) {
      results = scored.map((s) => ({
        id: s.id,
        name: s.name,
        tags: s.tags,
        description: s.description,
      }));
    } else {
      // No tag matches — fall back to recent
      results = db
        .prepare(
          "SELECT id, name, tags, description FROM animations WHERE id != ? ORDER BY created_at DESC LIMIT 6"
        )
        .all(id) as typeof results;
    }
  } else {
    // No tags on current animation — fall back to recent
    results = db
      .prepare(
        "SELECT id, name, tags, description FROM animations WHERE id != ? ORDER BY created_at DESC LIMIT 6"
      )
      .all(id) as typeof results;
  }

  return Response.json(results);
}
