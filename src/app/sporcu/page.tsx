"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { MatchPredictionCard } from "@/components/ikbal/MatchPredictionCard";
import { createClient } from "@/lib/supabase/client";
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

function getInitialSporcuTab(): SporcuTab {
  if (typeof window === "undefined") return "qr";
  try {
    const savedTab = localStorage.getItem(SPORCU_TAB_KEY) as SporcuTab | null;
    if (savedTab && VALID_SPORCU_TABS.includes(savedTab)) {
      return savedTab;
    }
  } catch {
    // yoksay
  }
  return "qr";
}

export default function SporcuPortalPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [restoringSession, setRestoringSession] = useState<boolean>(true);
  const [tab, setTab] = useState<SporcuTab>(() => getInitialSporcuTab());

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

  const now = new Date();
  const currentIdx = now.getFullYear() * 12 + now.getMonth();

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
    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem("ikbal_logged_player_id")
        : null;

    if (!savedId) {
      Promise.resolve().then(() => {
        if (active) setRestoringSession(false);
      });
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
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
      } finally {
        if (active) setRestoringSession(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {restoringSession && !player ? (
          <div className="py-16 text-center text-sm font-bold text-[#02274c]">
            Sporcu oturumu yükleniyor...
          </div>
        ) : !player ? (
          <PlayerLogin
            onLoginSuccess={async (loggedPlayer) => {
              setPlayer(loggedPlayer);
              await loadPlayerData(loggedPlayer);
            }}
          />
        ) : (
          <div className="space-y-6">
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

                <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#a60513]">
                        Üyelere Özel Genel Sıralama
                      </span>
                      <h2 className="text-lg font-black text-[#02274c]">
                        Genel Puan Tablosu (Tüm Yaş Kategorileri)
                      </h2>
                    </div>
                    {myOverallRank && (
                      <div className="px-4 py-2 rounded-xl bg-[#02274c] text-white text-right">
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="order-2 md:order-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 min-h-[155px] flex flex-col justify-between">
                      <span className="text-xs font-black text-slate-700">
                        🥈 2. Sıra
                      </span>
                      <div>
                        <div className="font-extrabold text-sm text-[#02274c] truncate">
                          {overallLeaderboard[1]?.full_name || "-"}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          {overallLeaderboard[1]?.age_group || ""}
                        </div>
                        <div className="text-sm font-black text-[#a60513] mt-1">
                          {overallLeaderboard[1]
                            ? getPointsValue(overallLeaderboard[1])
                            : 20}{" "}
                          Puan
                        </div>
                      </div>
                    </div>

                    <div className="order-1 md:order-2 rounded-3xl border-2 border-amber-400 bg-[#02274c] text-white p-6 min-h-[205px] flex flex-col justify-between shadow-md">
                      <span className="inline-block w-fit px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                        🥇 1. Sıra • Lider
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

                    <div className="order-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 min-h-[130px] flex flex-col justify-between">
                      <span className="text-xs font-black text-amber-900">
                        🥉 3. Sıra
                      </span>
                      <div>
                        <div className="font-bold text-sm text-[#02274c] truncate">
                          {overallLeaderboard[2]?.full_name || "-"}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          {overallLeaderboard[2]?.age_group || ""}
                        </div>
                        <div className="text-xs font-black text-[#a60513] mt-1">
                          {overallLeaderboard[2]
                            ? getPointsValue(overallLeaderboard[2])
                            : 20}{" "}
                          Puan
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {overallLeaderboard.slice(0, 10).map((item, idx) => {
                      const isMe = item.id === player.id;
                      return (
                        <div
                          key={item.id}
                          className={`px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm ${
                            isMe ? "bg-amber-50 font-black" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 font-black text-[#02274c]">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 truncate">
                              {item.full_name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold shrink-0">
                              {item.age_group}
                            </span>
                          </div>
                          <span className="font-black text-[#a60513] shrink-0">
                            {getPointsValue(item)} Puan
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {player.id && player.age_group && (
                  <MatchPredictionCard
                    playerId={player.id}
                    ageGroup={player.age_group}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}