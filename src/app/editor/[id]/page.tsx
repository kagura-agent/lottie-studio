import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import EditorLayout from "@/components/EditorLayout";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    notFound();
  }

  const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
  let data = null;
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  if (!data) {
    notFound();
  }

  // Look up remix provenance
  let remixedFrom: { id: string; name: string } | undefined;
  if (row.remixed_from) {
    const original = db
      .prepare("SELECT id, name FROM animations WHERE id = ?")
      .get(row.remixed_from as string) as { id: string; name: string } | undefined;
    if (original) {
      remixedFrom = { id: original.id, name: original.name };
    }
  }

  return (
    <EditorLayout
      id={id}
      initialName={(row.name as string) ?? "Untitled"}
      initialData={data}
      remixedFrom={remixedFrom}
    />
  );
}
