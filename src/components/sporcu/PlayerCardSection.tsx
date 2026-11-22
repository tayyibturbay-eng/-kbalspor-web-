"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface CardPlayerData {
  id: string;
  full_name: string;
  age_group: string;
  position?: string | null;
  jersey_number?: number | null;
  photo_url?: string | null;
  skill_points?: number | null;
  player_code?: string | null;
}

interface PlayerCardSectionProps {
  player: CardPlayerData;
  onPlayerUpdated?: (updated: CardPlayerData) => void;
}

export function PlayerCardSection({ player, onPlayerUpdated }: PlayerCardSectionProps) {
  const [jerseyInput, setJerseyInput] = useState<string>(
    player.jersey_number ? String(player.jersey_number) : ""
  );
  const [positionInput, setPositionInput] = useState<string>(
    player.position || "Orta Saha"
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pts = Number(player.skill_points ?? 20);
  const ovr = Math.min(99, Math.max(40, 50 + Math.floor(pts / 2)));

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);

    const parsedJersey = jerseyInput.trim()
      ? Math.max(1, Math.min(99, parseInt(jerseyInput.replace(/[^0-9]/g, ""), 10) || 1))
      : null;

    const { error } = await supabase
      .from("players")
      .update({
        position: positionInput,
        jersey_number: parsedJersey,
      })
      .eq("id", player.id);

    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: "Kart kaydedilemedi: " + error.message });
      return;
    }

    const nextPlayer: CardPlayerData = {
      ...player,
      position: positionInput,
      jersey_number: parsedJersey,
    };
    onPlayerUpdated?.(nextPlayer);
    setMsg({ ok: true, text: "Futbolcu kartın güncellendi!" });
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#a60513]">
            Resmi Kulüp Kartı
          </span>
          <h2 className="text-lg font-black text-[#02274c]">
            🃏 Futbolcu Kartım
          </h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#02274c] text-white text-xs font-black">
          {ovr} OVR • {pts} Puan
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <div className="rounded-3xl bg-gradient-to-br from-[#02274c] via-[#06396b] to-[#a60513] text-white p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-black leading-none">{ovr}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200 mt-1">
                {positionInput || "Orta Saha"}
              </div>
              <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-extrabold">
                {player.age_group}
              </div>
            </div>

            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-300"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/15 border-2 border-amber-300/70 flex items-center justify-center text-2xl font-black">
                {parsedBadgeInitial(player.full_name)}
              </div>
            )}
          </div>

          <div className="border-t border-white/15 pt-3 flex items-center justify-between">
            <div>
              <div className="text-base font-black">{player.full_name}</div>
              <div className="text-xs text-slate-200">
                Çorum İkbalspor • {player.player_code || "SPORCU"}
              </div>
            </div>
            <div className="text-2xl font-black text-amber-300">
              {jerseyInput.trim() ? `#${jerseyInput.trim()}` : "#--"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveCard} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mevki
            </label>
            <select
              value={positionInput}
              onChange={(e) => setPositionInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
            >
              <option value="Kaleci">Kaleci</option>
              <option value="Defans">Defans</option>
              <option value="Orta Saha">Orta Saha</option>
              <option value="Forvet">Forvet</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Forma Numarası (1-99)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={jerseyInput}
              onFocus={() => {
                if (jerseyInput === "0") setJerseyInput("");
              }}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
                setJerseyInput(digits);
              }}
              placeholder="Örn: 10"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-extrabold text-slate-900"
            />
          </div>

          {msg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold ${
                msg.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-5 rounded-xl bg-[#02274c] hover:bg-[#033669] text-white text-sm font-extrabold cursor-pointer disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Kartımı Kaydet"}
          </button>
        </form>
      </div>
    </section>
  );
}

function parsedBadgeInitial(name: string): string {
  const clean = (name || "İ").trim();
  return clean ? clean.charAt(0).toUpperCase() : "İ";
}