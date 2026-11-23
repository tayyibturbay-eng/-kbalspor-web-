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
        .limit(4),
      supabase.from("players").select("id", { count: "exact", head: true }),
    ]);

    if (tasksRes.data) setUpcomingMatches(tasksRes.data as HomeTaskRow[]);
    if (msgsRes.data)
      setRecentAnnouncements(msgsRes.data as AnnouncementItem[]);
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

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white py-10 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
              Çorum İkbalspor • 2026–2027 Sezonu
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Altyapıdan Amatöre Tek Yürek, Tek Platform
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Taktik kadro kurulumu, maç günü skor ve golcü tahminleri, QR
              yoklama takibi, aidat/malzeme ekranları ve kulüp duyuruları tek
              yerde.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/kadro-kur"
              className="px-5 py-3 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs sm:text-sm font-black shadow-sm transition"
            >
              Taktik Tahtası &amp; Kadro Kur
            </Link>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8 tabular-nums">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs">
            <span className="text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
              Kayıtlı Sporcu Kadrosu
            </span>
            <div className="text-2xl font-black text-[var(--brand-navy)] dark:text-sky-300 mt-1">
              {playerCount} Sporcu
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Minikler, U11–U19 ve Süper Amatör yaş grupları
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs">
            <span className="text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
              Aktif Maç &amp; Görev Kaydı
            </span>
            <div className="text-2xl font-black text-[var(--brand-red)] mt-1">
              {upcomingMatches.length} Program
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Saha, saat ve servis bilgileri canlı güncellenir
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs">
            <span className="text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
              Son Kulüp Duyuruları
            </span>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
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
                href="/kadro-kur"
                className="text-xs font-extrabold text-[var(--brand-red)] hover:underline"
              >
                Kadro Hazırla →
              </Link>
            </div>

            {upcomingMatches.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                Henüz planlanmış maç veya görev kaydı bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {upcomingMatches.map((m) => (
                  <div
                    key={m.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-[var(--text-primary)]">
                        {m.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {m.age_group || "Genel"} •{" "}
                        {m.location || "Saha bilgisi yok"}
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold tabular-nums">
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
              <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
                Henüz duyuru paylaşılmadı.
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
      </main>
    </div>
  );
}