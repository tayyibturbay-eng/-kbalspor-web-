"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildOverallLeaderboard,
  PlayerGoalStats,
} from "@/lib/goal-scoring";

const supabase = createClient();

interface PlayerRow {
  id: string;
  full_name: string;
  age_group: string;
  photo_url?: string | null;
  skill_points?: number | null;
}

interface PlayerRankingBadgeProps {
  playerId: string;
}

export function PlayerRankingBadge({ playerId }: PlayerRankingBadgeProps) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  useEffect(() => {
    if (!playerId) return;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("id, full_name, age_group, photo_url, skill_points");
      if (data) setPlayers(data as PlayerRow[]);
    })();
  }, [playerId]);

  const myRankInfo = useMemo(() => {
    if (players.length === 0) return null;
    const stats: PlayerGoalStats[] = players.map((p) => ({
      player_id: p.id,
      full_name: p.full_name,
      age_group: p.age_group,
      photo_url: p.photo_url,
      total_goals: 0,
      matches_played_or_scored: 0,
      base_points: Number(p.skill_points ?? 20),
    }));
    const ranked = buildOverallLeaderboard(stats);
    const found = ranked.find((r) => r.player_id === playerId) || null;
    return found ? { ...found, totalPlayers: ranked.length } : null;
  }, [players, playerId]);

  if (!myRankInfo) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#02274c] to-[#a60513] text-white p-4 flex items-center justify-between gap-4 shadow-sm">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-amber-200 font-extrabold">
          Genel (Overall) Sıralama
        </div>
        <div className="text-xl font-black mt-0.5">
          #{myRankInfo.rank}{" "}
          <span className="text-xs font-semibold text-slate-200">
            / {myRankInfo.totalPlayers} sporcu (Tüm Kategoriler)
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-black text-amber-300">
          {myRankInfo.overall_points} Puan
        </div>
        <div className="text-[11px] font-bold text-slate-200">
          {myRankInfo.age_group}
        </div>
      </div>
    </div>
  );
}