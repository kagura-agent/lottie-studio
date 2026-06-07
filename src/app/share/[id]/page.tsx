import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import ShareView from "@/components/ShareView";
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://lottie.kagura-agent.com";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const row = db.prepare("SELECT * FROM animations WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    return { title: "Not Found" };
  }

  const name = (row.name as string) ?? "Untitled";
  const url = `${BASE_URL}/share/${id}`;
  const thumbnailUrl = `${BASE_URL}/api/animations/${id}/thumbnail`;

  return {
    title: name,
    description: "Lottie animation created with Lottie Studio",
    openGraph: {
      title: name,
      description: "Lottie animation created with Lottie Studio",
      url,
      images: [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 630,
          alt: name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description: "Lottie animation created with Lottie Studio",
      images: [thumbnailUrl],
    },
  };
}

export default async function SharePage({ params }: Props) {
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
