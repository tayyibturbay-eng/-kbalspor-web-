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

function formatShortDate(raw: string): string {
  if (!raw) return "";
  const clean = raw.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return clean;
}

function isUpcomingEvent(item: TaskItem): boolean {
  if (!item.event_date) return false;
  const datePart = item.event_date.slice(0, 10);
  const timePart = (item.match_time || "").trim();

  if (/^\d{1,2}:\d{2}/.test(timePart)) {
    const [hh, mm] = timePart.split(":").map((n) => parseInt(n, 10));
    const eventDt = new Date(`${datePart}T00:00:00`);
    if (Number.isNaN(eventDt.getTime())) return false;
    eventDt.setHours(Number.isNaN(hh) ? 23 : hh, Number.isNaN(mm) ? 59 : mm, 59, 999);
    return eventDt.getTime() >= Date.now();
  }

  const dayEnd = new Date(`${datePart}T23:59:59`);
  if (Number.isNaN(dayEnd.getTime())) return false;
  return dayEnd.getTime() >= Date.now();
}

function buildMapsUrl(location?: string | null): string {
  const query = (location || "Nazmi Avluca Spor Tesisi Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
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
        .select(
          "id, title, task_type, age_group, event_date, match_time, location"
        )
        .gte("event_date", todayStr)
        .order("event_date", { ascending: true })
        .limit(12);
      if (data) {
        const filtered = (data as TaskItem[]).filter(isUpcomingEvent);
        setUpcoming(filtered.slice(0, 4));
      }
    })();
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-full overflow-x-clip">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#02274c] via-[#04376b] to-[#a60513] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5 min-w-0">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider max-w-full truncate">
                <img
                  src="/logo.png"
                  alt="Çorum İkbalspor"
                  className="w-4 h-4 rounded-xs object-contain bg-white p-0.5"
                />
                <span>Çorum İkbalspor • Süper Amatör Lig</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight break-words">
                Geleceğin Yıldızları{" "}
                <span className="text-red-300">İkbalspor</span> Çatısı Altında
                Yetişiyor
              </h1>

              <p className="text-sm sm:text-lg text-slate-100 leading-relaxed max-w-2xl break-words">
                U11&apos;den U19&apos;a tüm yaş kategorilerinde antrenman ve maç
                görevleri, aidat ve malzeme takibi, Cumartesi sabah namazı QR
                yoklaması ve kendi kadronu kurma heyecanı tek platformda.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
                <Link
                  href="/kadro-kur"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#a60513] hover:bg-red-700 border border-white/20 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center text-center shadow-lg transition"
                >
                  Kendi Kadronu Kur (U11–U19 & SAL)
                </Link>
                <Link
                  href="/gorevler"
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-xs sm:text-sm flex items-center justify-center text-center shadow-lg transition"
                >
                  Görevler & Maç Takvimi
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 min-w-0">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/15 pb-3 gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold truncate">
                    Yaklaşan Etkinlikler
                  </h2>
                  <Link
                    href="/gorevler"
                    className="text-xs font-bold text-red-200 hover:underline shrink-0"
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
                        className="rounded-xl bg-white/10 border border-white/15 p-3 min-w-0"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#a60513] text-[11px] font-extrabold shrink-0">
                            {t.age_group}
                          </span>
                          <span className="font-bold text-sm break-words">
                            {t.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-200 mt-1 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {formatShortDate(t.event_date)}
                            {t.match_time ? ` • ${t.match_time}` : ""}
                            {t.location ? ` • ${t.location}` : ""}
                          </span>
                          {t.location && (
                            <a
                              href={buildMapsUrl(t.location)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-200 hover:underline font-bold shrink-0"
                            >
                              📍 Harita
                            </a>
                          )}
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
          <div className="bg-gradient-to-br from-[#02274c] via-[#043666] to-[#a60513] rounded-3xl p-5 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl text-center md:text-left min-w-0">
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

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center md:justify-start gap-3 pt-2">
                <a
                  href="https://expo.dev/artifacts/eas/l4EQmLbEoUQ0wNiWJLdDoIpLOFg5E8RO1vz9YG1kIw0.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl shadow-md transition text-xs sm:text-sm text-center"
                >
                  <span>🤖</span>
                  <span>Android Uygulamamız Yayında (APK İndir)</span>
                </a>

                <div className="inline-flex items-center justify-center gap-2 bg-white/15 border border-white/25 text-slate-100 font-semibold px-4 py-3 rounded-xl text-xs sm:text-sm text-center">
                  <span>🍎</span>
                  <span>iPhone: Safari → Paylaş → Ana Ekrana Ekle</span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-44 h-72 sm:w-52 sm:h-88 bg-slate-950 rounded-[2.4rem] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col items-center justify-center">
                <div className="w-20 h-3.5 bg-slate-900 rounded-full absolute top-3" />
                <div className="w-full h-full bg-gradient-to-b from-[#02274c] to-[#0a192f] rounded-[1.8rem] flex flex-col items-center justify-center p-4 text-center border border-white/10">
                  <img
                    src="/logo.png"
                    alt="Çorum İkbalspor Logo"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl bg-white p-2 shadow-lg mb-3"
                  />
                  <p className="font-extrabold text-xs sm:text-sm text-white tracking-wide">
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

        {/* Üyelik Başvuru Açılır Pencere Tetikleyici Alanı */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div
            onClick={() => setShowRegModal(true)}
            className="cursor-pointer rounded-3xl bg-white border-2 border-dashed border-[#02274c]/30 hover:border-[#a60513] hover:shadow-lg transition p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="space-y-1 text-center sm:text-left min-w-0">
              <span className="inline-block bg-[#a60513] text-white text-xs font-bold px-3 py-1 rounded-full mb-1">
                Kulübe Katıl
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-[#02274c]">
                Sporcu Üyelik Başvuru Formu
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Başvuru formunu açmak için tıklayın (18 yaş altı için velisi
                doldurmalıdır).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRegModal(true)}
              className="w-full sm:w-auto shrink-0 rounded-xl bg-[#02274c] hover:bg-[#a60513] text-white font-bold px-6 py-3.5 text-sm transition shadow cursor-pointer"
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
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2.5 font-extrabold text-white">
            <img
              src="/logo.png"
              alt="Çorum İkbalspor"
              className="w-7 h-7 rounded-md bg-white p-0.5 object-contain"
            />
            <span>Çorum İkbalspor • Çorum</span>
          </div>
          <div className="text-slate-300">
            © {currentYear} Çorum İkbalspor. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}