"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { MatchPredictionCard } from "@/components/ikbal/MatchPredictionCard";
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
  TR_MONTHS,
  TaskAssignment,
  Training,
} from "@/types/club";
import {
  PlayerLogin,
  getOrCreateWebDeviceId,
} from "@/components/sporcu/PlayerLogin";
import { PlayerHeader, SporcuTab } from "@/components/sporcu/PlayerHeader";
import { PlayerQrTab } from "@/components/sporcu/PlayerQrTab";
import { PlayerProgramTab } from "@/components/sporcu/PlayerProgramTab";
import { PlayerEquipmentTab } from "@/components/sporcu/PlayerEquipmentTab";
import {
  DueDisplayItem,
  PlayerDuesTab,
} from "@/components/sporcu/PlayerDuesTab";
import { PlayerProfileTab } from "@/components/sporcu/PlayerProfileTab";

type LeaderboardPlayerEntry = {
  id: string;
  full_name: string;
  age_group: string;
  jersey_number?: number | null;
  skill_points?: number | null;
};

const supabase = createClient();
const SPORCU_TAB_KEY = "ikbal_sporcu_tab";
const VALID_SPORCU_TABS: SporcuTab[] = [
  "qr",
  "program",
  "malzemeler",
  "aidat",
  "profil",
];

function parseMonthIndex(label: string): number {
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const mIdx = TR_MONTHS.findIndex(
    (m) => m.toLowerCase() === parts[0].toLowerCase()
  );
  const yr = parseInt(parts[1], 10);
  if (mIdx === -1 || isNaN(yr)) return 0;
  return yr * 12 + mIdx;
}

function getPointsValue(entry: { skill_points?: number | null }): number {
  return Number(entry.skill_points ?? 20);
}

function SporcuSessionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-44 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)]" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 rounded bg-[var(--bg-subtle)]" />
            <div className="h-3 w-56 rounded bg-[var(--bg-subtle)]" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="h-9 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="h-9 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="h-9 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="h-9 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="h-9 rounded-xl bg-[var(--bg-subtle)]" />
        </div>
      </div>
      <div className="h-64 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="h-5 w-48 rounded bg-[var(--bg-subtle)]" />
        <div className="h-28 rounded-xl bg-[var(--bg-subtle)]" />
      </div>
    </div>
  );
}

