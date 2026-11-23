import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Çorum İkbalspor • Resmi Kulüp Platformu",
    short_name: "İkbalspor",
    description:
      "Çorum İkbalspor kadro kurulumu, maç programı, QR yoklama, sporcu kartları ve kulüp duyuruları.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b2545",
    theme_color: "#0b2545",
    lang: "tr",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}