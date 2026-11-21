"use client";

import React from "react";
import { RankedPlayer } from "@/lib/goal-scoring";

interface LeaderboardPodiumProps {
  rankings: RankedPlayer[];
  currentPlayerId?: string | null;
}

export function LeaderboardPodium({
  rankings,
  currentPlayerId,
}: LeaderboardPodiumProps) {
  const first = rankings[0] || null;
  const second = rankings[1] || null;
  const third = rankings[2] || null;
  const topTen = rankings.slice(0, 10);

  const currentUserRank = currentPlayerId
    ? rankings.find((r) => r.player_id === currentPlayerId) || null
    : null;

  return (
    <div className="space-y-6 text-slate-900">
      {currentUserRank && (
        <div className="bg-[#02274c] text-white rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-amber-200 font-extrabold">
              Genel Sıralamadaki Yeriniz (Tüm Kategoriler)
            </span>
            <div className="text-lg font-black">
              #{currentUserRank.rank} Sıradasınız •{" "}
              {currentUserRank.overall_points} Puan
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#a60513] text-xs font-extrabold">
            {currentUserRank.age_group}
          </span>
        </div>
      )}

      {/* İlk 3 Kişi: 1. Büyük, 2. Orta, 3. Küçük Orantılı Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* 2. Sıra - Orta Boy Kart */}
        <div className="order-2 md:order-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm min-h-[170px] flex flex-col justify-between">
          {second ? (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-900 text-xs font-black">
                  🥈 2. Sıra
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {second.age_group}
                </span>
              </div>
              <div className="my-2">
                <div className="font-extrabold text-base text-[#02274c]">
                  {second.full_name}
                </div>
                <div className="text-sm font-black text-[#a60513]">
                  {second.overall_points} Puan
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400">2. sırada oyuncu yok</div>
          )}
        </div>

        {/* 1. Sıra - En Büyük Kart */}
        <div className="order-1 md:order-2 bg-gradient-to-b from-[#02274c] to-[#053b6e] text-white rounded-3xl border-2 border-amber-400 p-6 shadow-lg min-h-[220px] flex flex-col justify-between">
          {first ? (
            <>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                  🥇 1. Sıra • Lider
                </span>
                <span className="text-xs font-bold text-amber-200">
                  {first.age_group}
                </span>
              </div>
              <div className="my-3">
                <div className="font-black text-xl sm:text-2xl">
                  {first.full_name}
                </div>
                <div className="text-lg font-black text-amber-300 mt-1">
                  {first.overall_points} Puan
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-300">Henüz puan kaydı yok</div>
          )}
        </div>

        {/* 3. Sıra - Küçük Kart */}
        <div className="order-3 bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm min-h-[145px] flex flex-col justify-between">
          {third ? (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black">
                  🥉 3. Sıra
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {third.age_group}
                </span>
              </div>
              <div className="my-1.5">
                <div className="font-bold text-sm text-[#02274c]">
                  {third.full_name}
                </div>
                <div className="text-xs font-black text-[#a60513]">
                  {third.overall_points} Puan
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400">3. sırada oyuncu yok</div>
          )}
        </div>
      </div>

      {/* İlk 10 Kişi Genel Listesi */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 shadow-xs">
        <h3 className="text-sm font-black text-[#02274c]">
          Genel (Overall) İlk 10 Sıralaması
        </h3>
        <div className="divide-y divide-slate-100">
          {topTen.map((item) => {
            const isMe = currentPlayerId && item.player_id === currentPlayerId;
            return (
              <div
                key={item.player_id}
                className={`py-2 px-3 rounded-lg flex items-center justify-between text-xs sm:text-sm ${
                  isMe ? "bg-amber-50 font-extrabold" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 font-black text-[#02274c]">
                    #{item.rank}
                  </span>
                  <span className="font-bold text-slate-900">
                    {item.full_name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">
                    {item.age_group}
                  </span>
                </div>
                <span className="font-black text-[#a60513]">
                  {item.overall_points} Puan
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}