import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const viewport: Viewport = {
  themeColor: "#0b2545",
  width: "device-width",
  initialScale: 1,
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ikbalspor.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Çorum İkbalspor • Resmi Kulüp ve Sporcu Portalı",
    template: "%s | Çorum İkbalspor",
  },
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
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: "Çorum İkbalspor",
    title: "Çorum İkbalspor • Resmi Kulüp ve Sporcu Portalı",
    description:
      "Çorum İkbalspor antrenman, maç takvimi, taktik kadro, aidat ve QR yoklama portalı.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Çorum İkbalspor Kulüp Logosu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Çorum İkbalspor • Resmi Kulüp ve Sporcu Portalı",
    description:
      "Çorum İkbalspor antrenman, maç takvimi, taktik kadro, aidat ve QR yoklama portalı.",
    images: ["/logo.png"],
  },
};

const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem("ikbalspor_theme");
      var theme = saved === "dark" || saved === "light" ? saved : "light";
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-clip`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full w-full max-w-full overflow-x-clip flex flex-col pb-16 lg:pb-0 bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans transition-colors duration-150">
        <div className="page-transition min-h-full w-full flex-1 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}