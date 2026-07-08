import type { Metadata } from "next";
import PricingPage from "@/components/PricingPage";

export const metadata: Metadata = {
  title: "Pricing | Lottie Studio",
  description:
    "Choose the plan that fits your needs. Free, Pro, and Team tiers for Lottie animation creation.",
  openGraph: {
    title: "Pricing | Lottie Studio",
    description:
      "Choose the plan that fits your needs. Free, Pro, and Team tiers for Lottie animation creation.",
    type: "website",
  },
};

export default function Pricing() {
  return <PricingPage />;
}
