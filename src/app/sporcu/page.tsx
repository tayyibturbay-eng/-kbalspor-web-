"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import { Iskelet, Metrik, Sira, SiraOgesi, Vitrin } from "@/components/ikbal/Motion";
import { EASE, SPRING, sekmeGecis } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import {
  Due,
  EquipmentLog,
  JerseySetMini,
  Player,
  PrayerAttendance,
  PrayerSession,
  StockItemMini,
  TaskAssignment,
  Training,
} from "@/types/club";
import { PlayerLogin } from "@/components/sporcu/PlayerLogin";
import { PlayerCardSection } from "@/components/sporcu/PlayerCardSection";
import { PlayerQrTab } from "@/components/sporcu/PlayerQrTab";
import { PlayerProgramTab } from "@/components/sporcu/PlayerProgramTab";
import { PlayerEquipmentTab } from "@/components/sporcu/PlayerEquipmentTab";
import { DueDisplayItem, PlayerDuesTab } from "@/components/sporcu/PlayerDuesTab";
import { PlayerProfileTab } from "@/components/sporcu/PlayerProfileTab";
import { MatchPredictionCard } from "@/components/ikbal/MatchPredictionCard";
import { PlayerRankingBadge } from "@/components/kadro/PlayerRankingBadge";

const supabase = createClient();
const PLAYER_SESSION_KEY = "ikbal_logged_player_id";
const SPORCU_TAB_KEY = "ikbal_sporcu_tab";

type SporcuTab =
  | "kartim"
  | "tahmin"
  | "siralama"
  | "qr"
  | "program"
  | "malzeme"
  | "aidat"
  | "profil";

const VALID_SPORCU_TABS: SporcuTab[] = [
  "kartim",
  "siralama",
  "tahmin",
  "qr",
  "program",
  "malzeme",
  "aidat",
  "profil",
];

function getSavedSporcuTab(): SporcuTab {
  if (typeof window === "undefined") return "kartim";
  try {
    const saved = localStorage.getItem(SPORCU_TAB_KEY) as SporcuTab | null;
    if (saved && VALID_SPORCU_TABS.includes(saved)) return saved;
  } catch {
    // yoksay
  }
  return "kartim";
}

function SporcuShellSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-5">
        <Iskelet className="h-32 w-full" radius={24} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((n) => (
            <Iskelet key={n} className="h-24 w-full" radius={18} />
          ))}
        </div>
        <Iskelet className="h-14 w-full" radius={16} />
        <Iskelet className="h-96 w-full" radius={24} />
      </div>
    </div>
  );
}

