import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import EmbedPlayer from "./EmbedPlayer";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const row = db.prepare("SELECT name FROM animations WHERE id = ?").get(id) as
    | { name: string }
    | undefined;

  if (!row) {
    return { title: "Not Found" };
  }

  return {
    title: row.name ?? "Lottie Animation",
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const row = db.prepare("SELECT id FROM animations WHERE id = ?").get(id) as
    | { id: string }
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

  // Parse URL parameters with defaults
  const bg = query.bg ?? "";
  const autoplay = query.autoplay !== "0";
  const loop = query.loop !== "0";
  const controls = query.controls === "1";

  return (
    <EmbedPlayer
      animationData={data}
      bg={bg}
      autoplay={autoplay}
      loop={loop}
      controls={controls}
    />
  );
}
