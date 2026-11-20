"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  player_code: string;
  full_name: string;
  age_group: string;
  is_representative: boolean;
}

interface PrayerSession {
  id: string;
  session_date: string;
  qr_token: string;
  mosque_name: string;
}

export default function RepresentativePage() {
  const [repCode, setRepCode] = useState("");
  const [repPlayer, setRepPlayer] = useState<Player | null>(null);
  const [err, setErr] = useState("");
  const [session, setSession] = useState<PrayerSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

  const loadAttendance = async () => {
    const supabase = createClient();
    const [sRes, pRes] = await Promise.all([
      supabase.from("prayer_sessions").select("*").order("session_date", { ascending: false }).limit(1),
      supabase.from("players").select("id, player_code, full_name, age_group, is_representative").order("age_group", { ascending: true }),
    ]);

    const latest = sRes.data?.[0] as PrayerSession | undefined;
    setSession(latest || null);
    setPlayers((pRes.data as Player[]) || []);

    if (latest) {
      const { data: aData } = await supabase
        .from("prayer_attendance")
        .select("player_id")
        .eq("session_id", latest.id);
      setAttendedIds(new Set((aData || []).map((x: { player_id: string }) => x.player_id)));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const supabase = createClient();
    const { data } = await supabase
      .from("players")
      .select("id, player_code, full_name, age_group, is_representative")
      .eq("player_code", repCode.trim().toUpperCase())
      .maybeSingle();

    if (!data) {
      setErr("Bu ID'ye ait oyuncu bulunamadı.");
      return;
    }
    if (!data.is_representative) {
      setErr("Bu panel sadece yönetici tarafından seçilen Temsilci oyunculara açıktır.");
      return;
    }
    setRepPlayer(data as Player);
    loadAttendance();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-6">
        {!repPlayer ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-7 shadow-sm space-y-4">
            <h1 className="text-2xl font-black text-[#02274c]">Temsilci Yoklama Paneli</h1>
            <p className="text-sm text-slate-600">
              Cumartesi sabah namazı yoklamasını yönetmek için Temsilci Oyuncu ID&apos;nizi girin.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="text"
                required
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                placeholder="Örn: IKB-1234"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 uppercase font-bold"
              />
              {err && <p className="text-[#a60513] text-sm font-bold">{err}</p>}
              <button type="submit" className="w-full min-h-[48px] rounded-xl bg-[#02274c] text-white font-extrabold">
                Giriş Yap
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#02274c] text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-red-300">Temsilci Yetkili</span>
                <h1 className="text-2xl font-black">{repPlayer.full_name} ({repPlayer.age_group})</h1>
              </div>
              <button
                type="button"
                onClick={loadAttendance}
                className="px-5 py-2.5 rounded-xl bg-[#a60513] font-extrabold text-sm"
              >
                Yoklamayı Yenile
              </button>
            </div>

            {session && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 grid md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <QRCodeSVG value={session.qr_token} size={200} />
                  <p className="text-xs font-bold text-slate-600 mt-3 text-center">
                    {session.session_date} • {session.mosque_name}
                  </p>
                </div>

                <div className="md:col-span-8 space-y-3">
                  <h2 className="text-lg font-extrabold text-[#02274c]">
                    Canlı Katılım Listesi ({attendedIds.size} / {players.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p) => {
                      const ok = attendedIds.has(p.id);
                      return (
                        <span
                          key={p.id}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${
                            ok
                              ? "bg-emerald-500 border-emerald-600 text-white"
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}
                        >
                          {ok ? "✓ " : ""}{p.age_group} - {p.full_name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}