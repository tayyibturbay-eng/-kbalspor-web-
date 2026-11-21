import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#02274c",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Çorum İkbalspor • Resmi Kulüp ve Sporcu Portalı",
  description:
    "Çorum İkbalspor antrenman, maç takvimi, taktik kadro, aidat ve QR yoklama portalı.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "İkbalspor",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-clip`}
    >
      <body className="min-h-full w-full max-w-full overflow-x-clip flex flex-col pb-16 lg:pb-0">
        {children}
      </body>
    </html>
  );
}