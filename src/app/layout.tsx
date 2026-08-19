import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mabruk Store",
  description: "Inventory & POS — Mabruk General Food Store",
  icons: {
    icon: [
      { url: "/favicon-16x16.png",  sizes: "16x16",  type: "image/png" },
      { url: "/favicon-32x32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/favicon-48x48.png",  sizes: "48x48",  type: "image/png" },
      { url: "/favicon-64x64.png",  sizes: "64x64",  type: "image/png" },
      { url: "/favicon-128x128.png",sizes: "128x128",type: "image/png" },
      { url: "/favicon-192x192.png",sizes: "192x192",type: "image/png" },
      { url: "/favicon.ico",        sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  themeColor: "#5B2A86",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