export default function SporcuPortalPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [restoringSession, setRestoringSession] = useState<boolean>(true);
  const [tab, setTab] = useState<SporcuTab>("qr");
  const [currentIdx, setCurrentIdx] = useState<number>(2026 * 12 + 10);

  const [dues, setDues] = useState<Due[]>([]);
  const [defaultFee, setDefaultFee] = useState<number>(500);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [allSessions, setAllSessions] = useState<PrayerSession[]>([]);
  const [attendances, setAttendances] = useState<PrayerAttendance[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [allClubPlayers, setAllClubPlayers] = useState<LeaderboardPlayerEntry[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLog[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetMini[]>([]);
  const [stockItems, setStockItems] = useState<StockItemMini[]>([]);

  function handleTabChange(nextTab: SporcuTab) {
    setTab(nextTab);
    try {
      localStorage.setItem(SPORCU_TAB_KEY, nextTab);
    } catch {
      // yoksay
    }
  }

  async function loadPlayerData(p: Player) {
    const attendanceQuery = p.is_representative
      ? supabase.from("prayer_attendance").select("*")
      : supabase.from("prayer_attendance").select("*").eq("player_id", p.id);

    const [
      duesRes,
      trRes,
      taskRes,
      sessRes,
      attRes,
      feeRes,
      eqRes,
      jSetRes,
      stRes,
      allClubRes,
    ] = await Promise.all([
      supabase.from("dues").select("*").eq("player_id", p.id),
      supabase
        .from("trainings")
        .select("*")
        .order("start_time", { ascending: true }),
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("event_date", { ascending: true }),
      supabase
        .from("prayer_sessions")
        .select("*")
        .order("session_date", { ascending: false }),
      attendanceQuery,
      supabase
        .from("club_settings")
        .select("*")
        .eq("key", "monthly_fee")
        .maybeSingle(),
      supabase
        .from("equipment_logs")
        .select("*")
        .eq("player_id", p.id)
        .order("created_at", { ascending: false }),
      supabase.from("jersey_sets").select("id, set_name, kit_type, photo_url"),
      supabase
        .from("equipment_stock")
        .select("id, product_name, category, photo_url"),
      supabase
        .from("players")
        .select("id, full_name, age_group, skill_points, jersey_number"),
    ]);

    if (duesRes.data) setDues(duesRes.data as Due[]);
    if (feeRes.data?.value) setDefaultFee(Number(feeRes.data.value) || 500);
    if (eqRes.data) setEquipmentLogs(eqRes.data as EquipmentLog[]);
    if (jSetRes.data) setJerseySets(jSetRes.data as JerseySetMini[]);
    if (stRes.data) setStockItems(stRes.data as StockItemMini[]);
    if (allClubRes.data) {
      setAllClubPlayers(allClubRes.data as LeaderboardPlayerEntry[]);
    }

    if (trRes.data) {
      const filtered = (trRes.data as Training[]).filter(
        (t) =>
          (t.age_groups || []).includes(p.age_group) ||
          (t.extra_player_ids || []).includes(p.id)
      );
      setTrainings(filtered);
    }
    if (taskRes.data) {
      const filteredTasks = (taskRes.data as TaskAssignment[]).filter(
        (t) =>
          t.age_group === p.age_group ||
          t.age_group === "Tümü" ||
          (t.squad_player_ids || []).includes(p.id)
      );
      setTasks(filteredTasks);
    }
    if (sessRes.data) setAllSessions(sessRes.data as PrayerSession[]);
    if (attRes.data) setAttendances(attRes.data as PrayerAttendance[]);

    if (p.is_representative) {
      const { data: allP } = await supabase
        .from("players")
        .select("*")
        .eq("age_group", p.age_group)
        .order("full_name", { ascending: true });
      if (allP) setTeamPlayers(allP as Player[]);
    }
  }

  useEffect(() => {
    let active = true;

    const restorePortalSession = async () => {
      try {
        try {
          const savedTab = localStorage.getItem(SPORCU_TAB_KEY) as SporcuTab | null;
          if (savedTab && VALID_SPORCU_TABS.includes(savedTab)) {
            if (active) setTab(savedTab);
          }
        } catch {
          // yoksay
        }

        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem("ikbal_logged_player_id")
            : null;

        if (!savedId) {
          if (active) {
            const now = new Date();
            setCurrentIdx(now.getFullYear() * 12 + now.getMonth());
            setRestoringSession(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", savedId)
          .maybeSingle();

        if (!active) return;
        if (error) return;

        if (!data) {
          localStorage.removeItem("ikbal_logged_player_id");
          window.dispatchEvent(new Event("ikbal-auth-changed"));
          return;
        }

        const p = data as Player;
        const deviceId = getOrCreateWebDeviceId();
        if (p.bound_device_id && p.bound_device_id !== deviceId) {
          localStorage.removeItem("ikbal_logged_player_id");
          window.dispatchEvent(new Event("ikbal-auth-changed"));
          return;
        }

        setPlayer(p);
        await loadPlayerData(p);
        if (active) {
          const now = new Date();
          setCurrentIdx(now.getFullYear() * 12 + now.getMonth());
        }
      } finally {
        if (active) setRestoringSession(false);
      }
    };

    void restorePortalSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    return subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadPlayerData(player);
      },
      `sporcu-live-${player.id}`
    );
  }, [player]);

  const dueItems: DueDisplayItem[] = useMemo(() => {
    const kasim2026Idx = 2026 * 12 + 10;
    const effectiveStartIdx = Math.min(kasim2026Idx, currentIdx);

    const monthSet = new Set<string>();
    for (let idx = effectiveStartIdx; idx <= currentIdx; idx++) {
      const yr = Math.floor(idx / 12);
      const m = idx % 12;
      monthSet.add(`${TR_MONTHS[m]} ${yr}`);
    }
    dues.forEach((d) => monthSet.add(d.month_label));

    return Array.from(monthSet)
      .sort((a, b) => parseMonthIndex(b) - parseMonthIndex(a))
      .map((monthLabel) => {
        const record = dues.find((d) => d.month_label === monthLabel);
        const paid = Boolean(
          record &&
            (record.status === "odendi" ||
              record.status === "Ödendi" ||
              record.status === "paid")
        );
        const mIdx = parseMonthIndex(monthLabel);
        const isPast = mIdx > 0 && mIdx < currentIdx;
        const isCurrent = mIdx === currentIdx;

        let state: DueDisplayItem["state"] = "unpaid";
        if (paid) state = "paid";
        else if (isPast) state = "overdue";
        else if (isCurrent) state = "unpaid";
        else state = "upcoming";

        return {
          monthLabel,
          amount: record?.amount ?? defaultFee,
          state,
        };
      });
  }, [dues, defaultFee, currentIdx]);

  const overdueCount = dueItems.filter((x) => x.state === "overdue").length;
  const currentUnpaid = dueItems.some((x) => x.state === "unpaid");
  const currentMonthItem =
    dueItems.find((x) => x.state === "unpaid" || x.state === "paid") ||
    dueItems[0];

  const activeEquipmentCount = equipmentLogs.filter(
    (e) => e.status === "teslim_edildi"
  ).length;

  const playerAttendedCount = player
    ? allSessions.filter((s) =>
        attendances.some(
          (a) => a.session_id === s.id && a.player_id === player.id
        )
      ).length
    : 0;

  const attendanceRate =
    allSessions.length > 0
      ? Math.round((playerAttendedCount / allSessions.length) * 100)
      : 0;

  const overallLeaderboard = useMemo<LeaderboardPlayerEntry[]>(() => {
    const currentPlayerPts = player
      ? getPointsValue(player as Player & { skill_points?: number | null })
      : 20;

    const merged: LeaderboardPlayerEntry[] = [...allClubPlayers];
    if (player && !merged.some((item) => item.id === player.id)) {
      merged.push({
        id: player.id,
        full_name: player.full_name,
        age_group: player.age_group,
        jersey_number: player.jersey_number,
        skill_points: currentPlayerPts,
      });
    }

    return merged
      .map((item) => {
        if (player && item.id === player.id) {
          return {
            ...item,
            skill_points: currentPlayerPts,
          };
        }
        return {
          ...item,
          skill_points: getPointsValue(item),
        };
      })
      .sort((a, b) => {
        const ptsA = getPointsValue(a);
        const ptsB = getPointsValue(b);
        if (ptsB !== ptsA) return ptsB - ptsA;
        return a.full_name.localeCompare(b.full_name, "tr-TR");
      });
  }, [allClubPlayers, player]);

  const myOverallRank = useMemo(() => {
    if (!player) return null;
    const idx = overallLeaderboard.findIndex((p) => p.id === player.id);
    if (idx === -1) return null;
    return {
      rank: idx + 1,
      total: overallLeaderboard.length,
      points: getPointsValue(player as Player & { skill_points?: number | null }),
    };
  }, [overallLeaderboard, player]);

  function handleLogout() {
    localStorage.removeItem("ikbal_logged_player_id");
    localStorage.removeItem(SPORCU_TAB_KEY);
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    setPlayer(null);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {restoringSession && !player ? (
          <SporcuSessionSkeleton />
        ) : !player ? (
          <div className="page-transition">
            <PlayerLogin
              onLoginSuccess={async (loggedPlayer) => {
                setPlayer(loggedPlayer);
                await loadPlayerData(loggedPlayer);
              }}
            />
          </div>
        ) : (
          <div className="space-y-6 page-transition">
            <PlayerHeader
              player={player}
              tab={tab}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
              totalSessionsCount={allSessions.length}
              attendanceRate={attendanceRate}
              activeEquipmentCount={activeEquipmentCount}
              overdueCount={overdueCount}
              currentUnpaid={currentUnpaid}
            />

            <div key={tab} className="page-transition">
              {tab === "qr" && (
                <PlayerQrTab
                  player={player}
                  allSessions={allSessions}
                  attendances={attendances}
                  setAttendances={setAttendances}
                  teamPlayers={teamPlayers}
                  playerAttendedCount={playerAttendedCount}
                />
              )}

              {tab === "program" && (
                <div className="space-y-6">
                  <PlayerProgramTab trainings={trainings} tasks={tasks} />
                  {player.id && player.age_group && (
                    <MatchPredictionCard
                      playerId={player.id}
                      ageGroup={player.age_group}
                    />
                  )}
                </div>
              )}

              {tab === "malzemeler" && (
                <PlayerEquipmentTab
                  equipmentLogs={equipmentLogs}
                  jerseySets={jerseySets}
                  stockItems={stockItems}
                />
              )}

              {tab === "aidat" && (
                <PlayerDuesTab
                  dueItems={dueItems}
                  overdueCount={overdueCount}
                />
              )}

              {tab === "profil" && (
                <div className="space-y-6">
                  <PlayerProfileTab
                    player={player}
                    setPlayer={setPlayer}
                    overdueCount={overdueCount}
                    currentMonthItem={currentMonthItem}
                  />

                  <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[var(--brand-red)]">
                          Üyelere Özel Genel Sıralama
                        </span>
                        <h2 className="text-lg font-black text-[var(--text-primary)]">
                          Genel Puan Tablosu (Tüm Yaş Kategorileri)
                        </h2>
                      </div>
                      {myOverallRank && (
                        <div className="px-4 py-2 rounded-xl bg-[var(--brand-navy)] text-white text-right tabular-nums">
                          <div className="text-[10px] uppercase text-amber-200 font-bold">
                            Senin Sıran
                          </div>
                          <div className="text-base font-black">
                            #{myOverallRank.rank}{" "}
                            <span className="text-xs font-semibold text-slate-300">
                              / {myOverallRank.total} • {myOverallRank.points}p
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end tabular-nums">
                      <div className="order-2 md:order-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 min-h-[145px] flex flex-col justify-between">
                        <span className="text-xs font-black text-[var(--text-secondary)]">
                          #2 Sıra
                        </span>
                        <div>
                          <div className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                            {overallLeaderboard[1]?.full_name || "-"}
                          </div>
                          <div className="text-xs font-bold text-[var(--text-muted)]">
                            {overallLeaderboard[1]?.age_group || ""}
                          </div>
                          <div className="text-sm font-black text-[var(--brand-red)] mt-1">
                            {overallLeaderboard[1]
                              ? getPointsValue(overallLeaderboard[1])
                              : 20}{" "}
                            Puan
                          </div>
                        </div>
                      </div>

                      <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-400 bg-[var(--brand-navy)] text-white p-5 min-h-[185px] flex flex-col justify-between shadow-md">
                        <span className="inline-block w-fit px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                          #1 Sıra • Lider
                        </span>
                        <div>
                          <div className="font-black text-xl truncate">
                            {overallLeaderboard[0]?.full_name || "-"}
                          </div>
                          <div className="text-xs font-bold text-amber-200">
                            {overallLeaderboard[0]?.age_group || ""}
                          </div>
                          <div className="text-base font-black text-amber-300 mt-1">
                            {overallLeaderboard[0]
                              ? getPointsValue(overallLeaderboard[0])
                              : 20}{" "}
                            Puan
                          </div>
                        </div>
                      </div>

                      <div className="order-3 rounded-2xl border border-amber-400/40 bg-[var(--bg-subtle)] p-4 min-h-[130px] flex flex-col justify-between">
                        <span className="text-xs font-black text-amber-500">
                          #3 Sıra
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {overallLeaderboard[2]?.full_name || "-"}
                          </div>
                          <div className="text-xs font-bold text-[var(--text-muted)]">
                            {overallLeaderboard[2]?.age_group || ""}
                          </div>
                          <div className="text-xs font-black text-[var(--brand-red)] mt-1">
                            {overallLeaderboard[2]
                              ? getPointsValue(overallLeaderboard[2])
                              : 20}{" "}
                            Puan
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] overflow-hidden tabular-nums">
                      {overallLeaderboard.slice(0, 10).map((item, idx) => {
                        const isMe = item.id === player.id;
                        return (
                          <div
                            key={item.id}
                            className={`px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm ${
                              isMe
                                ? "bg-[var(--brand-navy-soft)] font-black"
                                : "bg-[var(--bg-surface)]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 font-black text-[var(--brand-navy)] dark:text-sky-300">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-[var(--text-primary)] truncate">
                                {item.full_name}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-[11px] font-bold shrink-0">
                                {item.age_group}
                              </span>
                            </div>
                            <span className="font-black text-[var(--brand-red)] shrink-0">
                              {getPointsValue(item)} Puan
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}