import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://lottie.kagura-agent.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const animations = db
    .prepare("SELECT id, updated_at FROM animations")
    .all() as { id: string; updated_at: string }[];

  const animationEntries: MetadataRoute.Sitemap = animations.map((anim) => ({
    url: `${BASE_URL}/share/${anim.id}`,
    lastModified: new Date(anim.updated_at),
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
    },
    ...animationEntries,
  ];
}
