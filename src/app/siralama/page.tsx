"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import {
  buildOverallLeaderboard,
  PlayerGoalStats,
} from "@/lib/goal-scoring";
import { LeaderboardPodium } from "@/components/kadro/LeaderboardPodium";

const supabase = createClient();

interface PlayerRow {
  id: string;
  full_name: string;
  age_group: string;
  photo_url?: string | null;
  skill_points?: number | null;
}

export default function OverallLeaderboardPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedPlayer = localStorage.getItem("ikbal_player");
        if (savedPlayer) {
          const parsed = JSON.parse(savedPlayer);
          if (parsed?.id) setCurrentPlayerId(parsed.id);
        }
      } catch {
        // yoksay
      }
    }

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("players")
        .select("id, full_name, age_group, photo_url, skill_points");
      if (data) setPlayers(data as PlayerRow[]);
      setLoading(false);
    })();
  }, []);

  const rankings = useMemo(() => {
    const stats: PlayerGoalStats[] = players.map((p) => ({
      player_id: p.id,
      full_name: p.full_name,
      age_group: p.age_group,
      photo_url: p.photo_url,
      total_goals: 0,
      matches_played_or_scored: 0,
      base_points: Number(p.skill_points ?? 20),
    }));
    return buildOverallLeaderboard(stats);
  }, [players]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] via-[#04376b] to-[#a60513] text-white py-6 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Genel (Overall) Puan Sıralaması
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              Tüm yaş kategorileri tek ortak sıralamada: İlk 3 podyum kartı ve ilk 10 liste.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl border border-white/20">
            <img
              src="/logo.png"
              alt="Çorum İkbalspor"
              className="w-8 h-8 rounded-lg bg-white p-0.5 object-contain"
            />
            <span className="text-xs font-extrabold">Çorum İkbalspor</span>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
            Genel sıralama yükleniyor...
          </div>
        ) : (
          <LeaderboardPodium
            rankings={rankings}
            currentPlayerId={currentPlayerId}
          />
        )}
      </main>
    </div>
  );
}