"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";

const supabase = createClient();

interface PlayerCardSectionProps {
  player: Player;
  onPlayerUpdated?: (updated: Player) => void;
  onFeedback?: (msg: string) => void;
}

type CardTier = {
  label: string;
  badgeText: string;
  cardBg: string;
  borderColor: string;
  accentText: string;
};

function getCardTier(ovr: number): CardTier {
  if (ovr >= 90) {
    return {
      label: "Diamond Kart",
      badgeText: "90+ Diamond",
      cardBg: "from-cyan-700 via-sky-800 to-indigo-950",
      borderColor: "border-cyan-300/70",
      accentText: "text-cyan-200",
    };
  }
  if (ovr >= 70) {
    return {
      label: "Gold Kart",
      badgeText: "70-90 Gold",
      cardBg: "from-amber-500 via-yellow-600 to-amber-800",
      borderColor: "border-amber-200/80",
      accentText: "text-amber-100",
    };
  }
  if (ovr >= 50) {
    return {
      label: "Silver Kart",
      badgeText: "50-70 Silver",
      cardBg: "from-slate-400 via-slate-600 to-slate-800",
      borderColor: "border-slate-200/70",
      accentText: "text-slate-100",
    };
  }
  return {
    label: "Bronze Kart",
    badgeText: "0-50 Bronze",
    cardBg: "from-amber-800 via-[#8b3a17] to-stone-900",
    borderColor: "border-amber-500/50",
    accentText: "text-amber-200",
  };
}

