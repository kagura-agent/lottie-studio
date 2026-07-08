import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ToastWrapper } from "@/components/ToastWrapper";
import { DesignTokensProvider } from "@/contexts/DesignTokensContext";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Create Lottie animations by chatting with AI — describe what you want, see it instantly, refine with conversation.";

export const metadata: Metadata = {
  metadataBase: new URL("https://lottie.kagura-agent.com"),
  title: "Lottie Studio",
  description,
  keywords: [
    "lottie",
    "animation",
    "ai",
    "chat",
    "motion design",
    "json",
    "web animation",
  ],
  openGraph: {
    title: "Lottie Studio — AI-Powered Animation Creator",
    description,
    type: "website",
    url: "/",
    images: [{ url: "/screenshots/hero.png", width: 1280, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lottie Studio — AI-Powered Animation Creator",
    description,
    images: ["/screenshots/hero.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
          <DesignTokensProvider>
          <ToastWrapper>
            <ServiceWorkerRegistration />
            {children}
          </ToastWrapper>
          </DesignTokensProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