export default function SporcuPage() {
  const [player, setPlayer] = useState<(Player & { skill_points?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<SporcuTab>("kartim");
  const yonRef = useRef(1);
  const azaltilmis = useReducedMotion();

  const [dues, setDues] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendances, setAttendances] = useState<PrayerAttendance[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLog[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetMini[]>([]);
  const [stockItems, setStockItems] = useState<StockItemMini[]>([]);
  const [feedback, setFeedback] = useState("");

  const setActiveTab = (next: SporcuTab) => {
    if (next !== activeTab) {
      yonRef.current =
        VALID_SPORCU_TABS.indexOf(next) >= VALID_SPORCU_TABS.indexOf(activeTab)
          ? 1
          : -1;
    }
    setActiveTabState(next);
    try {
      localStorage.setItem(SPORCU_TAB_KEY, next);
    } catch {
      // yoksay
    }
  };

  const loadPlayerData = useCallback(async (playerId: string) => {
    const [pRes, dRes, tRes, trRes, sRes, aRes, tpRes, eqRes, jsRes, stRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
      supabase.from("dues").select("*").eq("player_id", playerId).order("created_at", { ascending: false }),
      supabase.from("tasks_assignments").select("*").order("event_date", { ascending: true }).limit(30),
      supabase.from("trainings").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_sessions").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("players").select("id, full_name, age_group, position, jersey_number"),
      supabase.from("equipment_logs").select("*").eq("player_id", playerId).order("given_date", { ascending: false }),
      supabase.from("jersey_sets").select("id, set_name, kit_type, photo_url"),
      supabase.from("equipment_stock").select("id, product_name, category, photo_url"),
    ]);

    if (pRes.data) {
      setPlayer(pRes.data as Player & { skill_points?: number });
    } else {
      setPlayer(null);
    }

    setDues((dRes.data as Due[] | null) || []);
    setTasks((tRes.data as TaskAssignment[] | null) || []);
    setTrainings((trRes.data as Training[] | null) || []);
    setSessions((sRes.data as PrayerSession[] | null) || []);
    setAttendances((aRes.data as PrayerAttendance[] | null) || []);
    setTeamPlayers((tpRes.data as Player[] | null) || []);
    setEquipmentLogs((eqRes.data as EquipmentLog[] | null) || []);
    setJerseySets((jsRes.data as JerseySetMini[] | null) || []);
    setStockItems((stRes.data as StockItemMini[] | null) || []);
  }, []);

  useEffect(() => {
    let active = true;
    const initSession = async () => {
      try {
        if (active) setActiveTabState(getSavedSporcuTab());
        const savedId =
          typeof window !== "undefined" ? localStorage.getItem(PLAYER_SESSION_KEY) : null;
        if (savedId?.trim()) {
          await loadPlayerData(savedId.trim());
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void initSession();
    return () => {
      active = false;
    };
  }, [loadPlayerData]);

  useEffect(() => {
    if (!player?.id) return;
    return subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadPlayerData(player.id);
      },
      `web-sporcu-${player.id}`
    );
  }, [player?.id, loadPlayerData]);

  function handleLogout() {
    try {
      localStorage.removeItem(PLAYER_SESSION_KEY);
      window.dispatchEvent(new Event("ikbal-auth-changed"));
    } catch {
      // yoksay
    }
    setPlayer(null);
    setDues([]);
    setTasks([]);
    setTrainings([]);
    setSessions([]);
    setAttendances([]);
    setTeamPlayers([]);
    setEquipmentLogs([]);
    setJerseySets([]);
    setStockItems([]);
    setFeedback("");
  }

  const dueDisplayItems: DueDisplayItem[] = useMemo(() => {
    return dues.map((d) => ({
      monthLabel: d.month_label,
      amount: Number(d.amount || 0),
      state: d.status === "Ödendi" ? "paid" : "unpaid",
    }));
  }, [dues]);

  const unpaidCount = useMemo(
    () => dueDisplayItems.filter((d) => d.state !== "paid").length,
    [dueDisplayItems]
  );

  const playerAttendedCount = useMemo(() => {
    if (!player) return 0;
    return attendances.filter((a) => a.player_id === player.id).length;
  }, [attendances, player]);

  const playerTrainings = useMemo(() => {
    if (!player) return [];
    return trainings.filter(
      (t) =>
        t.age_groups?.includes(player.age_group) ||
        t.extra_player_ids?.includes(player.id)
    );
  }, [trainings, player]);

  if (loading) {
    return <SporcuShellSkeleton />;
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <Vitrin className="w-full max-w-md">
            <PlayerLogin
              onLoginSuccess={async (loggedPlayer) => {
                setPlayer(loggedPlayer as Player & { skill_points?: number });
                setActiveTab("kartim");
                await loadPlayerData(loggedPlayer.id);
              }}
            />
          </Vitrin>
        </main>
      </div>
    );
  }

  const tabs: Array<{ id: SporcuTab; label: string; badge?: number }> = [
    { id: "kartim", label: "Kartım" },
    { id: "siralama", label: "Ortak Sıralama" },
    { id: "tahmin", label: "Maç Tahmini" },
    { id: "qr", label: "QR Yoklama" },
    { id: "program", label: "Programım", badge: playerTrainings.length || undefined },
    { id: "malzeme", label: "Malzemelerim", badge: equipmentLogs.length || undefined },
    { id: "aidat", label: "Aidatlarım", badge: unpaidCount || undefined },
    { id: "profil", label: "Profil & PIN" },
  ];

  const initials = (player.full_name || "İ").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16 transition-colors tabular-nums">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Editorial Sporcu Üst Sahnesi */}
        <motion.div
          initial={azaltilmis ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE.posta }}
          className="k-sahne rounded-3xl text-white p-6 sm:p-7 shadow-md border border-white/15 flex flex-wrap items-center justify-between gap-5"
        >
          <div className="flex items-center gap-4 min-w-0">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/35 bg-white shrink-0 shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--brand-red)] border-2 border-white/35 flex items-center justify-center text-2xl sm:text-3xl font-black shrink-0 shadow-lg">
                {initials}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full k-cam--marka text-[10px] font-extrabold uppercase tracking-[0.18em]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {player.age_group} Kadrosu
              </div>
              <h1 className="k-posta k-posta--wonk text-2xl sm:text-3xl text-white truncate">
                {player.full_name}
              </h1>
              <div className="text-xs text-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Kod: <strong className="text-amber-200">{player.player_code || "-"}</strong>
                </span>
                <span>•</span>
                <span>Mevki: {player.position || "Belirtilmemiş"}</span>
                <span>•</span>
                <span>
                  Forma: {player.jersey_number ? `#${player.jersey_number}` : "-"}
                </span>
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={handleLogout}
            className="k-buton k-buton--kirmizi shrink-0"
          >
            Çıkış Yap
          </motion.button>
        </motion.div>

        {/* Hızlı Özet Metrikleri */}
        <Sira className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <SiraOgesi>
            <button
              type="button"
              onClick={() => setActiveTab("kartim")}
              className="w-full text-left k-artik k-kart p-5 flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="k-koz text-koz block">Beceri Puanı</span>
                <Metrik className="text-2xl sm:text-3xl font-black text-[var(--brand-ink)] mt-1">
                  {Number(player.skill_points ?? 20)}{" "}
                  <span className="text-xs font-extrabold text-[var(--text-secondary)]">Puan</span>
                </Metrik>
              </div>
              <span className="k-etiket k-etiket--lacivert">Kartı Geliştir →</span>
            </button>
          </SiraOgesi>

          <SiraOgesi>
            <button
              type="button"
              onClick={() => setActiveTab("qr")}
              className="w-full text-left k-artik k-kart p-5 flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="k-koz text-koz block">QR Katılım</span>
                <Metrik className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-1">
                  {playerAttendedCount}{" "}
                  <span className="text-xs font-extrabold text-[var(--text-secondary)]">Oturum</span>
                </Metrik>
              </div>
              <span className="k-etiket k-etiket--basari">Yoklama →</span>
            </button>
          </SiraOgesi>

          <SiraOgesi>
            <button
              type="button"
              onClick={() => setActiveTab("aidat")}
              className="w-full text-left k-artik k-kart p-5 flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="k-koz text-koz block">Aidat Durumu</span>
                <Metrik
                  className={`text-2xl sm:text-3xl font-black mt-1 ${
                    unpaidCount > 0 ? "text-[var(--brand-red)]" : "text-emerald-600"
                  }`}
                >
                  {unpaidCount > 0 ? `${unpaidCount} Bekleyen` : "Güncel"}
                </Metrik>
              </div>
              <span
                className={`k-etiket ${
                  unpaidCount > 0 ? "k-etiket--tehlike" : "k-etiket--basari"
                }`}
              >
                Detay →
              </span>
            </button>
          </SiraOgesi>
        </Sira>

        {/* Yaylı Sekme Çubuğu */}
        <div className="k-artik p-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative px-3 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? "text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isActive && !azaltilmis && (
                  <motion.span
                    layoutId="sporcu-sekme-pil"
                    transition={SPRING.yumusak}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] shadow-xs"
                  />
                )}
                {isActive && azaltilmis && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)]" />
                )}
                <span className="relative z-10 truncate">{item.label}</span>
                {typeof item.badge === "number" && (
                  <span
                    className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE.yumusak }}
              className="p-3.5 rounded-2xl bg-[var(--status-success-bg)] border border-[var(--status-success-text)]/25 text-[var(--status-success-text)] text-xs font-extrabold flex items-center justify-between"
            >
              <span>{feedback}</span>
              <button
                type="button"
                onClick={() => setFeedback("")}
                className="underline ml-3 cursor-pointer"
              >
                Kapat
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            variants={sekmeGecis(yonRef.current)}
            initial={azaltilmis ? false : "initial"}
            animate="animate"
            exit={azaltilmis ? undefined : "exit"}
          >
            {activeTab === "kartim" && (
              <PlayerCardSection
                player={player}
                onPlayerUpdated={(updated: Player) => setPlayer(updated)}
                onFeedback={setFeedback}
              />
            )}

            {activeTab === "siralama" && (
              <PlayerRankingBadge playerId={player.id} showFullLeaderboard />
            )}

            {activeTab === "tahmin" && (
              <MatchPredictionCard
                playerId={player.id}
                playerAgeGroup={player.age_group}
                currentSkillPoints={Number(player.skill_points ?? 0)}
                onRewardClaimed={() => {
                  void loadPlayerData(player.id);
                }}
              />
            )}

            {activeTab === "qr" && (
              <PlayerQrTab
                player={player}
                allSessions={sessions}
                attendances={attendances}
                setAttendances={setAttendances}
                teamPlayers={teamPlayers}
                playerAttendedCount={playerAttendedCount}
              />
            )}

            {activeTab === "program" && (
              <PlayerProgramTab trainings={playerTrainings} tasks={tasks} />
            )}

            {activeTab === "malzeme" && (
              <PlayerEquipmentTab
                equipmentLogs={equipmentLogs}
                jerseySets={jerseySets}
                stockItems={stockItems}
              />
            )}

            {activeTab === "aidat" && (
              <PlayerDuesTab dueItems={dueDisplayItems} overdueCount={unpaidCount} />
            )}

            {activeTab === "profil" && (
              <PlayerProfileTab
                {...({
                  player,
                  setPlayer,
                  overdueCount: unpaidCount,
                } as unknown as React.ComponentProps<typeof PlayerProfileTab>)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}