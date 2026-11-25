"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import {
  AnnouncementCard,
  AnnouncementItem,
  extractAnnouncementMediaAndCleanText,
} from "@/components/ikbal/AnnouncementCard";
import { Iskelet, Sira, SiraOgesi, Vitrin } from "@/components/ikbal/Motion";
import { SPRING } from "@/lib/motion";
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
  const azaltilmis = useReducedMotion();

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

      <section className="k-sahne text-white py-8 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Canlı Kulüp Akışı
            </span>
            <h1 className="k-posta k-posta--wonk text-2xl sm:text-4xl text-white">
              Duyurular &amp; Bilgilendirmeler
            </h1>
            <p className="text-xs sm:text-sm text-slate-200">
              İdman, maç, aidat ve kulüp duyuruları anlık olarak burada yayınlanır.
            </p>
          </div>
          <span className="px-4 py-2 rounded-2xl k-cam--marka text-xs font-extrabold tabular-nums">
            Toplam: {filteredAnnouncements.length} Duyuru
          </span>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-7 space-y-6">
        <Vitrin>
          <div className="k-artik p-4 sm:p-5 space-y-3.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Duyuru içeriği veya gönderen ara..."
              className="k-alan"
            />

            <div className="flex flex-wrap gap-1.5">
              {GROUP_FILTERS.map((grp) => {
                const active = selectedGroup === grp;
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSelectedGroup(grp)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                      active
                        ? "text-white"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {active && !azaltilmis && (
                      <motion.span
                        layoutId="duyuru-grup-pil"
                        transition={SPRING.yumusak}
                        className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]"
                      />
                    )}
                    {active && azaltilmis && (
                      <span className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]" />
                    )}
                    <span className="relative z-10">{grp}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Vitrin>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Iskelet key={n} className="h-28 w-full" radius={20} />
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="k-artik border-dashed p-10 text-center">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              Seçilen filtreye uygun duyuru bulunamadı.
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Yeni duyuru paylaşıldığında ekran otomatik olarak güncellenecektir.
            </p>
          </div>
        ) : (
          <Sira className="space-y-3">
            {filteredAnnouncements.map((ann) => (
              <SiraOgesi key={ann.id}>
                <AnnouncementCard
                  announcement={ann}
                  dateLabel={formatAnnouncementDateTR(ann.created_at)}
                />
              </SiraOgesi>
            ))}
          </Sira>
        )}
      </main>
    </div>
  );
}