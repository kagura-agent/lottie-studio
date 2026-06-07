import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import ShareView from "@/components/ShareView";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://lottie.kagura-agent.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    return { title: "Animation not found" };
  }

  const title = (row.name as string) || "Untitled";
  const description = "Lottie animation created with Lottie Studio";
  const thumbnailUrl = `${SITE_URL}/api/animations/${id}/thumbnail`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/share/${id}`,
      images: [{ url: thumbnailUrl, width: 600, height: 600 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [thumbnailUrl],
    },
  };
}

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