export function PlayerCardSection({
  player,
  onPlayerUpdated,
  onFeedback,
}: PlayerCardSectionProps) {
  const playerExt = player as Player & {
    skill_points?: number | null;
    pace?: number | null;
    shooting?: number | null;
    passing?: number | null;
    dribbling?: number | null;
    defending?: number | null;
    physical?: number | null;
    card_title?: string | null;
    card_motto?: string | null;
  };

  const [availablePoints, setAvailablePoints] = useState<number>(
    Number(playerExt.skill_points ?? 0)
  );
  const [pace, setPace] = useState<number>(Number(playerExt.pace ?? 20));
  const [shooting, setShooting] = useState<number>(
    Number(playerExt.shooting ?? 20)
  );
  const [passing, setPassing] = useState<number>(
    Number(playerExt.passing ?? 20)
  );
  const [dribbling, setDribbling] = useState<number>(
    Number(playerExt.dribbling ?? 40)
  );
  const [defending, setDefending] = useState<number>(
    Number(playerExt.defending ?? 20)
  );
  const [physical, setPhysical] = useState<number>(
    Number(playerExt.physical ?? 20)
  );
  const [cardTitle, setCardTitle] = useState<string>(
    playerExt.card_title || "Gol Makinesi"
  );
  const [cardMotto, setCardMotto] = useState<string>(
    playerExt.card_motto || "Sahada her şey takım için!"
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const ovr = useMemo(() => {
    const avg =
      (pace + shooting + passing + dribbling + defending + physical) / 6;
    return Math.max(1, Math.min(99, Math.round(avg)));
  }, [pace, shooting, passing, dribbling, defending, physical]);

  const tier = useMemo(() => getCardTier(ovr), [ovr]);

  function handleSpendPoint(
    stat: "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical"
  ) {
    setStatusMsg(null);
    if (availablePoints <= 0) {
      setStatusMsg({
        ok: false,
        text: "Harcamak için yeterli puanınız bulunmuyor (Kalan Puan: 0).",
      });
      return;
    }

    setAvailablePoints((prev) => Math.max(0, prev - 1));
    if (stat === "pace") setPace((v) => Math.min(99, v + 1));
    if (stat === "shooting") setShooting((v) => Math.min(99, v + 1));
    if (stat === "passing") setPassing((v) => Math.min(99, v + 1));
    if (stat === "dribbling") setDribbling((v) => Math.min(99, v + 1));
    if (stat === "defending") setDefending((v) => Math.min(99, v + 1));
    if (stat === "physical") setPhysical((v) => Math.min(99, v + 1));
  }

  async function handleSaveCard() {
    setSaving(true);
    setStatusMsg(null);

    const cleanTitle = cardTitle.trim() || "Gol Makinesi";
    const cleanMotto = cardMotto.trim() || "Sahada her şey takım için!";

    const { error } = await supabase
      .from("players")
      .update({
        skill_points: availablePoints,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
        card_title: cleanTitle,
        card_motto: cleanMotto,
      })
      .eq("id", player.id);

    setSaving(false);

    if (error) {
      const msg = "Kart kaydedilemedi: " + error.message;
      setStatusMsg({ ok: false, text: msg });
      onFeedback?.(msg);
      return;
    }

    const okMsg = "Futbolcu kartınız ve yetenek puanlarınız kaydedildi.";
    setStatusMsg({ ok: true, text: okMsg });
    onFeedback?.(okMsg);
    onPlayerUpdated?.({
      ...player,
      ...( {
        skill_points: availablePoints,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
        card_title: cleanTitle,
        card_motto: cleanMotto,
      } as Partial<Player> ),
    });
  }

  const initials = (player.full_name || "İ")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-xs space-y-5 text-[var(--text-primary)] tabular-nums">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
          Futbolcu Kartım &amp; Yetenekler
        </h2>
        <span className="px-3.5 py-1 rounded-full bg-[var(--brand-navy)] text-white text-xs font-black">
          Puan: {availablePoints}
        </span>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        0-50 {tier.label} • 0-50 Bronze • 50-70 Silver • 70-90 Gold • 90+ Diamond
      </p>

      {/* Görseldeki Futbolcu Kartı */}
      <div className="flex justify-center">
        <div
          className={`w-full max-w-sm rounded-3xl bg-gradient-to-b ${tier.cardBg} text-white border-2 ${tier.borderColor} p-6 shadow-lg space-y-4`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-black leading-none">{ovr}</div>
              <div className="text-xs font-extrabold uppercase tracking-wider mt-1 opacity-90">
                {player.position || "FORVET"}
              </div>
            </div>
            <div className="text-sm font-black tracking-wide">
              {player.age_group || "U11"}
            </div>
          </div>

          <div className="flex flex-col items-center text-center space-y-2.5">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[var(--brand-red)] bg-white"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--brand-red)] border-2 border-white/40 flex items-center justify-center text-3xl font-black text-white shadow-sm">
                {initials}
              </div>
            )}

            <span className="inline-block px-3.5 py-1 rounded-full bg-white text-slate-950 text-xs font-black shadow-xs">
              ★ {cardTitle || "Gol Makinesi"}
            </span>

            <div>
              <div className="text-xl font-black tracking-tight">
                {player.full_name}
              </div>
              <p className={`text-xs italic mt-0.5 ${tier.accentText}`}>
                &ldquo;{cardMotto || "Sahada her şey takım için!"}&rdquo;
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/20 grid grid-cols-3 gap-y-2.5 gap-x-2 text-center text-xs font-black">
            <div>
              <span className="opacity-80">HIZ </span>
              <span className="text-sm">{pace}</span>
            </div>
            <div>
              <span className="opacity-80">ŞUT </span>
              <span className="text-sm">{shooting}</span>
            </div>
            <div>
              <span className="opacity-80">PAS </span>
              <span className="text-sm">{passing}</span>
            </div>
            <div>
              <span className="opacity-80">DRİ </span>
              <span className="text-sm">{dribbling}</span>
            </div>
            <div>
              <span className="opacity-80">DEF </span>
              <span className="text-sm">{defending}</span>
            </div>
            <div>
              <span className="opacity-80">FİZ </span>
              <span className="text-sm">{physical}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Puan Harca */}
      <div className="space-y-2.5">
        <div className="text-xs font-black text-[var(--text-primary)]">
          Puan Harca (Kalan Puan: {availablePoints})
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSpendPoint("pace")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Hız
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("shooting")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Şut
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("passing")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Pas
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("dribbling")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Dripling
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("defending")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Defans
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("physical")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Fizik
          </button>
        </div>
      </div>

      {/* Başlık ve Motto Alanları */}
      <div className="space-y-3">
        <input
          type="text"
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
          placeholder="Kart başlığı (Örn: Gol Makinesi)"
          className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]"
        />

        <input
          type="text"
          value={cardMotto}
          onChange={(e) => setCardMotto(e.target.value)}
          placeholder="Kart mottosu (Örn: Her maç final!)"
          className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"
        />
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold ${
            statusMsg.ok
              ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSaveCard()}
        className="w-full py-3.5 rounded-2xl bg-[var(--brand-navy)] hover:opacity-95 text-white text-sm font-black cursor-pointer disabled:opacity-50 transition"
      >
        {saving ? "Kaydediliyor..." : "Kartımı Kaydet"}
      </button>
    </section>
  );
}