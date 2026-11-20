"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  full_name: string;
  age_group: string;
  birth_date: string | null;
  position: "Kaleci" | "Defans" | "Orta Saha" | "Forvet";
  jersey_number: number | null;
}

const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19"];

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

function getAgeNum(ageGroup: string) {
  return Number(ageGroup.replace("U", "")) || 19;
}

export default function SquadBuilderPage() {
  const [selectedAge, setSelectedAge] = useState("U11");
  const [formation, setFormation] = useState<string>("4-3-3");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Record<string, Player | null>>({});
  const [draggingPlayer, setDraggingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("id, full_name, age_group, birth_date, position, jersey_number")
        .order("jersey_number", { ascending: true });

      const targetAge = getAgeNum(selectedAge);
      // Kendi yaş grubu ve bir alt yaş gruplarındaki oyuncular oynayabilir
      const eligible = ((data as Player[]) || []).filter(
        (p) => getAgeNum(p.age_group) <= targetAge
      );
      setPlayers(eligible);
      setLoading(false);
    };
    fetchPlayers();
  }, [selectedAge]);

  const handleFormationChange = (next: string) => {
    setFormation(next);
    setSlots({});
  };

  const assignToSlot = (slotKey: string, player: Player) => {
    setSlots((prev) => {
      const cleaned: Record<string, Player | null> = {};
      for (const [k, v] of Object.entries(prev)) {
        cleaned[k] = v?.id === player.id ? null : v;
      }
      cleaned[slotKey] = player;
      return cleaned;
    });
  };

  const clearSlot = (slotKey: string) => {
    setSlots((prev) => ({ ...prev, [slotKey]: null }));
  };

  const assignedIds = new Set(
    Object.values(slots)
      .filter(Boolean)
      .map((p) => p!.id)
  );

  const currentFormation = FORMATIONS[formation];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <h1 className="text-3xl font-black">Taktik & Sürükle-Bırak Kadro Kur</h1>
          <p className="text-slate-100">
            Yaş kategorini ve taktiğini seç, gerçek oyuncuları sahadaki
            kutucuklara sürükleyip bırak!
          </p>

          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setSelectedAge(age)}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-sm transition ${
                  selectedAge === age ? "bg-white text-[#02274c]" : "bg-white/15 text-white"
                }`}
              >
                {age}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(FORMATIONS).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleFormationChange(key)}
                className={`px-4 py-2 rounded-xl font-extrabold text-sm border-2 transition ${
                  formation === key
                    ? "bg-[#a60513] border-white text-white"
                    : "bg-white/10 border-white/25 text-white hover:bg-white/20"
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 pt-8 grid lg:grid-cols-12 gap-8">
        {/* Sol: Sürüklenebilir Gerçek Oyuncu Havuzu */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#02274c]">
              {selectedAge} Uygun Oyuncular ({players.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Oyuncuyu tutup sağdaki saha pozisyonuna sürükleyin.
          </p>

          {loading ? (
            <p className="text-sm text-slate-500">Yükleniyor...</p>
          ) : players.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bu kategoriye uygun kayıtlı oyuncu yok.
            </p>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {players.map((p) => {
                const isUsed = assignedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggingPlayer(p)}
                    className={`p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing flex items-center justify-between transition ${
                      isUsed
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-[#02274c]"
                    }`}
                  >
                    <div>
                      <span className="font-black text-[#a60513] mr-2">
                        #{p.jersey_number ?? "-"}
                      </span>
                      <strong className="text-[#02274c] text-sm">{p.full_name}</strong>
                      <div className="text-[11px] text-slate-500 font-bold">
                        {p.age_group} • {p.position}
                      </div>
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

        {/* Sağ: Taktik Saha (Drop Hedefleri) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#02274c]">
              Taktik Tahtası: {formation} ({assignedIds.size}/11)
            </h2>
            <button
              type="button"
              onClick={() => setSlots({})}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold hover:bg-slate-100"
            >
              Sahayı Temizle
            </button>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-700 border-4 border-white shadow-xl p-6 min-h-[520px] flex flex-col justify-between gap-5">
            {currentFormation.rows.map((row, rowIdx) => (
              <div key={`${row.role}-${rowIdx}`} className="flex justify-center flex-wrap gap-3">
                {Array.from({ length: row.count }).map((_, colIdx) => {
                  const slotKey = `${rowIdx}-${colIdx}`;
                  const occupant = slots[slotKey];
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
                      onClick={() => occupant && clearSlot(slotKey)}
                      className={`w-28 min-h-[82px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 text-center transition ${
                        occupant
                          ? "bg-[#02274c] border-[#a60513] border-solid text-white shadow-lg cursor-pointer"
                          : "bg-white/10 border-white/40 text-white/80 hover:bg-white/20"
                      }`}
                    >
                      {occupant ? (
                        <>
                          <span className="text-xs font-black text-red-300">
                            #{occupant.jersey_number ?? "-"}
                          </span>
                          <span className="text-xs font-extrabold leading-tight mt-0.5">
                            {occupant.full_name}
                          </span>
                          <span className="text-[10px] text-slate-300 mt-1">
                            Çıkar ✕
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
      </main>
    </div>
  );
}