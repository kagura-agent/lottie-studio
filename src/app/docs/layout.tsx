import type { Metadata } from "next";

const description =
  "REST API documentation for Lottie Studio — generate animations, browse the gallery, and integrate Lottie JSON into your projects.";

export const metadata: Metadata = {
  title: "API Documentation — Lottie Studio",
  description,
  openGraph: {
    title: "API Documentation — Lottie Studio",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "API Documentation — Lottie Studio",
    description,
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
