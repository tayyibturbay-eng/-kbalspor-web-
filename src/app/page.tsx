"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import {
  AnnouncementCard,
  AnnouncementItem,
} from "@/components/ikbal/AnnouncementCard";
import {
  BolumBasligi,
  Iskelet,
  Metrik,
  Sira,
  SiraOgesi,
  Vitrin,
} from "@/components/ikbal/Motion";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { EASE, KART_HOVER, SPRING } from "@/lib/motion";

const supabase = createClient();

interface HomeTaskRow {
  id: string;
  title: string;
  age_group?: string | null;
  event_date?: string | null;
  match_time?: string | null;
  location?: string | null;
}

function formatShortDateTR(raw?: string | null, timeStr?: string | null): string {
  if (!raw) return "Tarih belirtilmedi";
  const dateOnly = raw.slice(0, 10);
  const parts = dateOnly.split("-");
  const formattedDate =
    parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateOnly;
  const cleanTime = (timeStr || "").slice(0, 5);
  return cleanTime ? `${formattedDate} • ${cleanTime}` : formattedDate;
}

export default function HomePage() {
  const [upcomingMatches, setUpcomingMatches] = useState<HomeTaskRow[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    AnnouncementItem[]
  >([]);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [ozetYukleniyor, setOzetYukleniyor] = useState<boolean>(true);
  const azaltilmis = useReducedMotion();

  const loadHomeSummaryData = useCallback(async () => {
    const [tasksRes, msgsRes, playersCountRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select("id, title, age_group, event_date, match_time, location")
        .order("event_date", { ascending: true })
        .limit(6),
      supabase
        .from("club_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("players").select("id", { count: "exact", head: true }),
    ]);

    if (tasksRes.data) setUpcomingMatches(tasksRes.data as HomeTaskRow[]);
    if (msgsRes.data) {
      const publicOnly = (msgsRes.data as AnnouncementItem[])
        .filter((m) => {
          const txt = `${m.body || ""} ${m.message_text || ""}`.trim();
          return !txt.startsWith("İletişim Mesajı");
        })
        .slice(0, 4);
      setRecentAnnouncements(publicOnly);
    }
    if (typeof playersCountRes.count === "number")
      setPlayerCount(playersCountRes.count);
  }, []);

  const loadHomeSummary = useCallback(async () => {
    try {
      await loadHomeSummaryData();
    } finally {
      setOzetYukleniyor(false);
    }
  }, [loadHomeSummaryData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHomeSummary();
    }, 0);

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadHomeSummary();
      },
      "web-home-live"
    );

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [loadHomeSummary]);

  useEffect(() => {
    if (!showIosGuide) return;
    const tusTuza = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowIosGuide(false);
    };
    window.addEventListener("keydown", tusTuza);
    return () => window.removeEventListener("keydown", tusTuza);
  }, [showIosGuide]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="k-sahne text-white py-14 sm:py-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div
            className="lg:col-span-8 space-y-5 k-girisi"
            style={{ "--k-g-y": "24px", animationDelay: "0.05s" } as React.CSSProperties}
          >
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Çorum İkbal Spor Kulübü • 2026–2027 Sezonu
            </div>
            <h1 className="k-posta k-posta--wonk text-posta text-white max-w-4xl">
              Altyapıdan Amatöre{" "}
              <span className="italic text-amber-200">Tek Yürek,</span>
              <br className="hidden sm:block" /> Tek Platform
            </h1>
            <p className="text-giris text-slate-200 max-w-2xl">
              Taktik kadro kurulumu, maç günü skor ve golcü tahminleri, QR
              yoklama takibi, aidat/malzeme ekranları ve kulüp duyuruları tek
              merkezde.
            </p>
            <div
              className="flex flex-wrap gap-3 pt-2 k-girisi"
              style={{ "--k-g-y": "16px", animationDelay: "0.3s" } as React.CSSProperties}
            >
              <Link
                href="/kadro-kur"
                className="px-6 py-3.5 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs sm:text-sm font-black shadow-md transition-colors"
              >
                Taktik Tahtası &amp; Kadro Kur
              </Link>
              <Link
                href="/kayit"
                className="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-[var(--brand-navy)] text-xs sm:text-sm font-black shadow-md transition-colors"
              >
                Kulübe Ön Kayıt Ol
              </Link>
            </div>
          </div>

          <div
            className="lg:col-span-4 k-girisi"
            style={{ "--k-g-y": "32px", animationDelay: "0.2s" } as React.CSSProperties}
          >
            <div className="rounded-3xl k-cam--marka p-6 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-square.png"
                  alt="Çorum İkbal Spor Kulübü"
                  className="w-12 h-12 rounded-2xl bg-white object-cover border border-white/30"
                />
                <div>
                  <div className="text-sm font-black tracking-tight">
                    Çorum İkbal Spor Kulübü
                  </div>
                  <div className="text-xs text-amber-200 font-bold">
                    Resmi Dijital Kulüp Portalı
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                <div className="rounded-xl bg-black/20 px-3 py-2.5">
                  <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                    Kategoriler
                  </div>
                  <div className="font-extrabold mt-1">Minikler – SAL</div>
                </div>
                <div className="rounded-xl bg-black/20 px-3 py-2.5">
                  <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                    Ana Tesis
                  </div>
                  <div className="font-extrabold mt-1">Nazmi Avluca</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12 sm:py-16 space-y-14 tabular-nums">
        <Sira className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SiraOgesi>
            <div className="k-artik k-kart p-6 h-40 flex flex-col justify-between">
              <span className="k-koz text-koz">
                Kayıtlı Sporcu Kadrosu
              </span>
              {ozetYukleniyor ? (
                <Iskelet className="h-10 w-32 mt-3" radius={10} />
              ) : (
                <Metrik className="text-metrik font-black text-[var(--brand-ink)]">
                  {playerCount}{" "}
                  <span className="text-base font-extrabold align-baseline text-[var(--text-secondary)]">
                    Sporcu
                  </span>
                </Metrik>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Minikler, U11–U19 ve Süper Amatör yaş grupları
              </p>
            </div>
          </SiraOgesi>

          <SiraOgesi>
            <div className="k-artik k-kart p-6 h-40 flex flex-col justify-between">
              <span className="k-koz text-koz">
                Aktif Maç &amp; Görev Kaydı
              </span>
              {ozetYukleniyor ? (
                <Iskelet className="h-10 w-28 mt-3" radius={10} />
              ) : (
                <Metrik className="text-metrik font-black text-[var(--brand-red)]">
                  {upcomingMatches.length}{" "}
                  <span className="text-base font-extrabold align-baseline text-[var(--text-secondary)]">
                    Program
                  </span>
                </Metrik>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Saha, saat ve servis bilgileri canlı güncellenir
              </p>
            </div>
          </SiraOgesi>

          <SiraOgesi>
            <div className="k-artik k-kart p-6 h-40 flex flex-col justify-between">
              <span className="k-koz text-koz">
                Son Kulüp Duyuruları
              </span>
              {ozetYukleniyor ? (
                <Iskelet className="h-10 w-28 mt-3" radius={10} />
              ) : (
                <Metrik className="text-metrik font-black text-[var(--text-primary)]">
                  {recentAnnouncements.length}{" "}
                  <span className="text-base font-extrabold align-baseline text-[var(--text-secondary)]">
                    Güncel Duyuru
                  </span>
                </Metrik>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                <Link
                  href="/bildirimler"
                  className="k-altcizgi text-[var(--brand-red)] font-extrabold"
                >
                  Tüm duyuruları gör →
                </Link>
              </p>
            </div>
          </SiraOgesi>
        </Sira>

        <Vitrin>
        <section className="k-sahne rounded-3xl text-white p-7 sm:p-10 shadow-md border border-white/15 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[11px] font-black uppercase tracking-wider">
              Mobil Uygulama &amp; PWA • Android &amp; iOS
            </span>
            <h2 className="k-posta text-2xl sm:text-[28px] text-white">
              Çorum İkbal Spor Mobil Uygulamamız Android Platformunda Yayında
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              QR antrenman yoklaması, canlı duyurular, taktik kadro paylaşımı ve
              sporcu kartı yönetimi artık cebinizde. Android APK dosyasını
              indirebilir veya iPhone/iPad cihazınızda tek dokunuşla Ana Ekrana
              ekleyebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href="https://expo.dev/artifacts/eas/nR1N-4BNki0uWG3AVxUvidX2MW7MkyN7uHCMS_yitN8.apk"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow-lg transition"
            >
              Android Uygulamayı İndir (APK) ↓
            </a>
            <button
              type="button"
              onClick={() => setShowIosGuide(true)}
              className="px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs sm:text-sm font-black shadow-lg cursor-pointer transition"
            >
              iOS (iPhone) Ana Ekrana Ekle
            </button>
          </div>
        </section>
        </Vitrin>

        <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE.veda }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowIosGuide(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-rehber-baslik"
              onClick={(e) => e.stopPropagation()}
              initial={azaltilmis ? false : { opacity: 0, y: 48, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={azaltilmis ? { duration: 0 } : SPRING.yumusak}
              className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 id="ios-rehber-baslik" className="text-base font-black">
                  iPhone / iPad — Ana Ekrana Ekleme
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIosGuide(false)}
                  className="text-xs font-extrabold text-[var(--brand-red)] cursor-pointer"
                >
                  Kapat ✕
                </button>
              </div>
              <ol className="space-y-2.5 text-xs sm:text-sm text-[var(--text-secondary)] list-decimal list-inside">
                <li>
                  Bu sayfayı iPhone/iPad cihazınızda <strong>Safari</strong> tarayıcısı ile açın.
                </li>
                <li>
                  Ekranın altındaki <strong>Paylaş (↑)</strong> simgesine dokunun.
                </li>
                <li>
                  Açılan menüden <strong>&quot;Ana Ekrana Ekle&quot;</strong> seçeneğine basın ve <strong>Ekle</strong>&apos;yi onaylayın.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-black cursor-pointer"
              >
                Anlaşıldı
              </button>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Vitrin className="lg:col-span-7">
            <section className="k-artik p-6 sm:p-7 h-full">
              <BolumBasligi
                koz="Fikstür"
                baslik={<>Yaklaşan Maçlar &amp; Program</>}
                saga={
                  <Link
                    href="/gorevler"
                    className="k-altcizgi text-xs font-extrabold text-[var(--brand-red)]"
                  >
                    Tahmin Merkezi →
                  </Link>
                }
              />

              {ozetYukleniyor ? (
                <div className="pt-4 space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <Iskelet key={n} className="h-12 w-full" radius={14} />
                  ))}
                </div>
              ) : upcomingMatches.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
                  Henüz planlanmış maç veya görev kaydı bulunmuyor.
                </div>
              ) : (
                <Sira className="pt-3 divide-y divide-[var(--border-subtle)]">
                  {upcomingMatches.map((m) => (
                    <SiraOgesi key={m.id}>
                      <div className="py-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-sm font-extrabold text-[var(--text-primary)]">
                            {m.title}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {m.age_group || "Genel"} •{" "}
                            {m.location || "Saha bilgisi yok"}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-ink)] text-xs font-extrabold tabular-nums">
                          {formatShortDateTR(m.event_date, m.match_time)}
                        </span>
                      </div>
                    </SiraOgesi>
                  ))}
                </Sira>
              )}
            </section>
          </Vitrin>

          <Vitrin className="lg:col-span-5" delay={0.08}>
            <section className="k-artik p-6 sm:p-7 h-full">
              <BolumBasligi
                koz="Kulüp Gündemi"
                baslik={<>Son Duyurular</>}
                saga={
                  <Link
                    href="/bildirimler"
                    className="k-altcizgi text-xs font-extrabold text-[var(--brand-red)]"
                  >
                    Tümü →
                  </Link>
                }
              />

              {ozetYukleniyor ? (
                <div className="pt-4 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <Iskelet key={n} className="h-16 w-full" radius={14} />
                  ))}
                </div>
              ) : recentAnnouncements.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
                  Henüz genel kulüp duyurusu paylaşılmadı.
                </div>
              ) : (
                <Sira className="pt-3 space-y-3">
                  {recentAnnouncements.map((ann) => (
                    <SiraOgesi key={ann.id}>
                      <AnnouncementCard announcement={ann} compact />
                    </SiraOgesi>
                  ))}
                </Sira>
              )}
            </section>
          </Vitrin>
        </div>

        <Sira className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              href: "/gorevler",
              koz: "Tahmin",
              renk: "var(--brand-ink)",
              baslik: "Maç Skor & Golcü Tahmini",
              metin:
                "Maç öncesi skor ve ilk golcü tahminini yap, kazandığın puanları oyuncu kartına aktar.",
            },
            {
              href: "/kadro-kur",
              koz: "Taktik",
              renk: "var(--brand-red)",
              baslik: "Taktik Tahtası & Kadro Kur",
              metin:
                "4-3-3, 4-2-3-1 veya 3-5-2 dizilişleriyle ilk 11'ini kur ve yüksek çözünürlüklü PNG olarak paylaş.",
            },
            {
              href: "/kayit",
              koz: "Aile Ol",
              renk: "#047857",
              baslik: "Altyapı & Kulüp Ön Kayıt",
              metin:
                "Doğum tarihine göre otomatik yaş kategorisi belirlenir; başvurun doğrudan yönetim paneline iletilir.",
            },
          ].map((kart) => (
            <SiraOgesi key={kart.href}>
              <motion.div whileHover={azaltilmis ? undefined : KART_HOVER} transition={SPRING.keskin} className="h-full">
                <Link
                  href={kart.href}
                  className="group k-artik k-kart block p-6 h-full space-y-2"
                >
                  <div className="k-koz text-koz">{kart.koz}</div>
                  <div
                    className="k-posta text-lg leading-snug"
                    style={{ color: kart.renk }}
                  >
                    {kart.baslik}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {kart.metin}
                  </p>
                </Link>
              </motion.div>
            </SiraOgesi>
          ))}
        </Sira>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6 px-4 text-xs text-[var(--text-secondary)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-black text-[var(--brand-ink)]">
              Çorum İkbal Spor Kulübü
            </div>
            <div className="text-[11px] mt-0.5">
              Altyapıdan A takıma disiplinli spor eğitimi ve modern kulüp
              yönetimi.
            </div>
          </div>
          <div className="flex flex-wrap gap-4 font-bold">
            <Link href="/kadro-kur" className="hover:underline">
              Kadro Kur
            </Link>
            <Link href="/gorevler" className="hover:underline">
              Maç &amp; Görevler
            </Link>
            <Link href="/bildirimler" className="hover:underline">
              Duyurular
            </Link>
            <Link href="/kayit" className="hover:underline">
              Üyelik Başvurusu
            </Link>
            <Link href="/iletisim" className="hover:underline">
              İletişim
            </Link>
            <Link href="/gizlilik-politikasi" className="hover:underline">
              Gizlilik Politikası
            </Link>
            <Link href="/hesap-silme" className="hover:underline">
              Hesap Silme
            </Link>
          </div>
          <div className="text-[11px] font-semibold">
            © 2026 Çorum İkbal Spor Kulübü
          </div>
        </div>
      </footer>
    </div>
  );
}