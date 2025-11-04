import type { Metadata } from "next";
import "./globals.css";
import "./lib/envSetup";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "AGENT13",
  description: "Ascendia AI",
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "AGENT13",
    description: "Ascendia AI",
    type: "website",
    url: siteUrl || undefined,
    images: [
      {
        url: "/screenshot_chat_supervisor.png",
        width: 1200,
        height: 630,
        alt: "AGENT13 – Ascendia AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AGENT13",
    description: "Ascendia AI",
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
      <body className={`antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
