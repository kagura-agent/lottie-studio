import type { Metadata } from "next";
import ExplorePage from "@/components/ExplorePage";

export const metadata: Metadata = {
  title: "Explore Animations | Lottie Studio",
  description:
    "Discover animations created by the community. Browse, preview, and remix Lottie animations.",
  openGraph: {
    title: "Explore Animations | Lottie Studio",
    description:
      "Discover animations created by the community. Browse, preview, and remix Lottie animations.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Explore Animations | Lottie Studio",
    description:
      "Discover animations created by the community. Browse, preview, and remix Lottie animations.",
  },
};

export default function Explore() {
  return <ExplorePage />;
}
