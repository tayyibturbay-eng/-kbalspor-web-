"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
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
  "tahmin",
  "siralama",
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

export default function SporcuPage() {
  const [player, setPlayer] = useState<(Player & { skill_points?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<SporcuTab>("kartim");

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
    setEquipmentLogs([]);
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
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-10 text-sm font-bold text-[var(--text-secondary)]">
          Sporcu paneli yükleniyor...
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <PlayerLogin
              onLoginSuccess={async (loggedPlayer) => {
                setPlayer(loggedPlayer as Player & { skill_points?: number });
                setActiveTab("kartim");
                await loadPlayerData(loggedPlayer.id);
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  const tabs: Array<{ id: SporcuTab; label: string }> = [
    { id: "kartim", label: "Kartım" },
    { id: "siralama", label: "Ortak Sıralama" },
    { id: "tahmin", label: "Maç Tahmini" },
    { id: "qr", label: "QR Yoklama" },
    { id: "program", label: "Programım" },
    { id: "malzeme", label: "Malzemelerim" },
    { id: "aidat", label: "Aidatlarım" },
    { id: "profil", label: "Profil & PIN" },
  ];

  const initials = (player.full_name || "İ").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-14 transition-colors">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 pt-5 space-y-5">
        {/* Sporcu Üst Kartı */}
        <div className="rounded-3xl bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 bg-white shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[var(--brand-red)] border-2 border-white/40 flex items-center justify-center text-2xl font-black shrink-0">
                {initials}
              </div>
            )}
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-extrabold">
                {player.age_group}
              </span>
              <h1 className="text-xl sm:text-2xl font-black mt-1">{player.full_name}</h1>
              <div className="text-xs text-slate-200 mt-0.5">
                Kod: {player.player_code || "-"} • Mevki: {player.position || "Belirtilmemiş"} • Forma:{" "}
                {player.jersey_number ? `#${player.jersey_number}` : "-"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold cursor-pointer"
          >
            Çıkış Yap
          </button>
        </div>

        {/* Sekme Çubuğu */}
        <div className="bg-[var(--bg-surface)] p-2 rounded-2xl border border-[var(--border-subtle)] shadow-xs grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] text-white shadow-xs"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-xs font-extrabold flex items-center justify-between">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback("")} className="underline ml-3 cursor-pointer">
              Kapat
            </button>
          </div>
        )}

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
      </div>
    </div>
  );
}