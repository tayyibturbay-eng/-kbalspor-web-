import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-2">
          <h1 className="text-3xl font-black">Çorum İkbalspor İletişim</h1>
          <p className="text-slate-100">
            Altyapı kayıtları, antrenman programları ve kulüp duyuruları için
            bizimle iletişime geçebilirsiniz.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 pt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-extrabold text-[#02274c]">Kulüp Merkezi</h2>
          <p className="text-slate-700">
            <strong>Kulüp:</strong> Çorum İkbalspor (İkbalspor)
          </p>
          <p className="text-slate-700">
            <strong>Kategori:</strong> Profesyonelliğe Geçiş Ligi & Altyapı (U11 – U19)
          </p>
          <p className="text-slate-700">
            <strong>Şehir:</strong> Çorum, Türkiye
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/mesajlar"
              className="min-h-[48px] px-6 rounded-xl bg-[#a60513] text-white font-extrabold flex items-center justify-center"
            >
              Mesajlaşma Paneline Git
            </Link>
            <Link
              href="/gorevler"
              className="min-h-[48px] px-6 rounded-xl bg-[#02274c] text-white font-extrabold flex items-center justify-center"
            >
              Antrenman & Maç Takvimi
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100">
            <iframe
              title="Çorum İkbalspor Harita"
              src="https://maps.google.com/maps?q=%C3%87orum&t=&z=13&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </main>
    </div>
  );
}