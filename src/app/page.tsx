"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import {
  AnnouncementCard,
  AnnouncementItem,
} from "@/components/ikbal/AnnouncementCard";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";

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

  const loadHomeSummary = useCallback(async () => {
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

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-br from-[#041e3b] via-[var(--brand-navy)] to-[var(--brand-red)] text-white py-10 sm:py-12 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/12 border border-white/20 text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Çorum İkbal Spor Kulübü • 2026–2027 Sezonu
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-[1.12]">
              Altyapıdan Amatöre Tek Yürek, Tek Platform
            </h1>
            <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
              Taktik kadro kurulumu, maç günü skor ve golcü tahminleri, QR
              yoklama takibi, aidat/malzeme ekranları ve kulüp duyuruları tek
              merkezde.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/kadro-kur"
                className="px-5 py-3 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs sm:text-sm font-black shadow-md transition"
              >
                Taktik Tahtası &amp; Kadro Kur
              </Link>
              <Link
                href="/kayit"
                className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-[var(--brand-navy)] text-xs sm:text-sm font-black shadow-md transition"
              >
                Kulübe Ön Kayıt Ol
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-5 space-y-3 shadow-lg">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
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
                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <div className="text-[10px] text-slate-300 font-bold uppercase">
                    Kategoriler
                  </div>
                  <div className="font-extrabold mt-0.5">Minikler – SAL</div>
                </div>
                <div className="rounded-xl bg-black/20 px-3 py-2">
                  <div className="text-[10px] text-slate-300 font-bold uppercase">
                    Ana Tesis
                  </div>
                  <div className="font-extrabold mt-0.5">Nazmi Avluca</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8 tabular-nums">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Kayıtlı Sporcu Kadrosu
            </span>
            <div className="text-3xl font-black text-[var(--brand-navy)] dark:text-sky-300 mt-1.5">
              {playerCount} Sporcu
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Minikler, U11–U19 ve Süper Amatör yaş grupları
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Aktif Maç &amp; Görev Kaydı
            </span>
            <div className="text-3xl font-black text-[var(--brand-red)] mt-1.5">
              {upcomingMatches.length} Program
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Saha, saat ve servis bilgileri canlı güncellenir
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Son Kulüp Duyuruları
            </span>
            <div className="text-3xl font-black text-[var(--text-primary)] mt-1.5">
              {recentAnnouncements.length} Güncel Duyuru
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              <Link
                href="/bildirimler"
                className="text-[var(--brand-red)] font-extrabold hover:underline"
              >
                Tüm duyuruları gör →
              </Link>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-[var(--text-primary)]">
                Yaklaşan Maçlar &amp; Program
              </h2>
              <Link
                href="/gorevler"
                className="text-xs font-extrabold text-[var(--brand-red)] hover:underline"
              >
                Tahmin Merkezi →
              </Link>
            </div>

            {upcomingMatches.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
                Henüz planlanmış maç veya görev kaydı bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {upcomingMatches.map((m) => (
                  <div
                    key={m.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-extrabold text-[var(--text-primary)]">
                        {m.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {m.age_group || "Genel"} •{" "}
                        {m.location || "Saha bilgisi yok"}
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold tabular-nums">
                      {formatShortDateTR(m.event_date, m.match_time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-[var(--text-primary)]">
                Son Duyurular
              </h2>
              <Link
                href="/bildirimler"
                className="text-xs font-extrabold text-[var(--brand-red)] hover:underline"
              >
                Tümü →
              </Link>
            </div>

            {recentAnnouncements.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
                Henüz genel kulüp duyurusu paylaşılmadı.
              </div>
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.map((ann) => (
                  <AnnouncementCard
                    key={ann.id}
                    announcement={ann}
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl bg-gradient-to-r from-[#041e3b] via-[var(--brand-navy)] to-[#7f1d1d] text-white p-6 sm:p-8 shadow-md border border-white/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[11px] font-black uppercase tracking-wider">
              Android APK Yayında • Resmi Mobil Uygulama
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Çorum İkbal Spor Mobil Uygulamamız Android Platformunda Yayında
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              QR antrenman yoklaması, canlı duyurular, taktik kadro paylaşımı ve
              sporcu kartı yönetimi artık cebinizde. Resmi APK dosyasını
              doğrudan telefonunuza indirebilirsiniz.
            </p>
          </div>
          <a
            href="https://expo.dev/artifacts/eas/nR1N-4BNki0uWG3AVxUvidX2MW7MkyN7uHCMS_yitN8.apk"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow-lg transition"
          >
            Android Uygulamayı İndir (APK) ↓
          </a>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/gorevler"
            className="group bg-[var(--bg-surface)] hover:border-[var(--brand-navy)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs transition space-y-1.5"
          >
            <div className="text-sm font-black text-[var(--brand-navy)] dark:text-sky-300 group-hover:underline">
              Maç Skor &amp; Golcü Tahmini
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Maç öncesi skor ve ilk golcü tahminini yap, kazandığın puanları
              oyuncu kartına aktar.
            </p>
          </Link>

          <Link
            href="/kadro-kur"
            className="group bg-[var(--bg-surface)] hover:border-[var(--brand-red)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs transition space-y-1.5"
          >
            <div className="text-sm font-black text-[var(--brand-red)] group-hover:underline">
              Taktik Tahtası &amp; Kadro Kur
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              4-3-3, 4-2-3-1 veya 3-5-2 dizilişleriyle ilk 11&apos;ini kur ve
              yüksek çözünürlüklü PNG olarak paylaş.
            </p>
          </Link>

          <Link
            href="/kayit"
            className="group bg-[var(--bg-surface)] hover:border-emerald-600 rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs transition space-y-1.5"
          >
            <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 group-hover:underline">
              Altyapı &amp; Kulüp Ön Kayıt
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Doğum tarihine göre otomatik yaş kategorisi belirlenir; başvurun
              doğrudan yönetim paneline iletilir.
            </p>
          </Link>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6 px-4 text-xs text-[var(--text-secondary)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-black text-[var(--brand-navy)] dark:text-sky-300">
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
          </div>
          <div className="text-[11px] font-semibold">
            © 2026 Çorum İkbal Spor Kulübü
          </div>
        </div>
      </footer>
    </div>
  );
}