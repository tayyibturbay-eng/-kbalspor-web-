"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import { MembershipModal } from "@/components/ikbal/MembershipModal";
import { createClient } from "@/lib/supabase/client";

interface TaskItem {
  id: string;
  title: string;
  task_type: "antrenman" | "mac" | "etkinlik";
  age_group: string;
  event_date: string;
  match_time?: string | null;
  location: string | null;
}

export default function IkbalHomePage() {
  const [upcoming, setUpcoming] = useState<TaskItem[]>([]);
  const [currentYear, setCurrentYear] = useState(2026);
  const [showRegModal, setShowRegModal] = useState(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    const todayStr = new Date().toISOString().slice(0, 10);

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks_assignments")
        .select("id, title, task_type, age_group, event_date, match_time, location")
        .gte("event_date", todayStr)
        .order("event_date", { ascending: true })
        .limit(4);
      if (data) setUpcoming(data as TaskItem[]);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#02274c] via-[#04376b] to-[#a60513] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-extrabold uppercase tracking-wider">
                Çorum İkbalspor • Çorum Süper Amatör Ligi
              </span>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                Geleceğin Yıldızları{" "}
                <span className="text-red-300">İkbalspor</span> Çatısı Altında
                Yetişiyor
              </h1>

              <p className="text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                U11&apos;den U19&apos;a tüm yaş kategorilerinde antrenman ve maç
                görevleri, aidat ve malzeme takibi, Cumartesi sabah namazı QR
                yoklaması ve kendi kadronu kurma heyecanı tek platformda.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/kadro-kur"
                  className="px-6 py-3.5 rounded-xl bg-[#a60513] hover:bg-red-700 border border-white/20 text-white font-extrabold text-sm flex items-center justify-center shadow-lg transition"
                >
                  Kendi Kadronu Kur (U11–U19 & Çorum Süper Amatör Ligi)
                </Link>
                <Link
                  href="/gorevler"
                  className="px-6 py-3.5 rounded-xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-sm flex items-center justify-center shadow-lg transition"
                >
                  Görevler & Maç Takvimi
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <h2 className="text-base sm:text-lg font-extrabold">
                    Yaklaşan Etkinlikler
                  </h2>
                  <Link
                    href="/gorevler"
                    className="text-xs font-bold text-red-200 hover:underline"
                  >
                    Tümünü Gör →
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Yaklaşan planlanmış antrenman veya maç yok. Yönetim
                    panelinden ekleyebilirsiniz.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl bg-white/10 border border-white/15 p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-[#a60513] text-[11px] font-extrabold mr-2">
                            {t.age_group}
                          </span>
                          <span className="font-bold text-sm">{t.title}</span>
                          <p className="text-xs text-slate-200 mt-0.5">
                            {t.event_date}
                            {t.match_time ? ` • ${t.match_time}` : ""}
                            {t.location ? ` • ${t.location}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Mobil Uygulama Tanıtım Kartı */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <div className="bg-gradient-to-br from-[#02274c] via-[#043666] to-[#a60513] rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl text-center md:text-left">
              <span className="inline-block bg-white/15 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Resmi Mobil Uygulama
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Çorum İkbalspor Cebinizde!
              </h2>
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                Antrenman programları, maç takvimi, taktik kadro kurma ve QR
                yoklama işlemleri tek uygulamada.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <a
                  href="https://expo.dev/artifacts/eas/RSYM9khkYpmRNHiqoXkIbhPkUI2Lw9IqvIO8Xch26nA.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl shadow-md transition text-sm"
                >
                  <span>🤖</span>
                  <span>Android Uygulamamız Yayında (APK İndir)</span>
                </a>

                <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-slate-100 font-semibold px-4 py-3 rounded-xl text-xs sm:text-sm">
                  <span>🍎</span>
                  <span>iPhone: Safari → Paylaş → Ana Ekrana Ekle</span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-48 h-80 sm:w-52 sm:h-88 bg-slate-950 rounded-[2.4rem] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col items-center justify-center">
                <div className="w-20 h-3.5 bg-slate-900 rounded-full absolute top-3" />
                <div className="w-full h-full bg-gradient-to-b from-[#02274c] to-[#0a192f] rounded-[1.8rem] flex flex-col items-center justify-center p-4 text-center border border-white/10">
                  <img
                    src="/logo.png"
                    alt="Çorum İkbalspor Logo"
                    className="w-20 h-20 object-contain rounded-2xl bg-white p-2 shadow-lg mb-3"
                  />
                  <p className="font-extrabold text-sm text-white tracking-wide">
                    ÇORUM İKBALSPOR
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Sporcu & Yönetim Portalı
                  </p>
                  <span className="mt-3 bg-[#a60513] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    Android Yayında
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hızlı Modüller */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/kadro-kur"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Kendi Kadronu Kur
            </h3>
            <p className="text-sm text-slate-600">
              U11–U19 ve Çorum Süper Amatör Ligi gerçek oyuncu kadrolarından
              kendi ilk 11&apos;ini oluştur.
            </p>
          </Link>

          <Link
            href="/gorevler"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Antrenman & Maç Görevleri
            </h3>
            <p className="text-sm text-slate-600">
              Yaş grubuna uygun antrenman faaliyetlerini ve maçları takip et.
            </p>
          </Link>

          <Link
            href="/mesajlar"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Mesajlaşma & Duyurular
            </h3>
            <p className="text-sm text-slate-600">
              Antrenör duyuruları, hatırlatıcılar ve hızlı iletişim alanı.
            </p>
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Aidat, Malzeme & Sabah Namazı QR
            </h3>
            <p className="text-sm text-slate-600">
              Yönetici panelinden aidat, malzeme ve Cumartesi QR yoklamasını
              yönet.
            </p>
          </Link>
        </section>

        {/* Üyelik Başvuru Açılır Pencere Tetikleyici Alanı */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div
            onClick={() => setShowRegModal(true)}
            className="cursor-pointer rounded-3xl bg-white border-2 border-dashed border-[#02274c]/30 hover:border-[#a60513] hover:shadow-lg transition p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="space-y-1 text-center sm:text-left">
              <span className="inline-block bg-[#a60513] text-white text-xs font-bold px-3 py-1 rounded-full mb-1">
                Kulübe Katıl
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#02274c]">
                Sporcu Üyelik Başvuru Formu
              </h2>
              <p className="text-sm text-slate-600">
                Başvuru formunu açmak için tıklayın (18 yaş altı için velisi
                doldurmalıdır).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRegModal(true)}
              className="shrink-0 rounded-xl bg-[#02274c] hover:bg-[#a60513] text-white font-bold px-6 py-3.5 text-sm transition shadow cursor-pointer"
            >
              Başvuru Formunu Aç
            </button>
          </div>
        </section>
      </main>

      <MembershipModal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        currentYear={currentYear}
      />

      <footer className="bg-[#02274c] text-slate-200 border-t-4 border-[#a60513] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="font-extrabold text-white">
            Çorum İkbalspor • İkbalspor Kulübü
          </div>
          <div className="text-slate-300">
            © 2026 İkbalspor. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}