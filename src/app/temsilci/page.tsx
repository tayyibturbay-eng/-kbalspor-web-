"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { PrayerSession } from "@/types/club";

const supabase = createClient();

interface RepPlayer {
  id: string;
  player_code: string;
  player_pin: string | null;
  full_name: string;
  age_group: string;
  is_representative: boolean;
}

export default function RepresentativePage() {
  const [repCode, setRepCode] = useState("");
  const [repPin, setRepPin] = useState("");
  const [repPlayer, setRepPlayer] = useState<RepPlayer | null>(null);
  const [err, setErr] = useState("");
  const [session, setSession] = useState<PrayerSession | null>(null);
  const [players, setPlayers] = useState<RepPlayer[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem("ikbal_logged_player_id")
        : null;
    if (!savedId) return;

    (async () => {
      const { data } = await supabase
        .from("players")
        .select(
          "id, player_code, player_pin, full_name, age_group, is_representative"
        )
        .eq("id", savedId)
        .maybeSingle();

      if (data && data.is_representative) {
        setRepPlayer(data as RepPlayer);
        await loadAttendance();
      }
    })();
  }, []);

  async function loadAttendance() {
    const [sRes, pRes] = await Promise.all([
      supabase
        .from("prayer_sessions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("players")
        .select(
          "id, player_code, player_pin, full_name, age_group, is_representative"
        )
        .order("age_group", { ascending: true }),
    ]);

    const activeSess = sRes.data?.[0] as PrayerSession | undefined;
    setSession(activeSess || null);
    setPlayers((pRes.data as RepPlayer[]) || []);

    if (activeSess) {
      const { data: aData } = await supabase
        .from("prayer_attendance")
        .select("player_id")
        .eq("session_id", activeSess.id);
      setAttendedIds(
        new Set((aData || []).map((x: { player_id: string }) => x.player_id))
      );
    } else {
      setAttendedIds(new Set());
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { data } = await supabase
      .from("players")
      .select(
        "id, player_code, player_pin, full_name, age_group, is_representative"
      )
      .eq("player_code", repCode.trim().toUpperCase())
      .maybeSingle();

    if (!data) {
      setErr("Bu ID'ye ait oyuncu bulunamadı.");
      return;
    }
    if ((data.player_pin || "1234") !== repPin.trim()) {
      setErr("Şifre hatalı.");
      return;
    }
    if (!data.is_representative) {
      setErr(
        "Bu panel sadece yönetici tarafından seçilen Temsilci oyunculara açıktır."
      );
      return;
    }
    setRepPlayer(data as RepPlayer);
    await loadAttendance();
  }

  async function togglePlayerAttendance(playerId: string) {
    if (!session) return;
    setTogglingId(playerId);
    const isPresent = attendedIds.has(playerId);

    if (isPresent) {
      const { error } = await supabase
        .from("prayer_attendance")
        .delete()
        .eq("session_id", session.id)
        .eq("player_id", playerId);
      if (!error) {
        setAttendedIds((prev) => {
          const next = new Set(prev);
          next.delete(playerId);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from("prayer_attendance")
        .insert({ session_id: session.id, player_id: playerId });
      if (!error) {
        setAttendedIds((prev) => new Set(prev).add(playerId));
      }
    }
    setTogglingId(null);
  }

  const filteredPlayers = players.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.age_group.toLowerCase().includes(q) ||
      p.player_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-6">
        {!repPlayer ? (
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-7 shadow-sm space-y-4">
            <h1 className="text-2xl font-black text-[#02274c]">
              Temsilci Yoklama Paneli
            </h1>
            <p className="text-sm text-slate-600">
              Temsilci Oyuncu ID&apos;nizi ve şifrenizi girin.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="text"
                required
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                placeholder="Oyuncu ID (Örn: IKB-1234)"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 uppercase font-bold"
              />
              <input
                type="password"
                required
                value={repPin}
                onChange={(e) => setRepPin(e.target.value)}
                placeholder="Şifre (Varsayılan: Tel son 4 hane)"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 font-bold"
              />
              {err && <p className="text-[#a60513] text-sm font-bold">{err}</p>}
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#02274c] text-white font-extrabold cursor-pointer"
              >
                Giriş Yap
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#02274c] text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-red-300">
                  Temsilci Yetkili
                </span>
                <h1 className="text-2xl font-black">
                  {repPlayer.full_name} ({repPlayer.age_group})
                </h1>
              </div>
              <button
                type="button"
                onClick={loadAttendance}
                className="px-5 py-2.5 rounded-xl bg-[#a60513] font-extrabold text-sm cursor-pointer"
              >
                Yoklamayı Yenile
              </button>
            </div>

            {!session ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600 text-sm font-bold">
                Şu anda yönetici tarafından başlatılmış aktif bir QR yoklama
                oturumu bulunmuyor.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 grid md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <QRCodeSVG value={session.qr_token} size={200} />
                  <p className="text-xs font-bold text-slate-700 mt-3 text-center">
                    {session.title} • {session.session_date}
                  </p>
                </div>

                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-[#02274c]">
                      Canlı Katılım Listesi ({attendedIds.size} /{" "}
                      {players.length})
                    </h2>
                    <span className="text-xs text-slate-500 font-semibold">
                      Telefonu olmayanlar için isme dokunun
                    </span>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="İsim, yaş grubu veya ID ile ara..."
                    className="w-full min-h-[44px] px-4 rounded-xl border-2 border-slate-300 text-sm font-bold"
                  />
                  <div className="flex flex-wrap gap-2">
                    {filteredPlayers.map((p) => {
                      const ok = attendedIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={togglingId === p.id}
                          onClick={() => togglePlayerAttendance(p.id)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition cursor-pointer ${
                            ok
                              ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                              : "bg-slate-100 border-slate-200 text-slate-700 hover:border-[#02274c]"
                          }`}
                        >
                          {ok ? "☑ " : "☐ "}
                          {p.age_group} - {p.full_name}
                        </button>
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