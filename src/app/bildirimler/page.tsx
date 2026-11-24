"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import {
  AnnouncementCard,
  AnnouncementItem,
  extractAnnouncementMediaAndCleanText,
} from "@/components/ikbal/AnnouncementCard";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";

const supabase = createClient();

const GROUP_FILTERS = [
  "Tümü",
  "Minikler",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U19",
  "SAL",
] as const;

function formatAnnouncementDateTR(raw?: string | null): string {
  if (!raw) return "Tarih belirtilmedi";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(parsed);
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("Tümü");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from("club_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    setAnnouncements((data as AnnouncementItem[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("club_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      setAnnouncements((data as AnnouncementItem[] | null) || []);
      setLoading(false);
    })();

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        if (active) {
          void fetchAnnouncements();
        }
      },
      "web-announcements-live"
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements.filter((item) => {
      const rawGroup = (
        item.age_group ||
        item.target_group ||
        "Tümü"
      ).trim();

      if (selectedGroup !== "Tümü") {
        const normalizedGroup =
          selectedGroup === "SAL" ? "Çorum Süper Amatör Ligi" : selectedGroup;
        const matchesGroup =
          rawGroup === "Tümü" ||
          rawGroup === "Tüm Kulüp" ||
          rawGroup.includes(selectedGroup) ||
          rawGroup.includes(normalizedGroup);
        if (!matchesGroup) return false;
      }

      if (!q) return true;
      const { cleanedTitle, cleanedBody } =
        extractAnnouncementMediaAndCleanText(item);
      const senderText = (item.sender_name || "").toLowerCase();
      return (
        cleanedTitle.toLowerCase().includes(q) ||
        cleanedBody.toLowerCase().includes(q) ||
        senderText.includes(q) ||
        rawGroup.toLowerCase().includes(q)
      );
    });
  }, [announcements, selectedGroup, searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[var(--brand-navy-hover)] to-[var(--brand-red)] text-white py-6 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
              Canlı Kulüp Akışı
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              Duyurular &amp; Bilgilendirmeler
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              İdman, maç, aidat ve kulüp duyuruları anlık olarak burada yayınlanır.
            </p>
          </div>
          <span className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/20 text-xs font-extrabold tabular-nums">
            Toplam: {filteredAnnouncements.length} Duyuru
          </span>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-5">
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 shadow-xs space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Duyuru içeriği veya gönderen ara..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
          />

          <div className="flex flex-wrap gap-1.5">
            {GROUP_FILTERS.map((grp) => {
              const active = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    active
                      ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {grp}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              />
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              Seçilen filtreye uygun duyuru bulunamadı.
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Yeni duyuru paylaşıldığında ekran otomatik olarak güncellenecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnnouncements.map((ann) => (
              <AnnouncementCard
                key={ann.id}
                announcement={ann}
                dateLabel={formatAnnouncementDateTR(ann.created_at)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}