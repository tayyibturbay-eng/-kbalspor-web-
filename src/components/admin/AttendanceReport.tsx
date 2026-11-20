"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Player = {
  id: string;
  full_name: string;
  age_group: string;
};

type PrayerSession = {
  id: string;
  title: string;
  session_date: string;
  is_active: boolean;
};

type PrayerAttendance = {
  id: string;
  session_id: string;
  player_id: string;
  checked_in_at: string;
};

const AGE_GROUPS = ["Tümü", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U19", "PGL Kadro"];

export function AttendanceReport() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendances, setAttendances] = useState<PrayerAttendance[]>([]);
  const [ageFilter, setAgeFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [pRes, sRes, aRes] = await Promise.all([
      supabase.from("players").select("id, full_name, age_group").order("full_name"),
      supabase
        .from("prayer_sessions")
        .select("id, title, session_date, is_active")
        .order("session_date", { ascending: false }),
      supabase.from("prayer_attendance").select("id, session_id, player_id, checked_in_at"),
    ]);

    if (pRes.data) setPlayers(pRes.data as Player[]);
    if (sRes.data) setSessions(sRes.data as PrayerSession[]);
    if (aRes.data) setAttendances(aRes.data as PrayerAttendance[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalSessions = sessions.length;

  // Düzenli Katılım Sıralaması (Ödül için)
  const leaderboard = useMemo(() => {
    const filtered =
      ageFilter === "Tümü" ? players : players.filter((p) => p.age_group === ageFilter);

    return filtered
      .map((p) => {
        const count = attendances.filter((a) => a.player_id === p.id).length;
        const rate = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0;
        return { ...p, count, rate };
      })
      .sort((a, b) => b.count - a.count || a.full_name.localeCompare(b.full_name, "tr"));
  }, [players, attendances, ageFilter, totalSessions]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
        Katılım çizelgesi yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* 1. Ödül & Düzenli Katılım Sıralaması */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#02274c]">
              Düzenli Katılım Sıralaması (Ödül Listesi)
            </h3>
            <p className="text-xs text-slate-500">
              Toplam {totalSessions} etkinlik üzerinden en çok katılım sağlayan sporcular
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadData}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Yenile
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Sporcu</th>
                <th className="py-2.5 px-3">Grup</th>
                <th className="py-2.5 px-3">Katılım</th>
                <th className="py-2.5 px-3">Oran</th>
                <th className="py-2.5 px-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-extrabold text-slate-900">{row.full_name}</td>
                  <td className="py-2.5 px-3 text-xs font-bold text-slate-600">{row.age_group}</td>
                  <td className="py-2.5 px-3 font-bold text-[#02274c]">
                    {row.count} / {totalSessions}
                  </td>
                  <td className="py-2.5 px-3 font-bold">%{row.rate}</td>
                  <td className="py-2.5 px-3">
                    {row.rate >= 80 && totalSessions > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
                        Ödül Adayı
                      </span>
                    ) : row.count > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                        Düzenli
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Katılım yok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Geçmiş Etkinlikler Katılım Çizelgesi */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-lg font-black text-[#a60513]">Geçmiş Etkinlikler ve Katılanlar</h3>

        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz oluşturulmuş etkinlik yok.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => {
              const sessAtt = attendances.filter((a) => a.session_id === sess.id);
              const joinedNames = sessAtt
                .map((a) => players.find((p) => p.id === a.player_id)?.full_name)
                .filter(Boolean) as string[];

              return (
                <div
                  key={sess.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-extrabold text-[#02274c]">{sess.title}</span>
                      <span className="ml-2 text-xs text-slate-500">({sess.session_date})</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#02274c] text-white text-xs font-bold">
                      {joinedNames.length} Katılımcı
                    </span>
                  </div>

                  {joinedNames.length === 0 ? (
                    <p className="text-xs text-slate-400">Bu etkinlikte henüz katılım kaydı yok.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {joinedNames.map((name, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                        >
                          ✓ {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}