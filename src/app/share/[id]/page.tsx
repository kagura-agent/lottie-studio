import { db, ANIMATIONS_DIR } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ShareView from "@/components/ShareView";
import RelatedAnimations from "@/components/RelatedAnimations";
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
  const description =
    (row.description as string) || "Lottie animation created with Lottie Studio";
  const url = `${BASE_URL}/share/${id}`;
  const thumbnailUrl = `${BASE_URL}/api/animations/${id}/thumbnail`;

  return {
    title: name,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: name,
      description,
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
      description,
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

  // Fetch chat messages when share_chat is enabled
  let messages: { role: string; content: string; imageUrl?: string }[] | undefined;
  if (row.share_chat) {
    const rows = db
      .prepare(
        "SELECT role, content, image_url FROM messages WHERE animation_id = ? ORDER BY created_at ASC"
      )
      .all(id) as { role: string; content: string; image_url: string | null }[];
    if (rows.length > 0) {
      messages = rows.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.image_url ? { imageUrl: m.image_url } : {}),
      }));
    }
  }

  const name = (row.name as string) ?? "Untitled";
  const viewCount = (row.view_count as number) ?? 0;
  const animDescription =
    (row.description as string) || "Lottie animation created with Lottie Studio";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description: animDescription,
    url: `${BASE_URL}/share/${id}`,
    thumbnailUrl: `${BASE_URL}/api/animations/${id}/thumbnail`,
    dateCreated: row.created_at as string,
    author: {
      "@type": "Organization",
      name: "Lottie Studio",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense>
        <ShareView
          id={id}
          name={name}
          animationData={data}
          messages={messages}
          viewCount={viewCount}
        />
      </Suspense>
      <RelatedAnimations animationId={id} />
    </>
  );
}
