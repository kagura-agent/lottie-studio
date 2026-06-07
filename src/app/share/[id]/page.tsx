import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import ShareView from "@/components/ShareView";

export default async function SharePage({
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

  return (
    <ShareView
      id={id}
      name={(row.name as string) ?? "Untitled"}
      animationData={data}
    />
  );
}
