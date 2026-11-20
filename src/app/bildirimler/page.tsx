"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS } from "@/types/club";

const supabase = createClient();

interface ClubNotificationRow {
  id: string;
  sender_name: string | null;
  title?: string | null;
  body?: string | null;
  target_group?: string | null;
  age_group?: string | null;
  message_text?: string | null;
  created_at: string;
}

const FILTER_GROUPS = ["Tümü", ...AGE_GROUPS];

export default function BildirimlerPage() {
  const [items, setItems] = useState<ClubNotificationRow[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("club_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);

      if (!error && data) {
        const rows = data as ClubNotificationRow[];
        setItems(rows);
        if (rows.length > 0 && typeof window !== "undefined") {
          localStorage.setItem("ikbal_last_seen_notif_at", rows[0].created_at);
          window.dispatchEvent(new Event("ikbal-notifications-seen"));
        }
      }
      setLoading(false);
    })();
  }, []);

  const notifications = useMemo(() => {
    return items
      .map((m) => ({
        id: m.id,
        sender: m.sender_name || "Kulüp Yönetimi",
        title: m.title || "Kulüp Bildirimi",
        body: m.body || m.message_text || "",
        group: m.target_group || m.age_group || "Tüm Kulüp",
        createdAt: m.created_at,
      }))
      .filter((m) => m.body.trim().length > 0)
      .filter((m) => {
        if (selectedFilter === "Tümü") return true;
        return (
          m.group.includes(selectedFilter) ||
          m.group === "Tümü" ||
          m.group === "Tüm Kulüp"
        );
      });
  }, [items, selectedFilter]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <h1 className="text-3xl font-black">Bildirimler & Duyurular</h1>
          <p className="text-slate-100 text-sm sm:text-base">
            Antrenman, maç, aidat ve kulüp bilgilendirmelerini buradan takip
            edebilirsiniz.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedFilter(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                selectedFilter === g
                  ? "bg-[#02274c] text-white border-[#02274c]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Bildirimler yükleniyor...</p>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
            Bu kategori için henüz bildirim bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#a60513] text-white text-xs font-bold">
                      {n.group}
                    </span>
                    <strong className="text-sm text-[#02274c]">{n.sender}</strong>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(n.createdAt).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <h2 className="font-extrabold text-base text-slate-900">
                  {n.title}
                </h2>
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {n.body}
                </p>
                <div className="pt-1">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `[İkbalspor - ${n.group}] ${n.title}\n${n.body}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                  >
                    WhatsApp ile İlet
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}