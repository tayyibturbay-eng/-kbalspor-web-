"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import {
  FORMATIONS,
  SQUAD_CATEGORIES,
  SquadPlayer,
  TACTIC_PLANS,
  checkPlayerEligibility,
} from "@/lib/squad-rules";
import { PitchBoard } from "@/components/kadro/PitchBoard";

const supabase = createClient();

export default function SquadBuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState(
    "Çorum Süper Amatör Ligi-U19"
  );
  const [formation, setFormation] = useState("4-3-3");
  const [tacticPlan, setTacticPlan] = useState<string>(TACTIC_PLANS[0]);
  const [tacticNote, setTacticNote] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [allPlayers, setAllPlayers] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Record<string, SquadPlayer | null>>({});
  const [squadNumbers, setSquadNumbers] = useState<Record<string, number | "">>({});
  const [draggingPlayer, setDraggingPlayer] = useState<SquadPlayer | null>(null);
  const [draggingFromSlot, setDraggingFromSlot] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState("");
  const [copiedBanner, setCopiedBanner] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("players")
        .select(
          "id, player_code, full_name, age_group, birth_date, position, jersey_number, photo_url"
        )
        .order("jersey_number", { ascending: true });
      setAllPlayers((data as SquadPlayer[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`ikbal_squad_${selectedCategory}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.formation && FORMATIONS[parsed.formation]) {
          setFormation(parsed.formation);
        }
        setSlots(parsed.slots || {});
        setSquadNumbers(parsed.squadNumbers || {});
        setTacticPlan(parsed.tacticPlan || TACTIC_PLANS[0]);
        setTacticNote(parsed.tacticNote || "");
      }
    } catch {
      // bozuk taslak varsa yoksay
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      `ikbal_squad_${selectedCategory}`,
      JSON.stringify({
        formation,
        slots,
        squadNumbers,
        tacticPlan,
        tacticNote,
      })
    );
  }, [selectedCategory, formation, slots, squadNumbers, tacticPlan, tacticNote]);

  const handleCategoryChange = (cat: string) => {
    setSlots({});
    setSquadNumbers({});
    setQuotaWarning("");
    setSelectedCategory(cat);
  };

  const eligibleList = allPlayers
    .map((p) => ({
      player: p,
      info: checkPlayerEligibility(p, selectedCategory),
    }))
    .filter(
      (x) =>
        x.info.eligible &&
        x.player.full_name.toLowerCase().includes(playerSearch.toLowerCase())
    );

  const currentLineup = Object.values(slots).filter(Boolean) as SquadPlayer[];
  const quotaPlayersInLineup = currentLineup.filter(
    (p) => checkPlayerEligibility(p, selectedCategory).isQuota
  );
  const quotaGkCount = quotaPlayersInLineup.filter(
    (p) => p.position === "Kaleci"
  ).length;
  const quotaOutfieldCount = quotaPlayersInLineup.filter(
    (p) => p.position !== "Kaleci"
  ).length;

  const getEffectiveNumber = (player: SquadPlayer): number | "" => {
    if (Object.prototype.hasOwnProperty.call(squadNumbers, player.id)) {
      return squadNumbers[player.id];
    }
    return player.jersey_number ?? "";
  };

  const handleSquadNumberChange = (
    playerId: string,
    rawVal: string
  ): boolean => {
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

  const assignToSlot = (
    targetSlotKey: string,
    player: SquadPlayer,
    fromSlotKey: string | null
  ) => {
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
      setQuotaWarning(
        `${player.full_name} bu kategorinin yaş kurallarına uygun değil.`
      );
      return;
    }

    const alreadyOnPitch = currentLineup.some((p) => p.id === player.id);

    if (info.isQuota && !alreadyOnPitch) {
      if (
        [
          "Çorum Süper Amatör Ligi-U13",
          "Çorum Süper Amatör Ligi-U14",
          "Çorum Süper Amatör Ligi-U15",
        ].includes(selectedCategory)
      ) {
        if (quotaPlayersInLineup.length >= 2) {
          setQuotaWarning(
            `${selectedCategory} kategorisinde en fazla 2 kontenjan futbolcu sahada yer alabilir!`
          );
          return;
        }
      }
      if (selectedCategory === "Çorum Süper Amatör Ligi-U19") {
        if (quotaPlayersInLineup.length >= 3) {
          setQuotaWarning(
            "U19 kategorisinde toplam en fazla 3 (2 saha + 1 kaleci) 2006 kontenjanı yer alabilir!"
          );
          return;
        }
        if (player.position === "Kaleci" && quotaGkCount >= 1) {
          setQuotaWarning(
            "U19 kategorisinde 2006 doğumlu en fazla 1 kaleci kontenjanı yazılabilir!"
          );
          return;
        }
        if (player.position !== "Kaleci" && quotaOutfieldCount >= 2) {
          setQuotaWarning(
            "U19 kategorisinde 2006 doğumlu en fazla 2 saha oyuncusu kontenjanı yazılabilir!"
          );
          return;
        }
      }
    }

    if (!alreadyOnPitch && player.jersey_number !== null) {
      const numConflict = currentLineup.find(
        (p) =>
          p.id !== player.id && getEffectiveNumber(p) === player.jersey_number
      );
      if (numConflict) {
        setSquadNumbers((prev) => ({ ...prev, [player.id]: "" }));
        setQuotaWarning(
          `#${player.jersey_number} numarası bu kadroda ${numConflict.full_name} tarafından kullanıldığı için ${player.full_name} için kart üzerindeki numaraya tıklayıp yeni numara seçin.`
        );
      } else {
        setSquadNumbers((prev) => ({
          ...prev,
          [player.id]: player.jersey_number as number,
        }));
      }
    }

    setSlots((prev) => {
      const cleaned: Record<string, SquadPlayer | null> = {};
      for (const [k, v] of Object.entries(prev)) {
        cleaned[k] = v?.id === player.id ? null : v;
      }
      cleaned[targetSlotKey] = player;
      return cleaned;
    });
  };

  const quickAssignPlayer = (player: SquadPlayer) => {
    const isUsed = currentLineup.some((p) => p.id === player.id);
    if (isUsed) {
      const foundKey = Object.keys(slots).find(
        (k) => slots[k]?.id === player.id
      );
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

    const posPrefix = (player.position || "").toLowerCase().split(" ")[0];
    const preferredEmpty =
      allSlotKeys.find(
        (s) =>
          !slots[s.key] && posPrefix && s.role.toLowerCase().includes(posPrefix)
      ) || allSlotKeys.find((s) => !slots[s.key]);

    if (!preferredEmpty) {
      setQuotaWarning(
        "Sahadaki tüm pozisyonlar dolu. Önce bir oyuncuyu çıkarın veya üzerine sürükleyin."
      );
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

  const buildSquadSummaryText = () => {
    const catLabel =
      SQUAD_CATEGORIES.find((c) => c.key === selectedCategory)?.label ||
      selectedCategory;
    const lines = currentLineup.map((p) => {
      const num = getEffectiveNumber(p);
      return `#${num === "" ? "-" : num} ${p.full_name} (${p.position || "-"})`;
    });
    return (
      `⚽ İkbalspor ${catLabel} (${FORMATIONS[formation].label}) Kadrosu\n` +
      `📋 Oyun Planı: ${tacticPlan}` +
      (tacticNote.trim() ? `\n📝 Not: ${tacticNote.trim()}` : "") +
      `\n\n` +
      lines.join("\n")
    );
  };

  const copySquadText = () => {
    navigator.clipboard.writeText(buildSquadSummaryText());
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2500);
  };

  const assignedIds = new Set(currentLineup.map((p) => p.id));
  const usedNumbersSet = new Set(
    currentLineup
      .map((p) => getEffectiveNumber(p))
      .filter((n) => n !== "")
  );

  const activeCategoryLabel =
    SQUAD_CATEGORIES.find((c) => c.key === selectedCategory)?.label ||
    selectedCategory;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] via-[#04376b] to-[#a60513] text-white py-6 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Taktik Tahtası & Kadro Kur
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
            Yaş grubunu seçin, oyuncuları sahaya sürükleyin veya listeye
            tıklayarak hızlıca dizin.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-5">
        {/* Kategori / Yaş Grubu & Taktik Kontrol Paneli */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Kategori / Yaş Grubu Seçimi
              </span>
              <span className="text-xs font-extrabold text-[#a60513]">
                Aktif: {activeCategoryLabel}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {SQUAD_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryChange(cat.key)}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs border transition cursor-pointer text-center ${
                      active
                        ? "bg-[#02274c] text-white border-[#02274c] shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-[#02274c]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
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
                  2006 Kontenjanı: Saha <strong>{quotaOutfieldCount}/2</strong> •
                  Kaleci <strong>{quotaGkCount}/1</strong>
                </span>
              )}
              {[
                "Çorum Süper Amatör Ligi-U13",
                "Çorum Süper Amatör Ligi-U14",
                "Çorum Süper Amatör Ligi-U15",
              ].includes(selectedCategory) && (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                  Son Çeyrek Kontenjanı:{" "}
                  <strong>{quotaPlayersInLineup.length} / 2</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copySquadText}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                {copiedBanner ? "✓ Kopyalandı!" : "📋 Kadroyu & Taktiği Kopyala"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  buildSquadSummaryText()
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white text-xs font-extrabold transition shadow-xs"
              >
                📲 WhatsApp&apos;ta Paylaş
              </a>
              <button
                type="button"
                onClick={() => {
                  setSlots({});
                  setSquadNumbers({});
                  setQuotaWarning("");
                  localStorage.removeItem(`ikbal_squad_${selectedCategory}`);
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
              <span className="text-[11px] font-bold text-slate-400">
                Sürükle veya Tıkla
              </span>
            </div>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Oyuncu ismi ara..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />

            {loading ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Oyuncular yükleniyor...
              </p>
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
                            {p.position} •{" "}
                            {p.birth_date ? p.birth_date.slice(0, 4) : "-"}
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
            <PitchBoard
              selectedCategory={selectedCategory}
              formation={formation}
              slots={slots}
              draggingPlayer={draggingPlayer}
              setDraggingPlayer={setDraggingPlayer}
              draggingFromSlot={draggingFromSlot}
              setDraggingFromSlot={setDraggingFromSlot}
              onAssignToSlot={assignToSlot}
              onRemoveFromSlot={removeFromSlot}
              getEffectiveNumber={getEffectiveNumber}
              onNumberChange={handleSquadNumberChange}
              usedNumbersSet={usedNumbersSet}
            />
          </div>
        </div>
      </main>
    </div>
  );
}