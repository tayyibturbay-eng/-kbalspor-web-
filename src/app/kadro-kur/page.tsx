"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import { SquadShareBar } from "@/components/kadro/SquadShareBar";
import { Vitrin } from "@/components/ikbal/Motion";
import { EASE, SPRING } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import {
  checkPlayerEligibility,
  FORMATIONS,
  getCategoryQuotaLimit,
  MAX_SQUAD_PLAYERS,
  MIN_SQUAD_PLAYERS,
  SQUAD_CATEGORIES,
  SquadPlayer,
  TACTIC_PLANS,
} from "@/lib/squad-rules";

const supabase = createClient();

interface PlacedSlot {
  slotKey: string;
  role: string;
  player: SquadPlayer | null;
}

export default function SquadBuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    "Çorum Süper Amatör Ligi-U13"
  );
  const [formationKey, setFormationKey] = useState<string>("4-3-3");
  const [tacticPlan, setTacticPlan] = useState<string>(TACTIC_PLANS[0]);
  const azaltilmis = useReducedMotion();

  const [isPlayerLoggedIn, setIsPlayerLoggedIn] = useState<boolean>(false);
  const [clubPlayers, setClubPlayers] = useState<SquadPlayer[]>([]);
  const [customProfiles, setCustomProfiles] = useState<SquadPlayer[]>([
    {
      id: "custom-1",
      player_code: null,
      full_name: "Oyuncu 1",
      age_group: "Genel",
      birth_date: "2012-01-01",
      position: "Forvet",
      jersey_number: 9,
      photo_url: null,
    },
    {
      id: "custom-2",
      player_code: null,
      full_name: "Oyuncu 2",
      age_group: "Genel",
      birth_date: "2012-01-01",
      position: "Orta Saha",
      jersey_number: 8,
      photo_url: null,
    },
  ]);

  const [newProfileName, setNewProfileName] = useState<string>("");
  const [newProfilePosition, setNewProfilePosition] = useState<string>("Orta Saha");
  const [newProfileNumber, setNewProfileNumber] = useState<string>("");

  const [slots, setSlots] = useState<PlacedSlot[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<SquadPlayer[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string>("");

  const syncLoginAndPlayers = useCallback(async () => {
    const loggedId =
      typeof window !== "undefined"
        ? localStorage.getItem("ikbal_logged_player_id")
        : null;
    const hasLogin = Boolean(loggedId && loggedId.trim());
    setIsPlayerLoggedIn(hasLogin);

    if (!hasLogin) {
      setClubPlayers([]);
      return;
    }

    const { data } = await supabase
      .from("players")
      .select(
        "id, player_code, full_name, age_group, birth_date, position, jersey_number, photo_url"
      )
      .order("full_name", { ascending: true });
    setClubPlayers((data as SquadPlayer[] | null) || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncLoginAndPlayers();
    }, 0);

    const handleAuthChanged = () => {
      void syncLoginAndPlayers();
    };
    window.addEventListener("ikbal-auth-changed", handleAuthChanged);

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        void syncLoginAndPlayers();
      },
      "web-squad-builder-live"
    );

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("ikbal-auth-changed", handleAuthChanged);
      unsubscribe();
    };
  }, [syncLoginAndPlayers]);

  useEffect(() => {
    const def = FORMATIONS[formationKey] || FORMATIONS["4-3-3"];
    const nextSlots: PlacedSlot[] = [];
    def.rows.forEach((row, rIdx) => {
      for (let i = 0; i < row.count; i++) {
        nextSlots.push({
          slotKey: `${formationKey}-${rIdx}-${i}`,
          role: row.role,
          player: null,
        });
      }
    });
    const timer = window.setTimeout(() => {
      setSlots(nextSlots);
      setSelectedSlotKey(null);
      setWarningMsg("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [formationKey]);

  const availablePool = useMemo(() => {
    return isPlayerLoggedIn ? clubPlayers : customProfiles;
  }, [isPlayerLoggedIn, clubPlayers, customProfiles]);

  const totalAssignedCount = useMemo(() => {
    const onPitch = slots.filter((s) => Boolean(s.player)).length;
    return onPitch + benchPlayers.length;
  }, [slots, benchPlayers]);

  function handleCreateCustomProfile(e: React.FormEvent) {
    e.preventDefault();
    setWarningMsg("");
    const cleanName = newProfileName.trim();
    if (!cleanName) {
      setWarningMsg("Lütfen boş profil için bir isim girin.");
      return;
    }
    const parsedNo = newProfileNumber.trim()
      ? parseInt(newProfileNumber.trim(), 10)
      : null;

    const created: SquadPlayer = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      player_code: null,
      full_name: cleanName,
      age_group: "Özel Profil",
      birth_date: "2012-01-01",
      position: newProfilePosition,
      jersey_number:
        parsedNo && !isNaN(parsedNo) && parsedNo >= 1 && parsedNo <= 99
          ? parsedNo
          : null,
      photo_url: null,
    };

    setCustomProfiles((prev) => [...prev, created]);
    setNewProfileName("");
    setNewProfileNumber("");
  }

  function handleAssignToSlotOrBench(candidate: SquadPlayer) {
    setWarningMsg("");

    const alreadyInSquad =
      slots.some((s) => s.player?.id === candidate.id) ||
      benchPlayers.some((b) => b.id === candidate.id);

    if (alreadyInSquad) {
      setWarningMsg(`${candidate.full_name} zaten kadroda yer alıyor.`);
      return;
    }

    if (totalAssignedCount >= MAX_SQUAD_PLAYERS) {
      setWarningMsg(`Kadro en fazla ${MAX_SQUAD_PLAYERS} oyuncu içerebilir.`);
      return;
    }

    if (isPlayerLoggedIn) {
      const eligibility = checkPlayerEligibility(candidate, selectedCategory);
      if (!eligibility.eligible) {
        setWarningMsg(
          eligibility.reason ||
            `${candidate.full_name} bu kategori için uygun değil.`
        );
        return;
      }

      const quotaLimit = getCategoryQuotaLimit(selectedCategory);
      if (eligibility.isQuota && quotaLimit !== null) {
        const currentQuotaCount = [
          ...slots.map((s) => s.player).filter(Boolean),
          ...benchPlayers,
        ]
          .filter((p): p is SquadPlayer => Boolean(p))
          .filter((p) => p.id !== candidate.id)
          .filter((p) => checkPlayerEligibility(p, selectedCategory).isQuota)
          .length;

        if (currentQuotaCount >= quotaLimit) {
          setWarningMsg(
            `Bu kategori için kontenjan sınırı (${quotaLimit} oyuncu) doldu.`
          );
          return;
        }
      }
    }

    if (selectedSlotKey) {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.slotKey === selectedSlotKey ? { ...slot, player: candidate } : slot
        )
      );
      setSelectedSlotKey(null);
      return;
    }

    const emptySlot = slots.find((s) => !s.player);
    if (emptySlot) {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.slotKey === emptySlot.slotKey ? { ...slot, player: candidate } : slot
        )
      );
      return;
    }

    if (!alreadyInSquad) {
      setBenchPlayers((prev) => [...prev, candidate]);
    }
  }

  function handleRemoveFromSlot(slotKey: string) {
    setSlots((prev) =>
      prev.map((s) => (s.slotKey === slotKey ? { ...s, player: null } : s))
    );
  }

  function handleRemoveFromBench(playerId: string) {
    setBenchPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }

  const activeFormation = FORMATIONS[formationKey] || FORMATIONS["4-3-3"];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors tabular-nums">
      <Navbar />

      <section className="k-sahne text-white py-8 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Çorum İkbal Spor Kulübü • Taktik &amp; Kadro Planlama
            </span>
            <h1 className="k-posta k-posta--wonk text-2xl sm:text-4xl text-white">
              Kadro Kur &amp; Taktik Tahtası
            </h1>
          </div>

          <div className="px-5 py-3 rounded-2xl k-cam--marka text-right">
            <div className="text-[10px] uppercase text-amber-200 font-extrabold tracking-widest">
              Kadro Sayısı
            </div>
            <div className="text-lg font-black mt-0.5">
              {totalAssignedCount} / {MAX_SQUAD_PLAYERS}{" "}
              <span className="text-xs font-semibold text-slate-200">
                (Min: {MIN_SQUAD_PLAYERS})
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-7 space-y-6">
        <Vitrin>
          <div className="k-artik p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="k-koz text-[10px] block mb-1.5">
                Kategori / Statü
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="k-alan font-bold text-xs sm:text-sm"
              >
                {SQUAD_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="k-koz text-[10px] block mb-1.5">
                Diziliş (Formasyon)
              </label>
              <select
                value={formationKey}
                onChange={(e) => setFormationKey(e.target.value)}
                className="k-alan font-bold text-xs sm:text-sm"
              >
                {Object.entries(FORMATIONS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="k-koz text-[10px] block mb-1.5">
                Oyun Planı
              </label>
              <select
                value={tacticPlan}
                onChange={(e) => setTacticPlan(e.target.value)}
                className="k-alan font-bold text-xs sm:text-sm"
              >
                {TACTIC_PLANS.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Vitrin>

        <SquadShareBar
          categoryLabel={SQUAD_CATEGORIES.find((c) => c.key === selectedCategory)?.label || selectedCategory}
          formationLabel={activeFormation.label}
          formationRows={activeFormation.rows}
          tacticPlan={tacticPlan}
          slots={slots}
          benchPlayers={benchPlayers}
        />

        <AnimatePresence>
          {warningMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE.yumusak }}
              className="p-3.5 rounded-2xl bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] text-xs font-extrabold border border-amber-400/50"
            >
              {warningMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Taktik Saha */}
          <section className="lg:col-span-7 relative rounded-3xl bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-950 text-white p-5 sm:p-6 border-2 border-emerald-400/50 shadow-lg space-y-5 overflow-hidden">
            {/* Saha orta çizgisi ve dairesi */}
            <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-white/20" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-white/20" />

            <div className="relative z-10 flex items-center justify-between text-xs font-extrabold">
              <span className="px-3 py-1 rounded-full bg-black/25 backdrop-blur-xs">
                Diziliş: {activeFormation.label}
              </span>
              <span className="px-3 py-1 rounded-full bg-black/25 backdrop-blur-xs">
                {tacticPlan}
              </span>
            </div>

            <div className="relative z-10 space-y-4 py-3">
              {activeFormation.rows.map((row, rIdx) => {
                const rowSlots = slots.filter((s) =>
                  s.slotKey.startsWith(`${formationKey}-${rIdx}-`)
                );
                return (
                  <div
                    key={`${formationKey}-${rIdx}`}
                    className="flex flex-wrap items-center justify-center gap-3"
                  >
                    {rowSlots.map((slot) => {
                      const isPicked = selectedSlotKey === slot.slotKey;
                      return (
                        <motion.div
                          layout
                          whileHover={azaltilmis ? undefined : { y: -3, scale: 1.03 }}
                          whileTap={azaltilmis ? undefined : { scale: 0.96 }}
                          transition={SPRING.keskin}
                          key={slot.slotKey}
                          onClick={() =>
                            setSelectedSlotKey((prev) =>
                              prev === slot.slotKey ? null : slot.slotKey
                            )
                          }
                          className={`min-w-[114px] rounded-2xl px-3.5 py-2.5 text-center border cursor-pointer transition-colors ${
                            isPicked
                              ? "bg-amber-400 text-slate-950 border-white shadow-lg"
                              : slot.player
                              ? "bg-[var(--brand-navy)]/95 text-white border-white/45 shadow-md"
                              : "bg-black/25 text-emerald-100 border-dashed border-white/40 hover:bg-black/35"
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase tracking-wider opacity-85">
                            {slot.role}
                          </div>
                          <div className="text-xs font-extrabold truncate mt-0.5">
                            {slot.player ? slot.player.full_name : "Boş Slot"}
                          </div>
                          {slot.player && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromSlot(slot.slotKey);
                              }}
                              className="mt-1 text-[10px] font-black underline text-rose-200 cursor-pointer"
                            >
                              Kaldır
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {benchPlayers.length > 0 && (
              <div className="relative z-10 pt-3 border-t border-white/20 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-100">
                  Yedek Kulübesi ({benchPlayers.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {benchPlayers.map((bp) => (
                    <span
                      key={bp.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/30 text-xs font-bold"
                    >
                      {bp.full_name}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromBench(bp.id)}
                        className="text-rose-200 font-black cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Oyuncu Havuzu */}
          <aside className="lg:col-span-5 k-artik p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <span className="k-koz text-[10px] text-[var(--brand-red)] block">
                {isPlayerLoggedIn
                  ? "Sporcu Girişi Aktif"
                  : "Misafir Modu • Boş Profiller"}
              </span>
              <h2 className="k-posta text-xl text-[var(--text-primary)]">
                {isPlayerLoggedIn
                  ? "Kulüp Sporcularımız"
                  : "Özel / Boş Profil Oluştur & Yerleştir"}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {isPlayerLoggedIn
                  ? "Sporcu girişi yapıldığı için kayıtlı sporcular listeleniyor. Bir slot seçip oyuncuya tıklayın."
                  : "Sporcu girişi yapılmadığı için kayıtlı sporcular gizlidir. İsim vererek boş profiller oluşturup kadroya yerleştirebilirsiniz."}
              </p>
            </div>

            {!isPlayerLoggedIn && (
              <form
                onSubmit={handleCreateCustomProfile}
                className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Oyuncu adı..."
                    className="sm:col-span-2 k-alan text-xs font-bold"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={newProfileNumber}
                    onChange={(e) => setNewProfileNumber(e.target.value)}
                    placeholder="No"
                    className="k-alan text-xs font-bold"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newProfilePosition}
                    onChange={(e) => setNewProfilePosition(e.target.value)}
                    className="flex-1 k-alan text-xs font-bold"
                  >
                    <option value="Kaleci">Kaleci</option>
                    <option value="Defans">Defans</option>
                    <option value="Orta Saha">Orta Saha</option>
                    <option value="Forvet">Forvet</option>
                  </select>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="k-buton k-buton--lacivert shrink-0"
                  >
                    + Profil Ekle
                  </motion.button>
                </div>
              </form>
            )}

            <div className="divide-y divide-[var(--border-subtle)] max-h-[420px] overflow-y-auto">
              {availablePool.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-[var(--text-primary)] truncate">
                      {item.full_name}
                      {item.jersey_number ? ` #${item.jersey_number}` : ""}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {item.position || "Oyuncu"}
                      {isPlayerLoggedIn && item.age_group
                        ? ` • ${item.age_group}`
                        : ""}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => handleAssignToSlotOrBench(item)}
                    className="k-buton k-buton--kirmizi shrink-0 !py-1.5 !px-3"
                  >
                    {selectedSlotKey ? "Slota Koy" : "Kadroya Al"}
                  </motion.button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}