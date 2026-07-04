import type { Metadata } from "next";
import GalleryPage from "@/components/GalleryPage";

const description =
  "Chat-driven Lottie animation studio. Describe what you want in natural language and watch it come alive. Export as JSON, GIF, video, and more.";

export const metadata: Metadata = {
  title: "Lottie Studio — Create Animations with AI",
  description,
  openGraph: {
    title: "Lottie Studio — Create Animations with AI",
    description,
    images: [{ url: "/screenshots/hero.png", width: 1280, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lottie Studio — Create Animations with AI",
    description,
    images: ["/screenshots/hero.png"],
  },
};

export default function Home() {
  return <GalleryPage />;
}
