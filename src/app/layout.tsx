import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://ikbalspor.com"),
  title: {
    default: "Çorum İkbalspor • Resmi Kulüp & Sporcu Platformu",
    template: "%s | Çorum İkbalspor",
  },
  description:
    "Çorum İkbalspor 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları, duyurular ve kulüp iletişim platformu.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://ikbalspor.com",
    siteName: "Çorum İkbalspor",
    title: "Çorum İkbalspor • Resmi Kulüp & Sporcu Platformu",
    description:
      "Çorum İkbalspor 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları ve duyurular.",
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
    title: "Çorum İkbalspor • Resmi Kulüp & Sporcu Platformu",
    description:
      "Çorum İkbalspor 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları ve duyurular.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}