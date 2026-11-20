"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  player_code: string;
  full_name: string;
  age_group: string;
  birth_date: string | null;
  position: "Kaleci" | "Defans" | "Orta Saha" | "Forvet";
  jersey_number: number | null;
}

const CATEGORIES = [
  { key: "U11", label: "U11" },
  { key: "U12", label: "U12" },
  { key: "PGL-U13", label: "U13" },
  { key: "PGL-U14", label: "U14" },
  { key: "PGL-U15", label: "U15" },
  { key: "PGL-U16", label: "U16" },
  { key: "PGL-U17", label: "U17" },
  { key: "PGL-U19", label: "U19" },
  { key: "PGL-GENEL", label: "PGL Kadro" },
];

const FORMATIONS: Record<string, { label: string; group: "11" | "altyapi"; rows: { role: string; count: number }[] }> = {
  "4-3-3": {
    label: "4-3-3 (Hücum)",
    group: "11",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1 (Modern)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Ofansif Orta", count: 3 },
      { role: "Ön Libero", count: 2 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-4-2": {
    label: "4-4-2 (Dengeli)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-4-2-elmas": {
    label: "4-4-2 (Elmas)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "On Numara", count: 1 },
      { role: "Merkez Orta", count: 2 },
      { role: "Ön Libero", count: 1 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-1-4-1": {
    label: "4-1-4-1 (Kontrollü)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Orta Saha", count: 4 },
      { role: "Ön Libero", count: 1 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-5-2": {
    label: "3-5-2 (Kanat)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 5 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-4-3": {
    label: "3-4-3 (Baskılı)",
    group: "11",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "5-3-2": {
    label: "5-3-2 (Savunma)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 5 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "5-4-1": {
    label: "5-4-1 (Kontra)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 5 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "2-3-1": {
    label: "2-3-1 (7'li)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 2 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-2-1": {
    label: "3-2-1 (7'li)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 2 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-1": {
    label: "3-3-1 (8'li U11/U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "2-3-2": {
    label: "2-3-2 (8'li U11/U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 2 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-2-3": {
    label: "3-2-3 (9'lu U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 2 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-2": {
    label: "3-3-2 (9'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-3": {
    label: "3-3-3 (10'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-3-2": {
    label: "4-3-2 (10'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
};

const TACTIC_PLANS = [
  "Dengeli Oyun",
  "Ön Alan Baskısı (Yüksek Pres)",
  "Topa Sahip Olma & Pas Oyunu",
  "Hızlı Kontra Atak",
  "Kanat Organizasyonu",
  "Merkezden Kilit Açma",
];

type EligibilityResult = {
  eligible: boolean;
  isQuota: boolean;
  reason?: string;
};

function checkPlayerEligibility(player: Player, categoryKey: string): EligibilityResult {
  const d = player.birth_date;
  if (categoryKey === "PGL-GENEL") {
    return { eligible: true, isQuota: false };
  }
  if (!d) {
    return { eligible: false, isQuota: false, reason: "Doğum tarihi girilmemiş" };
  }

  switch (categoryKey) {
    case "PGL-U13":
      if (d >= "2013-01-01") return { eligible: true, isQuota: false };
      if (d >= "2012-10-01" && d <= "2012-12-31") {
        return { eligible: true, isQuota: true, reason: "2012 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "PGL-U14":
      if (d >= "2012-01-01") return { eligible: true, isQuota: false };
      if (d >= "2011-10-01" && d <= "2011-12-31") {
        return { eligible: true, isQuota: true, reason: "2011 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "PGL-U15":
      if (d >= "2011-01-01") return { eligible: true, isQuota: false };
      if (d >= "2010-10-01" && d <= "2010-12-31") {
        return { eligible: true, isQuota: true, reason: "2010 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "PGL-U16":
      return { eligible: d >= "2010-01-01", isQuota: false };

    case "PGL-U17":
      return { eligible: d >= "2009-01-01", isQuota: false };

    case "PGL-U19":
      if (d >= "2007-01-01" && d <= "2010-12-31") return { eligible: true, isQuota: false };
      if (d >= "2006-01-01" && d <= "2006-12-31") {
        return { eligible: true, isQuota: true, reason: "2006 Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "U12":
      return { eligible: d >= "2014-01-01", isQuota: false };

    case "U11":
      return { eligible: d >= "2015-01-01", isQuota: false };

    default:
      return { eligible: true, isQuota: false };
  }
}

export default function SquadBuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState("PGL-U19");
  const [formation, setFormation] = useState("4-3-3");
  const [tacticPlan, setTacticPlan] = useState(TACTIC_PLANS[0]);
  const [tacticNote, setTacticNote] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Record<string, Player | null>>({});
  const [squadNumbers, setSquadNumbers] = useState<Record<string, number | "">>({});
  const [draggingPlayer, setDraggingPlayer] = useState<Player | null>(null);
  const [draggingFromSlot, setDraggingFromSlot] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState("");

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("id, player_code, full_name, age_group, birth_date, position, jersey_number")
        .order("jersey_number", { ascending: true });
      setAllPlayers((data as Player[]) || []);
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSlots({});
    setSquadNumbers({});
    setQuotaWarning("");
  };

  const eligibleList = allPlayers
    .map((p) => ({ player: p, info: checkPlayerEligibility(p, selectedCategory) }))
    .filter(
      (x) =>
        x.info.eligible &&
        x.player.full_name.toLowerCase().includes(playerSearch.toLowerCase())
    );

  const currentLineup = Object.values(slots).filter(Boolean) as Player[];
  const quotaPlayersInLineup = currentLineup.filter(
    (p) => checkPlayerEligibility(p, selectedCategory).isQuota
  );
  const quotaGkCount = quotaPlayersInLineup.filter((p) => p.position === "Kaleci").length;
  const quotaOutfieldCount = quotaPlayersInLineup.filter((p) => p.position !== "Kaleci").length;

  const getEffectiveNumber = (player: Player): number | "" => {
    if (Object.prototype.hasOwnProperty.call(squadNumbers, player.id)) {
      return squadNumbers[player.id];
    }
    return player.jersey_number ?? "";
  };

  const handleSquadNumberChange = (playerId: string, rawVal: string) => {
    setQuotaWarning("");
    if (rawVal === "") {
      setSquadNumbers((prev) => ({ ...prev, [playerId]: "" }));
      return;
    }
    const num = Number(rawVal);
    if (isNaN(num) || num < 1 || num > 99) return;

    const conflict = currentLineup.find(
      (p) => p.id !== playerId && getEffectiveNumber(p) === num
    );
    if (conflict) {
      setQuotaWarning(
        `#${num} forma numarası bu kadroda zaten ${conflict.full_name} adlı oyuncuya verilmiş! Farklı bir numara seçin.`
      );
      return;
    }

    setSquadNumbers((prev) => ({ ...prev, [playerId]: num }));
  };

  const assignToSlot = (targetSlotKey: string, player: Player, fromSlotKey: string | null) => {
    setQuotaWarning("");

    if (fromSlotKey) {
      if (fromSlotKey === targetSlotKey) return;
      setSlots((prev) => {
        const targetOccupant = prev[targetSlotKey] || null;
        return {
          ...prev,
          [targetSlotKey]: player,
          [fromSlotKey]: targetOccupant,
        };
      });
      return;
    }

    const info = checkPlayerEligibility(player, selectedCategory);
    if (!info.eligible) {
      setQuotaWarning(`${player.full_name} bu kategorinin yaş kurallarına uygun değil.`);
      return;
    }

    const alreadyOnPitch = currentLineup.some((p) => p.id === player.id);

    if (info.isQuota && !alreadyOnPitch) {
      if (["PGL-U13", "PGL-U14", "PGL-U15"].includes(selectedCategory)) {
        if (quotaPlayersInLineup.length >= 2) {
          setQuotaWarning(
            `${selectedCategory} kategorisinde en fazla 2 kontenjan futbolcu sahada yer alabilir!`
          );
          return;
        }
      }
      if (selectedCategory === "PGL-U19") {
        if (quotaPlayersInLineup.length >= 3) {
          setQuotaWarning("U19 PGL'de toplam en fazla 3 (2 saha + 1 kaleci) 2006 kontenjanı yer alabilir!");
          return;
        }
        if (player.position === "Kaleci" && quotaGkCount >= 1) {
          setQuotaWarning("U19 PGL'de 2006 doğumlu en fazla 1 kaleci kontenjanı yazılabilir!");
          return;
        }
        if (player.position !== "Kaleci" && quotaOutfieldCount >= 2) {
          setQuotaWarning("U19 PGL'de 2006 doğumlu en fazla 2 saha oyuncusu kontenjanı yazılabilir!");
          return;
        }
      }
    }

    if (!alreadyOnPitch && player.jersey_number !== null) {
      const numConflict = currentLineup.find(
        (p) => p.id !== player.id && getEffectiveNumber(p) === player.jersey_number
      );
      if (numConflict) {
        setSquadNumbers((prev) => ({ ...prev, [player.id]: "" }));
        setQuotaWarning(
          `#${player.jersey_number} numarası bu kadroda ${numConflict.full_name} tarafından kullanıldığı için ${player.full_name} için kart üzerinden yeni numara girin.`
        );
      } else {
        setSquadNumbers((prev) => ({ ...prev, [player.id]: player.jersey_number as number }));
      }
    }

    setSlots((prev) => {
      const cleaned: Record<string, Player | null> = {};
      for (const [k, v] of Object.entries(prev)) {
        cleaned[k] = v?.id === player.id ? null : v;
      }
      cleaned[targetSlotKey] = player;
      return cleaned;
    });
  };

  const removeFromSlot = (slotKey: string) => {
    const occupant = slots[slotKey];
    setSlots((prev) => ({ ...prev, [slotKey]: null }));
    if (occupant) {
      setSquadNumbers((prev) => {
        const copy = { ...prev };
        delete copy[occupant.id];
        return copy;
      });
    }
  };

  const copySquadText = () => {
    const lines = currentLineup.map((p) => {
      const num = getEffectiveNumber(p);
      return `#${num === "" ? "-" : num} ${p.full_name} (${p.position})`;
    });
    const text =
      `İkbalspor ${selectedCategory} (${FORMATIONS[formation].label}) Kadrosu\n` +
      `Oyun Planı: ${tacticPlan}` +
      (tacticNote.trim() ? `\nNot: ${tacticNote.trim()}` : "") +
      `\n\n` +
      lines.join("\n");
    navigator.clipboard.writeText(text);
    alert("Maç kadrosu ve taktik plan kopyalandı!");
  };

  const assignedIds = new Set(currentLineup.map((p) => p.id));
  const currentFormation = FORMATIONS[formation];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">Taktik Tahtası & Kadro Kur</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              Yaş ve kontenjan kurallarına uygun kadronu sürükle-bırak ile oluştur.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategoryChange(cat.key)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                  selectedCategory === cat.key
                    ? "bg-white text-[#02274c] shadow"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">
                Diziliş (Formasyon)
              </label>
              <select
                value={formation}
                onChange={(e) => {
                  setFormation(e.target.value);
                  setSlots({});
                  setSquadNumbers({});
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-extrabold text-[#02274c] bg-white"
              >
                <optgroup label="11'li Dizilişler">
                  {Object.entries(FORMATIONS)
                    .filter(([, v]) => v.group === "11")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="7 / 8 / 9 / 10 Kişilik Dizilişler">
                  {Object.entries(FORMATIONS)
                    .filter(([, v]) => v.group === "altyapi")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">
                Oyun Planı
              </label>
              <select
                value={tacticPlan}
                onChange={(e) => setTacticPlan(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-[#02274c] bg-white"
              >
                {TACTIC_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">
                Taktik Notu (Opsiyonel)
              </label>
              <input
                type="text"
                value={tacticNote}
                onChange={(e) => setTacticNote(e.target.value)}
                placeholder="Örn: Duran toplarda ön direk koşusu..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
            <div className="text-xs sm:text-sm font-bold text-[#02274c]">
              {selectedCategory === "PGL-U19" ? (
                <span>
                  2006 Kontenjanı: Saha <strong>{quotaOutfieldCount}/2</strong> • Kaleci{" "}
                  <strong>{quotaGkCount}/1</strong> (Toplam {quotaPlayersInLineup.length}/3)
                </span>
              ) : ["PGL-U13", "PGL-U14", "PGL-U15"].includes(selectedCategory) ? (
                <span>
                  Son Çeyrek Kontenjanı: <strong>{quotaPlayersInLineup.length} / 2</strong>
                </span>
              ) : (
                <span>
                  Sahadaki Oyuncu: <strong>{currentLineup.length}</strong>
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copySquadText}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
              >
                📋 Kadroyu & Taktiği Kopyala
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlots({});
                  setSquadNumbers({});
                  setQuotaWarning("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-extrabold cursor-pointer"
              >
                Sahayı Temizle
              </button>
            </div>
          </div>
        </div>

        {quotaWarning && (
          <div className="p-3.5 rounded-xl bg-red-50 border-2 border-[#a60513] text-[#a60513] font-extrabold text-xs sm:text-sm">
            {quotaWarning}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#02274c]">
                Uygun Oyuncular ({eligibleList.length})
              </h2>
            </div>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Oyuncu ismi ara..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400"
            />

            {loading ? (
              <p className="text-sm text-slate-500">Yükleniyor...</p>
            ) : eligibleList.length === 0 ? (
              <p className="text-sm text-slate-500">
                Bu kategoriye veya aramaya uygun kayıtlı oyuncu yok.
              </p>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {eligibleList.map(({ player: p, info }) => {
                  const isUsed = assignedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => {
                        setDraggingPlayer(p);
                        setDraggingFromSlot(null);
                      }}
                      className={`p-2.5 rounded-xl border-2 cursor-grab active:cursor-grabbing flex items-center justify-between transition ${
                        isUsed
                          ? "border-emerald-500 bg-emerald-50"
                          : info.isQuota
                          ? "border-amber-400 bg-amber-50/40"
                          : "border-slate-200 bg-white hover:border-[#02274c]"
                      }`}
                    >
                      <div>
                        <span className="font-black text-[#a60513] mr-1.5 text-xs">
                          #{p.jersey_number ?? "-"}
                        </span>
                        <strong className="text-[#02274c] text-xs sm:text-sm">{p.full_name}</strong>
                        <div className="text-[11px] text-slate-500 font-bold">
                          {p.position} • {p.birth_date || "-"}
                        </div>
                        {info.isQuota && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                            {info.reason}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-400 shrink-0 ml-2">
                        {isUsed ? "Sahada ✓" : "Sürükle ⠿"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-8">
            <div className="relative rounded-3xl bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-700 border-4 border-white shadow-xl p-4 sm:p-6 min-h-[580px] flex flex-col justify-between gap-3 overflow-hidden">
              <div className="pointer-events-none absolute inset-4 border-2 border-white/25 rounded-2xl">
                <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/25" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/25" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 border-b-2 border-x-2 border-white/25 rounded-b-lg" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-16 border-t-2 border-x-2 border-white/25 rounded-t-lg" />
              </div>

              {currentFormation.rows.map((row, rowIdx) => (
                <div
                  key={`${row.role}-${rowIdx}`}
                  className="relative z-10 flex justify-center items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-3"
                >
                  {Array.from({ length: row.count }).map((_, colIdx) => {
                    const slotKey = `${rowIdx}-${colIdx}`;
                    const occupant = slots[slotKey];
                    const occIsQuota =
                      occupant && checkPlayerEligibility(occupant, selectedCategory).isQuota;
                    const effNum = occupant ? getEffectiveNumber(occupant) : "";

                    return (
                      <div
                        key={slotKey}
                        draggable={Boolean(occupant)}
                        onDragStart={() => {
                          if (occupant) {
                            setDraggingPlayer(occupant);
                            setDraggingFromSlot(slotKey);
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggingPlayer) {
                            assignToSlot(slotKey, draggingPlayer, draggingFromSlot);
                            setDraggingPlayer(null);
                            setDraggingFromSlot(null);
                          }
                        }}
                        className={`w-24 sm:w-28 min-h-[78px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-between p-1.5 text-center transition ${
                          occupant
                            ? occIsQuota
                              ? "bg-amber-600 border-white border-solid text-white shadow-lg cursor-grab active:cursor-grabbing"
                              : "bg-[#02274c] border-[#a60513] border-solid text-white shadow-lg cursor-grab active:cursor-grabbing"
                            : "bg-white/10 border-white/40 text-white/85 hover:bg-white/20 justify-center"
                        }`}
                      >
                        {occupant ? (
                          <>
                            <div className="w-full flex items-center justify-between gap-1">
                              <div
                                className="flex items-center gap-0.5 bg-white/15 rounded-md px-1 py-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] font-black text-red-200">#</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={effNum}
                                  placeholder="-"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleSquadNumberChange(occupant.id, e.target.value)}
                                  className="w-7 bg-transparent text-white text-[11px] font-black text-center focus:outline-none placeholder:text-white/50"
                                  title="Sadece bu kadro için forma numarasını değiştir"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromSlot(slotKey);
                                }}
                                className="text-[11px] font-black text-white/80 hover:text-white px-1 cursor-pointer"
                                title="Sahadan Çıkar"
                              >
                                ✕
                              </button>
                            </div>

                            <span className="text-[11px] font-extrabold leading-tight line-clamp-2 my-0.5">
                              {occupant.full_name}
                            </span>

                            <span className="text-[9px] opacity-80">
                              {occIsQuota ? "Kontenjan • " : ""}Sürükle ↔
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-extrabold leading-tight">{row.role}</span>
                            <span className="text-[9px] opacity-75">Bırak</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}