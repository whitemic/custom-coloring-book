import type { Metadata } from "next";
import { Geist, Geist_Mono, Caveat, Nunito } from "next/font/google";
import { QuickNav } from "@/components/quick-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Storybook Dreams - Custom Coloring Books",
  description:
    "AI-powered custom coloring books. Describe your character, pick an adventure, and get a 20-page PDF delivered to your inbox in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${nunito.variable} antialiased h-full`}
      >
        <QuickNav />
        {children}
      </body>
    </html>
  );
}
