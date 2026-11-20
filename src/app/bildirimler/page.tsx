"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

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

export default function BildirimlerPage() {
  const [items, setItems] = useState<ClubNotificationRow[]>([]);
  const [playerAgeGroup, setPlayerAgeGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      let currentGroup: string | null = null;
      if (typeof window !== "undefined") {
        const playerId = localStorage.getItem("ikbal_logged_player_id");
        if (playerId) {
          const { data: player } = await supabase
            .from("players")
            .select("age_group")
            .eq("id", playerId)
            .maybeSingle();
          currentGroup = player?.age_group || null;
          setPlayerAgeGroup(currentGroup);
        }
      }

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

  const individualNotifications = useMemo(() => {
    return items
      .map((m) => ({
        id: m.id,
        sender: m.sender_name || "Kulüp Yönetimi",
        title: m.title || "Kulüp Bildirimi",
        body: m.body || m.message_text || "",
        group: (m.target_group || m.age_group || "Tümü").trim(),
        createdAt: m.created_at,
      }))
      .filter((m) => m.body.trim().length > 0)
      .filter((m) => {
        if (!playerAgeGroup) return true;
        if (m.group === "Tümü" || m.group === "Tüm Kulüp") return true;
        return m.group === playerAgeGroup.trim();
      });
  }, [items, playerAgeGroup]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <h1 className="text-3xl font-black">Bildirimler</h1>
          <p className="text-slate-100 text-sm sm:text-base">
            {playerAgeGroup
              ? `${playerAgeGroup} grubunuza ve tüm kulübe gönderilen bireysel bildirimler.`
              : "Size gönderilen bireysel bildirimler ve duyurular."}
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Bildirimler yükleniyor...</p>
        ) : individualNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
            Henüz yeni bildirim bulunmuyor.
          </div>
        ) : (
          individualNotifications.map((n) => (
            <article
              key={n.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#a60513] text-white text-xs font-black flex items-center justify-center">
                    !
                  </span>
                  <strong className="text-sm text-[#02274c]">{n.sender}</strong>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                    {n.group}
                  </span>
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
            </article>
          ))
        )}
      </main>
    </div>
  );
}