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

const FORMATIONS: Record<string, { label: string; rows: { role: string; count: number }[] }> = {
  "4-3-3": {
    label: "4-3-3 (Hücum)",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-4-2": {
    label: "4-4-2 (Dengeli)",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1 (Modern)",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 5 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-5-2": {
    label: "3-5-2 (Kanat)",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 5 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
};

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
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Record<string, Player | null>>({});
  const [draggingPlayer, setDraggingPlayer] = useState<Player | null>(null);
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
    setQuotaWarning("");
  };

  const eligibleList = allPlayers
    .map((p) => ({ player: p, info: checkPlayerEligibility(p, selectedCategory) }))
    .filter((x) => x.info.eligible);

  const currentLineup = Object.values(slots).filter(Boolean) as Player[];
  const quotaPlayersInLineup = currentLineup.filter(
    (p) => checkPlayerEligibility(p, selectedCategory).isQuota
  );
  const quotaGkCount = quotaPlayersInLineup.filter((p) => p.position === "Kaleci").length;
  const quotaOutfieldCount = quotaPlayersInLineup.filter((p) => p.position !== "Kaleci").length;

  const assignToSlot = (slotKey: string, player: Player) => {
    setQuotaWarning("");
    const info = checkPlayerEligibility(player, selectedCategory);
    if (!info.eligible) {
      setQuotaWarning(`${player.full_name} bu kategorinin yaş kurallarına uygun değil.`);
      return;
    }

    // Zaten sahada başka bir slottaysa taşınabilir, yeni kontenjan sayılmaz
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

    setSlots((prev) => {
      const cleaned: Record<string, Player | null> = {};
      for (const [k, v] of Object.entries(prev)) {
        cleaned[k] = v?.id === player.id ? null : v;
      }
      cleaned[slotKey] = player;
      return cleaned;
    });
  };

  const copySquadText = () => {
    const lines = currentLineup.map(
      (p) => `#${p.jersey_number ?? "-"} ${p.full_name} (${p.position})`
    );
    const text = `İkbalspor ${selectedCategory} (${formation}) Kadrosu:\n` + lines.join("\n");
    navigator.clipboard.writeText(text);
    alert("Maç kadrosu kopyalandı!");
  };

  const assignedIds = new Set(currentLineup.map((p) => p.id));
  const currentFormation = FORMATIONS[formation];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <h1 className="text-3xl font-black">PGL Ligi & Taktik Kadro Oluşturma</h1>
          <p className="text-slate-100">
            Resmi yaş uygunluğu ve kontenjan kurallarına göre PGL maç kadronu
            sürükle-bırak ile kur.
          </p>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategoryChange(cat.key)}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-sm transition ${
                  selectedCategory === cat.key
                    ? "bg-white text-[#02274c]"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(FORMATIONS).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFormation(key);
                  setSlots({});
                }}
                className={`px-4 py-2 rounded-xl font-extrabold text-sm border-2 transition ${
                  formation === key
                    ? "bg-[#a60513] border-white text-white"
                    : "bg-white/10 border-white/25 text-white"
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        {/* Kontenjan Durum Çubuğu */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="text-sm font-bold text-[#02274c]">
            {selectedCategory === "PGL-U19" ? (
              <span>
                2006 Kontenjanı: Saha <strong>{quotaOutfieldCount}/2</strong> • Kaleci{" "}
                <strong>{quotaGkCount}/1</strong> (Toplam {quotaPlayersInLineup.length}/3)
              </span>
            ) : ["PGL-U13", "PGL-U14", "PGL-U15"].includes(selectedCategory) ? (
              <span>
                Son Çeyrek Kontenjan Kullanımı:{" "}
                <strong>{quotaPlayersInLineup.length} / 2</strong>
              </span>
            ) : (
              <span>Seçili Kategori: {selectedCategory}</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={copySquadText}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
            >
              Kadroyu Kopyala
            </button>
            <button
              type="button"
              onClick={() => {
                setSlots({});
                setQuotaWarning("");
              }}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-extrabold"
            >
              Sahayı Temizle
            </button>
          </div>
        </div>

        {quotaWarning && (
          <div className="p-4 rounded-xl bg-red-50 border-2 border-[#a60513] text-[#a60513] font-extrabold text-sm">
            {quotaWarning}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Sol: Uygun Oyuncu Havuzu */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-extrabold text-[#02274c]">
              Uygun Oyuncular ({eligibleList.length})
            </h2>
            {loading ? (
              <p className="text-sm text-slate-500">Yükleniyor...</p>
            ) : eligibleList.length === 0 ? (
              <p className="text-sm text-slate-500">
                Bu kategorinin doğum tarihi kurallarına uygun kayıtlı oyuncu yok.
              </p>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {eligibleList.map(({ player: p, info }) => {
                  const isUsed = assignedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDraggingPlayer(p)}
                      className={`p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing flex items-center justify-between transition ${
                        isUsed
                          ? "border-emerald-500 bg-emerald-50"
                          : info.isQuota
                          ? "border-amber-400 bg-amber-50/40"
                          : "border-slate-200 bg-white hover:border-[#02274c]"
                      }`}
                    >
                      <div>
                        <span className="font-black text-[#a60513] mr-2">
                          #{p.jersey_number ?? "-"}
                        </span>
                        <strong className="text-[#02274c] text-sm">{p.full_name}</strong>
                        <div className="text-[11px] text-slate-500 font-bold">
                          {p.position} • {p.birth_date || "-"}
                        </div>
                        {info.isQuota && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                            {info.reason}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-slate-400">
                        {isUsed ? "Sahada ✓" : "Sürükle ⠿"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sağ: Taktik Tahtası */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-700 border-4 border-white shadow-xl p-6 min-h-[520px] flex flex-col justify-between gap-5">
              {currentFormation.rows.map((row, rowIdx) => (
                <div key={`${row.role}-${rowIdx}`} className="flex justify-center flex-wrap gap-3">
                  {Array.from({ length: row.count }).map((_, colIdx) => {
                    const slotKey = `${rowIdx}-${colIdx}`;
                    const occupant = slots[slotKey];
                    const occIsQuota =
                      occupant && checkPlayerEligibility(occupant, selectedCategory).isQuota;
                    return (
                      <div
                        key={slotKey}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggingPlayer) {
                            assignToSlot(slotKey, draggingPlayer);
                            setDraggingPlayer(null);
                          }
                        }}
                        onClick={() => occupant && setSlots((prev) => ({ ...prev, [slotKey]: null }))}
                        className={`w-28 min-h-[82px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 text-center transition ${
                          occupant
                            ? occIsQuota
                              ? "bg-amber-600 border-white border-solid text-white shadow-lg cursor-pointer"
                              : "bg-[#02274c] border-[#a60513] border-solid text-white shadow-lg cursor-pointer"
                            : "bg-white/10 border-white/40 text-white/80 hover:bg-white/20"
                        }`}
                      >
                        {occupant ? (
                          <>
                            <span className="text-xs font-black text-red-200">
                              #{occupant.jersey_number ?? "-"}
                            </span>
                            <span className="text-xs font-extrabold leading-tight mt-0.5">
                              {occupant.full_name}
                            </span>
                            <span className="text-[10px] opacity-80 mt-1">
                              {occIsQuota ? "Kontenjan • " : ""}Çıkar ✕
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] font-extrabold">{row.role}</span>
                            <span className="text-[10px] opacity-75">Buraya Bırak</span>
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