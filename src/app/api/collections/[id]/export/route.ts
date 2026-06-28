import { db, ANIMATIONS_DIR } from "@/lib/db";
import { ZipArchive } from "archiver";
import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";

export const dynamic = "force-dynamic";

/** Sanitize a name for use as a filename — keep alphanumeric, dash, underscore, space, dot */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_ .]/g, "_").trim() || "animation";
}

/** Resolve duplicate file names by appending _2, _3, etc. */
function resolveFileNames(
  animations: { id: string; name: string }[]
): { id: string; name: string; fileName: string }[] {
  const seen = new Map<string, number>();
  return animations.map((a) => {
    const base = sanitizeFileName(a.name);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    const fileName = count === 1 ? `${base}.json` : `${base}_${count}.json`;
    return { id: a.id, name: a.name, fileName };
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const collection = db
    .prepare("SELECT * FROM collections WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!collection) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const animations = db
    .prepare(
      `SELECT a.id, a.name
       FROM collection_items ci
       JOIN animations a ON a.id = ci.animation_id
       WHERE ci.collection_id = ?
       ORDER BY ci.position ASC, ci.added_at ASC`
    )
    .all(id) as { id: string; name: string }[];

  if (animations.length === 0) {
    return Response.json({ error: "Collection is empty" }, { status: 400 });
  }

  const resolved = resolveFileNames(animations);

  // Build zip in memory
  const chunks: Buffer[] = [];
  const passthrough = new PassThrough();
  passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.pipe(passthrough);

  // Add each animation JSON
  for (const anim of resolved) {
    const filePath = path.join(ANIMATIONS_DIR, `${anim.id}.json`);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: anim.fileName });
    }
  }

  // Add manifest
  const manifest = {
    name: collection.name,
    description: collection.description || "",
    exportedAt: new Date().toISOString(),
    animationCount: resolved.length,
    animations: resolved.map((a) => ({
      id: a.id,
      name: a.name,
      fileName: a.fileName,
    })),
  };
  archive.append(JSON.stringify(manifest, null, 2), {
    name: "manifest.json",
  });

  await archive.finalize();

  // Wait for passthrough to finish collecting
  await new Promise<void>((resolve) => passthrough.on("end", resolve));

  const buffer = Buffer.concat(chunks);
  const collectionName = sanitizeFileName(String(collection.name)) || "collection";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${collectionName}.zip"`,
    },
  });
}
