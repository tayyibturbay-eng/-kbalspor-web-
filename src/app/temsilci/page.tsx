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
          "id, player_code, full_name, age_group, is_representative"
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
          "id, player_code, full_name, age_group, is_representative"
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
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "player",
          code: repCode.trim().toUpperCase(),
          pin: repPin.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.player) {
        setErr(json.error || "Oyuncu ID veya şifre hatalı.");
        return;
      }
      if (!json.player.is_representative) {
        setErr(
          "Bu panel sadece yönetici tarafından seçilen Temsilci oyunculara açıktır."
        );
        return;
      }
      setRepPlayer(json.player as RepPlayer);
      await loadAttendance();
    } catch {
      setErr("Sunucuya bağlanılamadı.");
    }
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
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16 transition-colors">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-6 page-transition tabular-nums">
        {!repPlayer ? (
          <div className="max-w-md mx-auto bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-7 shadow-xs space-y-4">
            <h1 className="text-2xl font-black text-[var(--text-primary)]">
              Temsilci Yoklama Paneli
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Temsilci Oyuncu ID&apos;nizi ve şifrenizi girin.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="text"
                required
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                placeholder="Oyuncu ID (Örn: IKB-1234)"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] uppercase font-bold"
              />
              <input
                type="password"
                required
                value={repPin}
                onChange={(e) => setRepPin(e.target.value)}
                placeholder="Şifre (Varsayılan: Tel son 4 hane)"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-bold"
              />
              {err && (
                <p className="text-[var(--brand-red)] text-sm font-bold">
                  {err}
                </p>
              )}
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold cursor-pointer transition"
              >
                Giriş Yap
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] text-white rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-200">
                  Temsilci Yetkili
                </span>
                <h1 className="text-2xl font-black">
                  {repPlayer.full_name} ({repPlayer.age_group})
                </h1>
              </div>
              <button
                type="button"
                onClick={loadAttendance}
                className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 font-extrabold text-sm cursor-pointer transition"
              >
                Yoklamayı Yenile
              </button>
            </div>

            {!session ? (
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center text-[var(--text-secondary)] text-sm font-bold">
                Şu anda yönetici tarafından başlatılmış aktif bir QR yoklama
                oturumu bulunmuyor.
              </div>
            ) : (
              <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 grid md:grid-cols-12 gap-6 items-start shadow-xs">
                <div className="md:col-span-4 flex flex-col items-center p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-subtle)]">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200">
                    <QRCodeSVG value={session.qr_token} size={200} />
                  </div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mt-3 text-center">
                    {session.title} • {session.session_date}
                  </p>
                </div>

                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-[var(--text-primary)]">
                      Canlı Katılım Listesi ({attendedIds.size} /{" "}
                      {players.length})
                    </h2>
                    <span className="text-xs text-[var(--text-muted)] font-semibold">
                      Telefonu olmayanlar için isme dokunun
                    </span>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="İsim, yaş grubu veya ID ile ara..."
                    className="w-full min-h-[44px] px-4 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm font-bold"
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
                              ? "bg-emerald-600 border-emerald-700 text-white shadow-xs"
                              : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-navy)]"
                          }`}
                        >
                          {ok ? "[+] " : "[ ] "}
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