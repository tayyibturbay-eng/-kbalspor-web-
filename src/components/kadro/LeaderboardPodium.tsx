"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RankedPlayer } from "@/lib/goal-scoring";
import { Metrik, Sira, SiraOgesi } from "@/components/ikbal/Motion";
import { KART_HOVER, SPRING } from "@/lib/motion";

interface LeaderboardPodiumProps {
  rankings: RankedPlayer[];
  currentPlayerId?: string | null;
}

type RankedWithUnspent = RankedPlayer & {
  unspent_points?: number | null;
  skill_points?: number | null;
};

function getEarnedTotal(item: RankedWithUnspent): number {
  return Number(item.total_earned_points ?? item.overall_points ?? 0);
}

function getUnspentPoints(item: RankedWithUnspent): number {
  return Math.max(0, Number(item.unspent_points ?? item.skill_points ?? 0));
}

export function LeaderboardPodium({
  rankings,
  currentPlayerId,
}: LeaderboardPodiumProps) {
  const azaltilmis = useReducedMotion();

  const sortedRankings = useMemo(() => {
    const copy = [...(rankings as RankedWithUnspent[])].sort(
      (a, b) => getEarnedTotal(b) - getEarnedTotal(a)
    );
    return copy.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [rankings]);

  const first = sortedRankings[0] || null;
  const second = sortedRankings[1] || null;
  const third = sortedRankings[2] || null;
  const topTen = sortedRankings.slice(0, 10);

  const currentUserRank = currentPlayerId
    ? sortedRankings.find((r) => r.player_id === currentPlayerId) || null
    : null;

  return (
    <div className="space-y-5 sm:space-y-6 text-[var(--text-primary)] tabular-nums min-w-0">
      {currentUserRank && (
        <div className="k-sahne text-white rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-md min-w-0">
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-200 font-black block">
              Kulüp Ortak Sıralamasındaki Yerin (Toplam Puan)
            </span>
            <div className="k-posta text-lg sm:text-2xl text-white break-words">
              #{currentUserRank.rank}{" "}
              <span className="text-xs font-sans font-semibold text-slate-200">
                / {sortedRankings.length} sporcu
              </span>{" "}
              • {getEarnedTotal(currentUserRank)}p{" "}
              <span className="text-xs sm:text-sm font-sans text-amber-300">
                ({getUnspentPoints(currentUserRank)}p)
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full k-cam--marka text-xs font-extrabold shrink-0">
            {currentUserRank.age_group}
          </span>
        </div>
      )}

      {/* Ortak İlk 3 Podyumu (Mobilde 1 -> 2 -> 3, Masaüstünde 2 - 1 - 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 md:items-end min-w-0">
        {/* 1. Sıra - Kulüp Lideri */}
        <motion.div
          whileHover={azaltilmis ? undefined : KART_HOVER}
          transition={SPRING.keskin}
          className="order-1 md:order-2 k-sahne text-white rounded-3xl border-2 border-amber-400 p-5 sm:p-6 shadow-xl min-h-[180px] sm:min-h-[215px] flex flex-col justify-between min-w-0"
        >
          {first ? (
            <>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-2xs shrink-0">
                  🏆 #1 Lider
                </span>
                <span className="text-xs font-bold text-amber-200 truncate">
                  {first.age_group}
                </span>
              </div>
              <div className="my-3 min-w-0">
                <div className="k-posta k-posta--wonk text-xl sm:text-3xl text-white truncate">
                  {first.full_name}
                </div>
                <Metrik className="text-base sm:text-lg font-black text-amber-300 mt-1">
                  {getEarnedTotal(first)}p{" "}
                  <span className="text-xs sm:text-sm text-amber-100">
                    ({getUnspentPoints(first)}p)
                  </span>
                </Metrik>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-300">
              Henüz puan kaydı yok
            </div>
          )}
        </motion.div>

        {/* 2. Sıra */}
        <motion.div
          whileHover={azaltilmis ? undefined : KART_HOVER}
          transition={SPRING.keskin}
          className="order-2 md:order-1 k-artik k-kart p-4 sm:p-5 min-h-[145px] sm:min-h-[168px] flex flex-col justify-between min-w-0"
        >
          {second ? (
            <>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="k-etiket k-etiket--lacivert shrink-0">
                  🥈 #2 Sıra
                </span>
                <span className="text-[11px] font-bold text-[var(--text-muted)] truncate">
                  {second.age_group}
                </span>
              </div>
              <div className="my-2 min-w-0">
                <div className="k-posta text-base sm:text-lg text-[var(--text-primary)] truncate">
                  {second.full_name}
                </div>
                <Metrik className="text-sm font-black text-[var(--brand-red)] mt-0.5">
                  {getEarnedTotal(second)}p{" "}
                  <span className="text-xs text-[var(--text-secondary)]">
                    ({getUnspentPoints(second)}p)
                  </span>
                </Metrik>
              </div>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">
              2. sırada sporcu yok
            </div>
          )}
        </motion.div>

        {/* 3. Sıra */}
        <motion.div
          whileHover={azaltilmis ? undefined : KART_HOVER}
          transition={SPRING.keskin}
          className="order-3 k-artik k-kart border-amber-400/40 p-4 sm:p-5 min-h-[135px] sm:min-h-[150px] flex flex-col justify-between min-w-0"
        >
          {third ? (
            <>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="k-etiket k-etiket--uyari shrink-0">
                  🥉 #3 Sıra
                </span>
                <span className="text-[11px] font-bold text-[var(--text-muted)] truncate">
                  {third.age_group}
                </span>
              </div>
              <div className="my-1.5 min-w-0">
                <div className="k-posta text-base text-[var(--text-primary)] truncate">
                  {third.full_name}
                </div>
                <Metrik className="text-xs sm:text-sm font-black text-[var(--brand-red)] mt-0.5">
                  {getEarnedTotal(third)}p{" "}
                  <span className="text-xs text-[var(--text-secondary)]">
                    ({getUnspentPoints(third)}p)
                  </span>
                </Metrik>
              </div>
            </>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">
              3. sırada sporcu yok
            </div>
          )}
        </motion.div>
      </div>

      {/* Bütün Takım Ortak İlk 10 Listesi */}
      <div className="k-artik p-4 sm:p-6 space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="k-koz text-[10px] block">
              TOPLAM PUAN SIRALAMASI
            </span>
            <h3 className="k-posta text-base sm:text-lg text-[var(--text-primary)]">
              Kulüp Ortak Liderlik Tablosu (İlk 10)
            </h3>
          </div>
          <span className="k-etiket k-etiket--lacivert shrink-0">
            Toplam {sortedRankings.length} Sporcu
          </span>
        </div>

        <Sira className="divide-y divide-[var(--border-subtle)]">
          {topTen.map((item) => {
            const isMe = Boolean(
              currentPlayerId && item.player_id === currentPlayerId
            );
            return (
              <SiraOgesi key={item.player_id}>
                <div
                  className={`py-2.5 px-2.5 sm:px-3.5 rounded-xl flex items-center justify-between gap-2 text-xs sm:text-sm transition-colors min-w-0 ${
                    isMe
                      ? "bg-[var(--brand-navy-soft)] border border-[var(--brand-navy)]/25 font-extrabold"
                      : "hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-7 sm:w-8 font-black text-[var(--brand-ink)] shrink-0">
                      #{item.rank}
                    </span>
                    <span className="font-bold text-[var(--text-primary)] truncate">
                      {item.full_name} {isMe ? "(Sen)" : ""}
                    </span>
                    <span className="hidden sm:inline-flex k-etiket k-etiket--lacivert shrink-0">
                      {item.age_group}
                    </span>
                  </div>
                  <span className="font-black text-[var(--brand-red)] shrink-0 text-right">
                    {getEarnedTotal(item)}p{" "}
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      ({getUnspentPoints(item)}p)
                    </span>
                  </span>
                </div>
              </SiraOgesi>
            );
          })}
        </Sira>
      </div>
    </div>
  );
}