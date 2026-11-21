"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildOverallLeaderboard,
  PlayerGoalStats,
} from "@/lib/goal-scoring";
import { LeaderboardPodium } from "./LeaderboardPodium";

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
  showFullLeaderboard?: boolean;
}

export function PlayerRankingBadge({
  playerId,
  showFullLeaderboard = true,
}: PlayerRankingBadgeProps) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  useEffect(() => {
    if (!playerId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("id, full_name, age_group, photo_url, skill_points");
      if (active && data) setPlayers(data as PlayerRow[]);
    })();
    return () => {
      active = false;
    };
  }, [playerId]);

  const ranked = useMemo(() => {
    if (players.length === 0) return [];
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

  const myRankInfo = useMemo(() => {
    if (!playerId || ranked.length === 0) return null;
    const found = ranked.find((r) => r.player_id === playerId) || null;
    return found ? { ...found, totalPlayers: ranked.length } : null;
  }, [ranked, playerId]);

  if (!playerId || !myRankInfo) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-[#02274c] to-[#a60513] text-white p-4 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-200 font-extrabold">
            Üyelere Özel Genel Sıralama
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

      {showFullLeaderboard && (
        <LeaderboardPodium rankings={ranked} currentPlayerId={playerId} />
      )}
    </div>
  );
}