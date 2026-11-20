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
  photo_url?: string | null;
}

const CATEGORIES = [
  { key: "U11", label: "U11" },
  { key: "U12", label: "U12" },
  { key: "Çorum Süper Amatör Ligi-U13", label: "U13" },
  { key: "Çorum Süper Amatör Ligi-U14", label: "U14" },
  { key: "Çorum Süper Amatör Ligi-U15", label: "U15" },
  { key: "Çorum Süper Amatör Ligi-U16", label: "U16" },
  { key: "Çorum Süper Amatör Ligi-U17", label: "U17" },
  { key: "Çorum Süper Amatör Ligi-U19", label: "U19" },
  { key: "Çorum Süper Amatör Ligi-GENEL", label: "SAL" },
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
  if (categoryKey === "Çorum Süper Amatör Ligi-GENEL") {
    return { eligible: true, isQuota: false };
  }
  if (!d) {
    return { eligible: false, isQuota: false, reason: "Doğum tarihi girilmemiş" };
  }

  switch (categoryKey) {
    case "Çorum Süper Amatör Ligi-U13":
      if (d >= "2013-01-01") return { eligible: true, isQuota: false };
      if (d >= "2012-10-01" && d <= "2012-12-31") {
        return { eligible: true, isQuota: true, reason: "2012 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U14":
      if (d >= "2012-01-01") return { eligible: true, isQuota: false };
      if (d >= "2011-10-01" && d <= "2011-12-31") {
        return { eligible: true, isQuota: true, reason: "2011 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U15":
      if (d >= "2011-01-01") return { eligible: true, isQuota: false };
      if (d >= "2010-10-01" && d <= "2010-12-31") {
        return { eligible: true, isQuota: true, reason: "2010 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U16":
      return { eligible: d >= "2010-01-01", isQuota: false };

    case "Çorum Süper Amatör Ligi-U17":
      return { eligible: d >= "2009-01-01", isQuota: false };

    case "Çorum Süper Amatör Ligi-U19":
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
  const [selectedCategory, setSelectedCategory] = useState("Çorum Süper Amatör Ligi-U19");
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

  const [editingNumberFor, setEditingNumberFor] = useState<Player | null>(null);
  const [tempNumberInput, setTempNumberInput] = useState("");
  const [copiedBanner, setCopiedBanner] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("id, player_code, full_name, age_group, birth_date, position, jersey_number, photo_url")
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

  const handleSquadNumberChange = (playerId: string, rawVal: string): boolean => {
    setQuotaWarning("");
    const cleaned = rawVal.replace(/\D/g, "");
    if (cleaned === "") {
      setSquadNumbers((prev) => ({ ...prev, [playerId]: "" }));
      return true;
    }
    const num = Number(cleaned);
    if (isNaN(num) || num < 1 || num > 99) return false;

    const conflict = currentLineup.find(
      (p) => p.id !== playerId && getEffectiveNumber(p) === num
    );
    if (conflict) {
      setQuotaWarning(
        `#${num} forma numarası bu kadroda zaten ${conflict.full_name} adlı oyuncuya verilmiş! Farklı bir numara seçin.`
      );
      return false;
    }

    setSquadNumbers((prev) => ({ ...prev, [playerId]: num }));
    return true;
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
      if (["Çorum Süper Amatör Ligi-U13", "Çorum Süper Amatör Ligi-U14", "Çorum Süper Amatör Ligi-U15"].includes(selectedCategory)) {
        if (quotaPlayersInLineup.length >= 2) {
          setQuotaWarning(
            `${selectedCategory} kategorisinde en fazla 2 kontenjan futbolcu sahada yer alabilir!`
          );
          return;
        }
      }
      if (selectedCategory === "Çorum Süper Amatör Ligi-U19") {
        if (quotaPlayersInLineup.length >= 3) {
          setQuotaWarning("U19 kategorisinde toplam en fazla 3 (2 saha + 1 kaleci) 2006 kontenjanı yer alabilir!");
          return;
        }
        if (player.position === "Kaleci" && quotaGkCount >= 1) {
          setQuotaWarning("U19 kategorisinde 2006 doğumlu en fazla 1 kaleci kontenjanı yazılabilir!");
          return;
        }
        if (player.position !== "Kaleci" && quotaOutfieldCount >= 2) {
          setQuotaWarning("U19 kategorisinde 2006 doğumlu en fazla 2 saha oyuncusu kontenjanı yazılabilir!");
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
          `#${player.jersey_number} numarası bu kadroda ${numConflict.full_name} tarafından kullanıldığı için ${player.full_name} için kart üzerindeki numaraya tıklayıp yeni numara seçin.`
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

  const quickAssignPlayer = (player: Player) => {
    const isUsed = currentLineup.some((p) => p.id === player.id);
    if (isUsed) {
      const foundKey = Object.keys(slots).find((k) => slots[k]?.id === player.id);
      if (foundKey) removeFromSlot(foundKey);
      return;
    }

    const rows = FORMATIONS[formation].rows;
    const allSlotKeys: { key: string; role: string }[] = [];
    rows.forEach((r, rIdx) => {
      for (let c = 0; c < r.count; c++) {
        allSlotKeys.push({ key: `${rIdx}-${c}`, role: r.role });
      }
    });

    const preferredEmpty =
      allSlotKeys.find((s) => !slots[s.key] && s.role.toLowerCase().includes(player.position.toLowerCase().split(" ")[0])) ||
      allSlotKeys.find((s) => !slots[s.key]);

    if (!preferredEmpty) {
      setQuotaWarning("Sahadaki tüm pozisyonlar dolu. Önce bir oyuncuyu çıkarın veya üzerine sürükleyin.");
      return;
    }
    assignToSlot(preferredEmpty.key, player, null);
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
    const catLabel = CATEGORIES.find((c) => c.key === selectedCategory)?.label || selectedCategory;
    const lines = currentLineup.map((p) => {
      const num = getEffectiveNumber(p);
      return `#${num === "" ? "-" : num} ${p.full_name} (${p.position})`;
    });
    const text =
      `İkbalspor ${catLabel} (${FORMATIONS[formation].label}) Kadrosu\n` +
      `Oyun Planı: ${tacticPlan}` +
      (tacticNote.trim() ? `\nNot: ${tacticNote.trim()}` : "") +
      `\n\n` +
      lines.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2500);
  };

  const assignedIds = new Set(currentLineup.map((p) => p.id));
  const currentFormation = FORMATIONS[formation];
  const usedNumbersSet = new Set(
    currentLineup
      .filter((p) => p.id !== editingNumberFor?.id)
      .map((p) => getEffectiveNumber(p))
      .filter((n) => n !== "")
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] via-[#04376b] to-[#a60513] text-white py-6 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Taktik Tahtası & Kadro Kur</h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              Oyuncuları sahaya sürükleyin veya listeye tıklayarak hızlıca dizin.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategoryChange(cat.key)}
                className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                  selectedCategory === cat.key
                    ? "bg-white text-[#02274c] shadow-md scale-[1.03]"
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
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                Diziliş (Formasyon)
              </label>
              <select
                value={formation}
                onChange={(e) => {
                  setFormation(e.target.value);
                  setSlots({});
                  setSquadNumbers({});
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-extrabold text-[#02274c] bg-white focus:outline-none focus:ring-2 focus:ring-[#02274c]"
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
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                Oyun Planı
              </label>
              <select
                value={tacticPlan}
                onChange={(e) => setTacticPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-[#02274c] bg-white focus:outline-none focus:ring-2 focus:ring-[#02274c]"
              >
                {TACTIC_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                Taktik Notu (Opsiyonel)
              </label>
              <input
                type="text"
                value={tacticNote}
                onChange={(e) => setTacticNote(e.target.value)}
                placeholder="Örn: Duran toplarda ön direk koşusu..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#02274c]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold text-[#02274c]">
              <span className="px-3 py-1 rounded-full bg-slate-100">
                Sahadaki Oyuncu: <strong>{currentLineup.length}</strong>
              </span>
              {selectedCategory === "Çorum Süper Amatör Ligi-U19" && (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                  2006 Kontenjanı: Saha <strong>{quotaOutfieldCount}/2</strong> • Kaleci{" "}
                  <strong>{quotaGkCount}/1</strong>
                </span>
              )}
              {["Çorum Süper Amatör Ligi-U13", "Çorum Süper Amatör Ligi-U14", "Çorum Süper Amatör Ligi-U15"].includes(selectedCategory) && (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                  Son Çeyrek Kontenjanı: <strong>{quotaPlayersInLineup.length} / 2</strong>
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={copySquadText}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                {copiedBanner ? "✓ Kopyalandı!" : "📋 Kadroyu & Taktiği Kopyala"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlots({});
                  setSquadNumbers({});
                  setQuotaWarning("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-extrabold cursor-pointer transition"
              >
                Sahayı Temizle
              </button>
            </div>
          </div>
        </div>

        {quotaWarning && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-[#a60513] font-extrabold text-xs sm:text-sm">
            ⚠️ {quotaWarning}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Sol: Uygun Oyuncu Listesi */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-black text-[#02274c]">
                Uygun Oyuncular ({eligibleList.length})
              </h2>
              <span className="text-[11px] font-bold text-slate-400">Sürükle veya Tıkla</span>
            </div>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Oyuncu ismi ara..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />

            {loading ? (
              <p className="text-sm text-slate-500 py-4 text-center">Oyuncular yükleniyor...</p>
            ) : eligibleList.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Bu kategoriye veya aramaya uygun kayıtlı oyuncu yok.
              </p>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {eligibleList.map(({ player: p, info }) => {
                  const isUsed = assignedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onClick={() => quickAssignPlayer(p)}
                      onDragStart={() => {
                        setDraggingPlayer(p);
                        setDraggingFromSlot(null);
                      }}
                      className={`p-2.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-2.5 transition ${
                        isUsed
                          ? "border-emerald-500 bg-emerald-50/80"
                          : info.isQuota
                          ? "border-amber-300 bg-amber-50/40 hover:border-amber-500"
                          : "border-slate-200 bg-white hover:border-[#02274c] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#02274c] text-white overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              alt={p.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black">
                              {p.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-[#a60513]/10 text-[#a60513] font-black text-[11px] shrink-0">
                              #{p.jersey_number ?? "-"}
                            </span>
                            <strong className="text-[#02274c] text-xs sm:text-sm truncate">
                              {p.full_name}
                            </strong>
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {p.position} • {p.birth_date ? p.birth_date.slice(0, 4) : "-"}
                          </div>
                          {info.isQuota && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                              {info.reason}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
                          isUsed
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isUsed ? "Sahada ✓" : "+ Ekle"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sağ: Çim Saha Taktik Tahtası */}
          <div className="lg:col-span-8">
            <div
              className="relative rounded-3xl border-4 border-white shadow-xl p-4 sm:p-6 min-h-[600px] flex flex-col justify-between gap-3 overflow-hidden"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #15803d 0px, #15803d 48px, #166534 48px, #166534 96px)",
              }}
            >
              {/* Saha Çizgileri */}
              <div className="pointer-events-none absolute inset-4 border-2 border-white/30 rounded-2xl">
                <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/30" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 border-b-2 border-x-2 border-white/30 rounded-b-lg" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-16 border-t-2 border-x-2 border-white/30 rounded-t-lg" />
              </div>

              {currentFormation.rows.map((row, rowIdx) => (
                <div
                  key={`${row.role}-${rowIdx}`}
                  className="relative z-10 flex justify-center items-center flex-wrap sm:flex-nowrap gap-2.5 sm:gap-4"
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
                        className={`w-24 sm:w-28 rounded-2xl transition flex flex-col items-center p-2 text-center ${
                          occupant
                            ? occIsQuota
                              ? "bg-amber-600/95 border-2 border-white text-white shadow-lg cursor-grab active:cursor-grabbing"
                              : "bg-[#02274c]/95 border-2 border-white/80 text-white shadow-lg cursor-grab active:cursor-grabbing"
                            : "min-h-[88px] justify-center bg-black/20 border-2 border-dashed border-white/40 text-white/90 hover:bg-black/30"
                        }`}
                      >
                        {occupant ? (
                          <>
                            <div className="w-full flex items-center justify-between mb-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNumberFor(occupant);
                                  setTempNumberInput(effNum === "" ? "" : String(effNum));
                                }}
                                title="Forma numarasını değiştir"
                                className="px-2 py-0.5 rounded-full bg-[#a60513] hover:bg-red-600 text-white text-[11px] font-black shadow-xs cursor-pointer transition"
                              >
                                #{effNum === "" ? "-" : effNum}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromSlot(slotKey);
                                }}
                                className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-[10px] font-black text-white flex items-center justify-center cursor-pointer"
                                title="Sahadan Çıkar"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="w-10 h-10 rounded-full bg-white/15 border-2 border-white/60 overflow-hidden flex items-center justify-center mb-1 shadow-xs">
                              {occupant.photo_url ? (
                                <img
                                  src={occupant.photo_url}
                                  alt={occupant.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-black">
                                  {occupant.full_name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] font-extrabold leading-tight line-clamp-2">
                              {occupant.full_name}
                            </span>

                            {occIsQuota && (
                              <span className="mt-1 px-1.5 py-0.5 rounded bg-black/25 text-[9px] font-bold">
                                Kontenjan
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold mb-1">
                              +
                            </span>
                            <span className="text-[10px] font-extrabold leading-tight">{row.role}</span>
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

      {/* Temiz Forma Numarası Seçim Penceresi */}
      {editingNumberFor && (
        <div
          onClick={() => setEditingNumberFor(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-[#02274c]">{editingNumberFor.full_name}</h3>
                <p className="text-xs text-slate-500">Bu kadro için forma numarası seçin (1–99)</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNumberFor(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={tempNumberInput}
                onChange={(e) => setTempNumberInput(e.target.value.replace(/\D/g, ""))}
                placeholder="1 - 99"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-center text-lg font-black text-[#02274c] focus:outline-none focus:ring-2 focus:ring-[#02274c]"
              />
              <button
                type="button"
                onClick={() => {
                  const ok = handleSquadNumberChange(editingNumberFor.id, tempNumberInput);
                  if (ok) setEditingNumberFor(null);
                }}
                className="px-5 py-3 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white text-sm font-extrabold cursor-pointer"
              >
                Kaydet
              </button>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Hızlı Seçim:</p>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 17, 19, 20, 23, 99].map((num) => {
                  const taken = usedNumbersSet.has(num);
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        const ok = handleSquadNumberChange(editingNumberFor.id, String(num));
                        if (ok) setEditingNumberFor(null);
                      }}
                      className={`py-2 rounded-xl text-xs font-extrabold transition ${
                        taken
                          ? "bg-slate-100 text-slate-300 cursor-not-allowed line-through"
                          : "bg-slate-100 hover:bg-[#02274c] hover:text-white text-[#02274c] cursor-pointer"
                      }`}
                    >
                      #{num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}