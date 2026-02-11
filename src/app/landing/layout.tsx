import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ascendia AI - Automated Booking Solution",
  description: "AI Receptionist for Text, Voice, and Web. Google Calendar integration and WhatsApp. Never miss a booking request.",
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}











