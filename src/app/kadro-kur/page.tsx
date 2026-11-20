"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  full_name: string;
  age_group: string;
  position: "Kaleci" | "Defans" | "Orta Saha" | "Forvet";
  jersey_number: number | null;
}

const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19"];
const POSITIONS: Player["position"][] = ["Kaleci", "Defans", "Orta Saha", "Forvet"];

export default function SquadBuilderPage() {
  const [selectedAge, setSelectedAge] = useState("U11");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLineup, setMyLineup] = useState<Player[]>([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("id, full_name, age_group, position, jersey_number")
        .eq("age_group", selectedAge)
        .order("jersey_number", { ascending: true });
      setPlayers((data as Player[]) || []);
      setLoading(false);
    };
    fetchPlayers();
  }, [selectedAge]);

  const togglePlayer = (player: Player) => {
    const exists = myLineup.some((p) => p.id === player.id);
    if (exists) {
      setMyLineup((prev) => prev.filter((p) => p.id !== player.id));
      return;
    }
    if (myLineup.length >= 11) return;
    setMyLineup((prev) => [...prev, player]);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-3">
          <h1 className="text-3xl font-black">Kendi Kadronu Kur (U11 – U19)</h1>
          <p className="text-slate-100">
            Yaş kategorini seç, İkbalspor&apos;un gerçek oyuncularını sahaya sür
            ve kendi ilk 11&apos;ini oluştur!
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {AGE_GROUPS.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setSelectedAge(age)}
                className={`px-4 py-2 rounded-xl font-extrabold text-sm transition ${
                  selectedAge === age
                    ? "bg-white text-[#02274c] shadow"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 pt-8 grid lg:grid-cols-12 gap-8">
        {/* Sol: Gerçek Oyuncu Havuzu */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#02274c]">
              {selectedAge} Gerçek Oyuncu Listesi
            </h2>
            <span className="text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
              {players.length} Oyuncu
            </span>
          </div>

          {loading ? (
            <p className="text-slate-500 text-sm">Oyuncular yükleniyor...</p>
          ) : players.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {selectedAge} kategorisinde henüz kayıtlı oyuncu yok. Yönetim
              panelinden oyuncu ekleyebilirsiniz.
            </p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {players.map((p) => {
                const picked = myLineup.some((m) => m.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 flex items-center justify-between transition ${
                      picked
                        ? "border-[#a60513] bg-red-50"
                        : "border-slate-200 hover:border-[#02274c]"
                    }`}
                  >
                    <div>
                      <span className="inline-block w-8 font-black text-[#a60513]">
                        #{p.jersey_number ?? "-"}
                      </span>
                      <strong className="text-[#02274c]">{p.full_name}</strong>
                      <span className="ml-2 text-xs font-bold text-slate-500">
                        ({p.position})
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-[#02274c]">
                      {picked ? "Kadrodan Çıkar" : "+ Sahaya Al"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sağ: Yeşil Saha Dizilişi */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#02274c]">
              Benim Kadrom ({myLineup.length} / 11)
            </h2>
            <button
              type="button"
              onClick={() => setMyLineup([])}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Kadroyu Sıfırla
            </button>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-emerald-700 to-emerald-800 border-4 border-white shadow-xl p-6 min-h-[460px] flex flex-col justify-between gap-4">
            {POSITIONS.map((pos) => {
              const posPlayers = myLineup.filter((p) => p.position === pos);
              return (
                <div
                  key={pos}
                  className="rounded-2xl bg-white/10 border border-white/20 p-3 space-y-2"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-100">
                    {pos}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {posPlayers.length === 0 ? (
                      <span className="text-xs text-white/60">
                        Soldan {pos.toLowerCase()} oyuncusu seç...
                      </span>
                    ) : (
                      posPlayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlayer(p)}
                          className="px-3 py-1.5 rounded-xl bg-[#02274c] border-2 border-[#a60513] text-white text-xs font-extrabold shadow"
                        >
                          #{p.jersey_number ?? "-"} {p.full_name} ✕
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}