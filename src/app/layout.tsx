import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const TEMA_ANAHTARI = "ikbalspor_theme";

// Hydration'dan ÖNCE uygulanır; koyu temada sayfa açılırken beyaz parlama olmaz.
const temaBetigi = `try{var t=localStorage.getItem("${TEMA_ANAHTARI}");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark");}}catch(e){}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display fontu — başlıklarda Geist'in geometrik siyahlığına
// karşı karakterli bir serif kontrastı kurar (two26 çizgisi).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ikbalspor.com"),
  title: {
    default: "Çorum İkbal Spor Kulübü • Resmi Kulüp & Sporcu Platformu",
    template: "%s | Çorum İkbal Spor Kulübü",
  },
  description:
    "Çorum İkbal Spor Kulübü 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları, duyurular ve kulüp iletişim platformu.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://ikbalspor.com",
    siteName: "Çorum İkbal Spor Kulübü",
    title: "Çorum İkbal Spor Kulübü • Resmi Kulüp & Sporcu Platformu",
    description:
      "Çorum İkbal Spor Kulübü 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları ve duyurular.",
    images: [
      {
        url: "/logo-square.png",
        width: 1024,
        height: 1024,
        alt: "Çorum İkbal Spor Kulübü Kulüp Logosu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Çorum İkbal Spor Kulübü • Resmi Kulüp & Sporcu Platformu",
    description:
      "Çorum İkbal Spor Kulübü 2026–2027 sezonu kadro kurulumu, maç ve antrenman programı, sporcu kartları ve duyurular.",
    images: ["/logo-square.png"],
  },
  icons: {
    icon: "/logo-square.png",
    shortcut: "/logo-square.png",
    apple: "/logo-square.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <Script id="ikbal-tema" strategy="beforeInteractive">
          {temaBetigi}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}