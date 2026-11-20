"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
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

const supabase = createClient();

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

export default function SporcuPortalPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tab, setTab] = useState<SporcuTab>("qr");
  const [currentIdx, setCurrentIdx] = useState<number>(2026 * 12 + 10);

  const [dues, setDues] = useState<Due[]>([]);
  const [defaultFee, setDefaultFee] = useState<number>(500);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [allSessions, setAllSessions] = useState<PrayerSession[]>([]);
  const [attendances, setAttendances] = useState<PrayerAttendance[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLog[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetMini[]>([]);
  const [stockItems, setStockItems] = useState<StockItemMini[]>([]);

  useEffect(() => {
    const now = new Date();
    setCurrentIdx(now.getFullYear() * 12 + now.getMonth());

    const savedId = localStorage.getItem("ikbal_logged_player_id");
    if (savedId) {
      restoreSession(savedId);
    }
  }, []);

  async function restoreSession(playerId: string) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .maybeSingle();
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
  }

  async function loadPlayerData(p: Player) {
    // Temsilci değilse yalnızca kendi yoklamasını çekerek bant genişliğinden tasarruf et
    const attendanceQuery = p.is_representative
      ? supabase.from("prayer_attendance").select("*")
      : supabase.from("prayer_attendance").select("*").eq("player_id", p.id);

    const [duesRes, trRes, taskRes, sessRes, attRes, feeRes, eqRes, jSetRes, stRes] =
      await Promise.all([
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
      ]);

    if (duesRes.data) setDues(duesRes.data as Due[]);
    if (feeRes.data?.value) setDefaultFee(Number(feeRes.data.value) || 500);
    if (eqRes.data) setEquipmentLogs(eqRes.data as EquipmentLog[]);
    if (jSetRes.data) setJerseySets(jSetRes.data as JerseySetMini[]);
    if (stRes.data) setStockItems(stRes.data as StockItemMini[]);

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

  function handleLogout() {
    localStorage.removeItem("ikbal_logged_player_id");
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    setPlayer(null);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {!player ? (
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
              onTabChange={setTab}
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
              <PlayerProgramTab trainings={trainings} tasks={tasks} />
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
              <PlayerProfileTab
                player={player}
                setPlayer={setPlayer}
                overdueCount={overdueCount}
                currentMonthItem={currentMonthItem}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}