import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ToastWrapper } from "@/components/ToastWrapper";
import { DesignTokensProvider } from "@/contexts/DesignTokensContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lottie Studio",
  description: "Interactive Lottie animation editor and preview",
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <NextIntlClientProvider messages={messages}>
          <DesignTokensProvider>
          <ToastWrapper>
            <ServiceWorkerRegistration />
            {children}
          </ToastWrapper>
          </DesignTokensProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
