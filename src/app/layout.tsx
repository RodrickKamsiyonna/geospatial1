import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeoHealth AI — Settlement & Accessibility Intelligence",
  description:
    "Classify any Nigerian location by settlement type using GHS-SMOD R2023A and surface health-facility accessibility with a Gemini-powered plain-language interpreter.",
  keywords: [
    "GeoHealth",
    "GHS-SMOD",
    "Nigeria",
    "accessibility",
    "Mapbox",
    "Gemini",
    "geospatial AI",
  ],
  authors: [{ name: "Sproxil / GeoHealth V1" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
