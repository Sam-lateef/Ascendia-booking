import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";
import { SuppressDevToolsError } from "./components/SuppressDevToolsError";
import { TranslationProvider } from "../lib/i18n/TranslationProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "Ascendia AI",
  description: "Ascendia AI - Advanced Voice AI Platform",
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Ascendia AI",
    description: "Ascendia AI - Advanced Voice AI Platform",
    type: "website",
    url: siteUrl || undefined,
    images: [
      {
        url: "/screenshot_chat_supervisor.png",
        width: 1200,
        height: 630,
        alt: "Ascendia AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ascendia AI",
    description: "Ascendia AI - Advanced Voice AI Platform",
    images: ["/screenshot_chat_supervisor.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`antialiased`} suppressHydrationWarning>
        <SuppressDevToolsError />
        <TranslationProvider>
          <AuthProvider>
            <OrganizationProvider>
              {children}
            </OrganizationProvider>
          </AuthProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}
