"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionRow = {
  id: string;
  title: string;
  session_date: string;
  is_active: boolean;
};

type AttendanceRow = {
  id: string;
  session_id: string;
  player_id: string;
};

type PlayerRow = {
  id: string;
  full_name: string;
  age_group: string;
};

export function AttendanceReport({
  isAdmin = false,
  onSessionDeleted,
}: {
  isAdmin?: boolean;
  onSessionDeleted?: () => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [groupFilter, setGroupFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    const supabase = createClient();
    const [sRes, aRes, pRes] = await Promise.all([
      supabase.from("prayer_sessions").select("*").order("session_date", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("players").select("id, full_name, age_group").order("full_name"),
    ]);
    if (sRes.data) setSessions(sRes.data as SessionRow[]);
    if (aRes.data) setAttendance(aRes.data as AttendanceRow[]);
    if (pRes.data) setPlayers(pRes.data as PlayerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, []);

  async function handleDeleteSession(sess: SessionRow) {
    if (!isAdmin) return;
    const confirmed = confirm(
      `"${sess.title}" (${sess.session_date}) etkinliğini ve bu etkinliğe ait tüm yoklama kayıtlarını kalıcı olarak silmek istediğinize emin misiniz?`
    );
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.from("prayer_attendance").delete().eq("session_id", sess.id);
    const { error } = await supabase.from("prayer_sessions").delete().eq("id", sess.id);

    if (error) {
      alert("Etkinlik silinemedi: " + error.message);
      return;
    }

    await loadReport();
    onSessionDeleted?.();
  }

  const leaderboard = useMemo(() => {
    const totalSessions = sessions.length;
    if (totalSessions === 0) return [];
    return players
      .filter((p) => groupFilter === "Tümü" || p.age_group === groupFilter)
      .map((p) => {
        const count = attendance.filter((a) => a.player_id === p.id).length;
        const pct = Math.round((count / totalSessions) * 100);
        return { player: p, count, totalSessions, pct };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [sessions, attendance, players, groupFilter]);

  const ageGroups = useMemo(() => {
    const set = new Set(players.map((p) => p.age_group));
    return ["Tümü", ...Array.from(set)];
  }, [players]);

  if (loading) {
    return <div className="bg-white p-5 rounded-2xl border text-sm text-slate-500">Katılım çizelgesi yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Düzenli Katılım & Ödül Sıralaması */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#02274c]">🏆 Düzenli Katılım Sıralaması (Ödül Listesi)</h3>
            <p className="text-xs text-slate-500">
              Toplam {sessions.length} etkinlik üzerinden %80 ve üzeri katılım sağlayanlar Ödül Adayı olarak işaretlenir.
            </p>
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            {ageGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-xs text-slate-500">Henüz katılım kaydı bulunmuyor.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {leaderboard.map((item, idx) => (
              <div
                key={item.player.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  item.pct >= 80 ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div>
                  <span className="font-black text-[#02274c] mr-1.5">#{idx + 1}</span>
                  <strong className="text-slate-900">{item.player.full_name}</strong>
                  <span className="text-slate-500 ml-1">({item.player.age_group})</span>
                  {item.pct >= 80 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-extrabold text-[10px]">
                      Ödül Adayı
                    </span>
                  )}
                </div>
                <div className="font-extrabold text-[#a60513]">
                  {item.count}/{item.totalSessions} (%{item.pct})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geçmiş Etkinlikler ve Silme (Sadece Admin) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
        <h3 className="text-lg font-extrabold text-[#02274c]">📅 Geçmiş Etkinlikler ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500">Kayıtlı etkinlik yok.</p>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => {
              const sessAtt = attendance.filter((a) => a.session_id === s.id);
              const names = sessAtt
                .map((a) => players.find((p) => p.id === a.player_id)?.full_name)
                .filter(Boolean);
              return (
                <div key={s.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm">
                      <strong className="text-[#02274c]">{s.title}</strong>{" "}
                      <span className="text-xs text-slate-500">({s.session_date})</span>
                      {s.is_active && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#02274c]">{sessAtt.length} Katılımcı</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s)}
                          className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-extrabold cursor-pointer"
                        >
                          🗑️ Sil
                        </button>
                      )}
                    </div>
                  </div>
                  {names.length > 0 && (
                    <p className="text-xs text-slate-600">{names.join(", ")}</p>
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