"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Player, TaskAssignment } from "@/types/club";
import { EASE, SPRING } from "@/lib/motion";

const supabase = createClient();

interface GoalEntry {
  player_id: string;
  player_name: string;
  goals: number;
}

interface MatchResultsTabProps {
  players: Player[];
  tasks: TaskAssignment[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void> | void;
}

function getPlayerMultiplier(p: Player, allPlayers: Player[]): 1 | 2 | 3 {
  const playerWithGoals = p as Player & { goals_scored?: number | null };
  const goals = Math.max(0, Number(playerWithGoals.goals_scored ?? 0));
  const maxGoals = Math.max(
    0,
    ...allPlayers.map((item) =>
      Math.max(
        0,
        Number(
          (item as Player & { goals_scored?: number | null }).goals_scored ?? 0
        )
      )
    )
  );
  if (goals <= 0) return 3;
  if (maxGoals > 0 && goals >= maxGoals) return 1;
  return 2;
}

export function MatchResultsTab({
  players,
  tasks,
  onFeedback,
  onLogActivity,
}: MatchResultsTabProps) {
  const azaltilmis = useReducedMotion();

  const matchList = useMemo(() => {
    const onlyMatches = tasks.filter(
      (t) => String(t.task_type || "").toLowerCase() === "mac"
    );
    return onlyMatches.length > 0 ? onlyMatches : tasks;
  }, [tasks]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matchList[0]?.id || ""
  );
  const [homeGoals, setHomeGoals] = useState<number>(0);
  const [awayGoals, setAwayGoals] = useState<number>(0);
  const [extraSquadIds, setExtraSquadIds] = useState<string[]>([]);
  const [selectedScorerId, setSelectedScorerId] = useState<string>("");
  const [scorerGoalCount, setScorerGoalCount] = useState<number>(1);
  const [goalEvents, setGoalEvents] = useState<GoalEntry[]>([]);
  const [previousGoalEvents, setPreviousGoalEvents] = useState<GoalEntry[]>([]);
  const [alreadyRecorded, setAlreadyRecorded] = useState<boolean>(false);
  const [editConfirmed, setEditConfirmed] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  const [showExtraSearch, setShowExtraSearch] = useState(false);
  const [extraSearchQuery, setExtraSearchQuery] = useState("");

  const activeMatch =
    matchList.find((m) => m.id === selectedMatchId) || matchList[0] || null;

  const hydrateMatchResult = useCallback(async (matchId: string) => {
    if (!matchId) {
      setAlreadyRecorded(false);
      setEditConfirmed(false);
      return;
    }
    const { data } = await supabase
      .from("match_results")
      .select("home_goals, away_goals, goal_events, is_finalized")
      .eq("match_id", matchId)
      .maybeSingle();

    if (data && (data.is_finalized || Array.isArray(data.goal_events))) {
      const loadedGoals = Array.isArray(data.goal_events)
        ? (data.goal_events as GoalEntry[])
        : [];
      setHomeGoals(Number(data.home_goals ?? 0));
      setAwayGoals(Number(data.away_goals ?? 0));
      setGoalEvents(loadedGoals);
      setPreviousGoalEvents(loadedGoals);
      setAlreadyRecorded(true);
      setEditConfirmed(false);
    } else {
      setHomeGoals(0);
      setAwayGoals(0);
      setGoalEvents([]);
      setPreviousGoalEvents([]);
      setAlreadyRecorded(false);
      setEditConfirmed(true);
    }
  }, []);

  useEffect(() => {
    const targetId = activeMatch?.id || "";
    const timer = window.setTimeout(() => {
      void hydrateMatchResult(targetId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMatch?.id, hydrateMatchResult]);

  const matchPlayers = useMemo(() => {
    if (!activeMatch) return players;

    const matchWithSquad = activeMatch as TaskAssignment & {
      squad_player_ids?: string[] | null;
    };

    const squadIds = Array.isArray(matchWithSquad.squad_player_ids)
      ? matchWithSquad.squad_player_ids
      : [];

    let baseList: Player[];
    if (squadIds.length > 0) {
      baseList = players.filter((p) => squadIds.includes(p.id));
    } else if (activeMatch.age_group && activeMatch.age_group !== "Tümü") {
      const groupFiltered = players.filter(
        (p) => p.age_group === activeMatch.age_group
      );
      baseList = groupFiltered.length > 0 ? groupFiltered : players;
    } else {
      baseList = players;
    }

    const combinedIds = new Set<string>([
      ...baseList.map((p) => p.id),
      ...extraSquadIds,
      ...goalEvents.map((g) => g.player_id),
    ]);

    return players.filter((p) => combinedIds.has(p.id));
  }, [activeMatch, players, extraSquadIds, goalEvents]);

  const effectiveScorerId = useMemo(() => {
    if (matchPlayers.length === 0) return "";
    return matchPlayers.some((p) => p.id === selectedScorerId)
      ? selectedScorerId
      : matchPlayers[0].id;
  }, [matchPlayers, selectedScorerId]);

  const searchedOutsidePlayers = useMemo(() => {
    const q = extraSearchQuery.trim().toLocaleLowerCase("tr-TR");
    const currentIds = new Set(matchPlayers.map((p) => p.id));
    const candidates = players.filter((p) => !currentIds.has(p.id));

    if (!q) return candidates.slice(0, 6);
    return candidates
      .filter(
        (p) =>
          p.full_name.toLocaleLowerCase("tr-TR").includes(q) ||
          (p.age_group || "").toLocaleLowerCase("tr-TR").includes(q)
      )
      .slice(0, 6);
  }, [players, matchPlayers, extraSearchQuery]);

  function handleSelectMatch(matchId: string) {
    setSelectedMatchId(matchId);
    setExtraSquadIds([]);
    setShowExtraSearch(false);
    setExtraSearchQuery("");
  }

  function handlePickExtraPlayer(p: Player) {
    setExtraSquadIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
    setSelectedScorerId(p.id);
    setExtraSearchQuery("");
    setShowExtraSearch(false);
  }

  function addScorerToList() {
    if (!effectiveScorerId || scorerGoalCount < 1) return;
    const foundPlayer = players.find((p) => p.id === effectiveScorerId);
    if (!foundPlayer) return;

    setGoalEvents((prev) => {
      const existingIdx = prev.findIndex((g) => g.player_id === foundPlayer.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          goals: copy[existingIdx].goals + scorerGoalCount,
        };
        return copy;
      }
      return [
        ...prev,
        {
          player_id: foundPlayer.id,
          player_name: foundPlayer.full_name,
          goals: scorerGoalCount,
        },
      ];
    });
    setScorerGoalCount(1);
  }

  function removeScorer(playerId: string) {
    setGoalEvents((prev) => prev.filter((g) => g.player_id !== playerId));
  }

  async function handleSaveResult(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMatch) {
      onFeedback("Lütfen önce bir maç seçin.");
      return;
    }

    if (alreadyRecorded && !editConfirmed) {
      onFeedback(
        "Bu maç için zaten skor ve golcü kaydı bulunuyor! Düzenlemek için 'Kaydı Düzenle' butonuna basın."
      );
      return;
    }

    setSaving(true);
    try {
      const scorerIds = goalEvents.map((g) => g.player_id);
      const scorerNames = goalEvents.map((g) => g.player_name);
      const actualScorerText = scorerNames.join(", ");

      const { error: resError } = await supabase.from("match_results").upsert(
        {
          match_id: activeMatch.id,
          home_goals: homeGoals,
          away_goals: awayGoals,
          scorer_player_ids: scorerIds,
          goal_events: goalEvents,
          is_finalized: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" }
      );

      if (resError) {
        onFeedback(`Maç sonucu kaydedilemedi: ${resError.message}`);
        return;
      }

      const prevMap = new Map<string, number>();
      for (const pg of previousGoalEvents) {
        if (pg.player_id) {
          prevMap.set(
            pg.player_id,
            (prevMap.get(pg.player_id) || 0) + Number(pg.goals || 0)
          );
        }
      }
      const nextMap = new Map<string, number>();
      for (const ng of goalEvents) {
        if (ng.player_id) {
          nextMap.set(
            ng.player_id,
            (nextMap.get(ng.player_id) || 0) + Number(ng.goals || 0)
          );
        }
      }
      const allGoalPlayerIds = new Set<string>([
        ...prevMap.keys(),
        ...nextMap.keys(),
      ]);

      for (const pid of allGoalPlayerIds) {
        const deltaGoals = (nextMap.get(pid) || 0) - (prevMap.get(pid) || 0);
        if (deltaGoals === 0) continue;
        const { data: scorerRow } = await supabase
          .from("players")
          .select("goals_scored")
          .eq("id", pid)
          .maybeSingle();
        if (scorerRow && "goals_scored" in scorerRow) {
          const prevGoals = Number(scorerRow.goals_scored ?? 0);
          await supabase
            .from("players")
            .update({ goals_scored: Math.max(0, prevGoals + deltaGoals) })
            .eq("id", pid);
        }
      }

      const [byTitleRes, byIdRes] = await Promise.all([
        supabase
          .from("match_predictions")
          .select("*")
          .eq("match_title", activeMatch.title),
        supabase
          .from("match_predictions")
          .select("*")
          .eq("match_id", activeMatch.id),
      ]);

      const mergedPredsMap = new Map<string, Record<string, unknown>>();
      for (const row of [...(byTitleRes.data || []), ...(byIdRes.data || [])]) {
        if (row && typeof row.id === "string") {
          mergedPredsMap.set(row.id, row as Record<string, unknown>);
        }
      }
      const preds = Array.from(mergedPredsMap.values());
      const addedPointsByPlayer = new Map<string, number>();

      for (const pred of preds) {
        let earned = 0;
        const predHome = Number(
          pred.home_score ?? pred.predicted_home_goals ?? -1
        );
        const predAway = Number(
          pred.away_score ?? pred.predicted_away_goals ?? -1
        );

        if (predHome === Number(homeGoals)) earned += 1;
        if (predAway === Number(awayGoals)) earned += 1;

        const predScorerName = String(pred.first_scorer_name || "").trim();
        const matchedScorerPlayer = predScorerName
          ? players.find(
              (p) =>
                p.full_name.trim().toLocaleLowerCase("tr-TR") ===
                predScorerName.toLocaleLowerCase("tr-TR")
            )
          : null;

        const scorerHit = Boolean(
          (pred.predicted_scorer_id &&
            scorerIds.includes(String(pred.predicted_scorer_id))) ||
            (predScorerName &&
              scorerNames.some(
                (sn) =>
                  sn.trim().toLocaleLowerCase("tr-TR") ===
                  predScorerName.toLocaleLowerCase("tr-TR")
              ))
        );

        const mult: 1 | 2 | 3 =
          pred.scorer_multiplier === 1 ||
          pred.scorer_multiplier === 2 ||
          pred.scorer_multiplier === 3
            ? pred.scorer_multiplier
            : matchedScorerPlayer
            ? getPlayerMultiplier(matchedScorerPlayer, players)
            : 1;

        if (scorerHit) earned += mult;

        const prevAwarded = Number(
          pred.awarded_points ?? pred.points_earned ?? 0
        );
        const deltaPoints = Math.max(0, earned - prevAwarded);

        await supabase
          .from("match_predictions")
          .update({
            actual_home_score: homeGoals,
            actual_away_score: awayGoals,
            actual_scorer_name: actualScorerText || null,
            awarded_points: earned,
            points_earned: earned,
          })
          .eq("id", pred.id);

        const targetPlayerId = String(pred.player_id || "").trim();
        if (deltaPoints > 0 && targetPlayerId) {
          addedPointsByPlayer.set(
            targetPlayerId,
            (addedPointsByPlayer.get(targetPlayerId) || 0) + deltaPoints
          );
        }
      }

      let totalAwardedPlayers = 0;
      for (const [playerId, delta] of addedPointsByPlayer.entries()) {
        const { data: freshPlayer } = await supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .maybeSingle();

        if (!freshPlayer) continue;
        totalAwardedPlayers += 1;

        const updatePayload: Record<string, number> = {};
        if ("points" in freshPlayer) {
          updatePayload.points = Number(freshPlayer.points ?? 0) + delta;
        }
        if ("skill_points" in freshPlayer) {
          updatePayload.skill_points =
            Number(freshPlayer.skill_points ?? 20) + delta;
        }
        if (Object.keys(updatePayload).length === 0) {
          updatePayload.points = delta;
        }

        await supabase.from("players").update(updatePayload).eq("id", playerId);
      }

      setPreviousGoalEvents(goalEvents);
      setAlreadyRecorded(true);
      setEditConfirmed(false);

      await onLogActivity(
        alreadyRecorded ? "Maç Sonucu Düzenleme" : "Maç Sonucu & Golcüler",
        `${activeMatch.title}: ${homeGoals} - ${awayGoals} | Gol atanlar: ${
          goalEvents.map((g) => `${g.player_name} (${g.goals})`).join(", ") ||
          "Yok"
        } | Puan işlenen oyuncu: ${totalAwardedPlayers}`
      );

      onFeedback(
        `Maç skoru, gol atanlar ve tahmin puanları kaydedildi (${totalAwardedPlayers} oyuncuya puan aktarıldı).`
      );
    } finally {
      setSaving(false);
    }
  }

  const formLocked = alreadyRecorded && !editConfirmed;

  return (
    <form
      onSubmit={handleSaveResult}
      className="k-artik p-4 sm:p-6 space-y-4 tabular-nums min-w-0"
    >
      <div className="k-sahne text-white rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="k-koz text-[10px] text-amber-200 block">
            SKOR &amp; GOLCÜLER
          </span>
          <h2 className="k-posta text-lg sm:text-xl text-white truncate">
            Maç Skoru &amp; Golcüler
          </h2>
        </div>

        <div className="px-3.5 py-2 rounded-xl k-cam--marka flex items-center gap-2.5 shrink-0">
          <span className="text-xl sm:text-2xl font-black text-amber-300">
            {homeGoals}
          </span>
          <span className="text-sm font-black text-white/60">:</span>
          <span className="text-xl sm:text-2xl font-black text-white">
            {awayGoals}
          </span>
        </div>
      </div>

      {alreadyRecorded && (
        <div className="rounded-2xl border border-amber-400/70 bg-[var(--status-warning-bg)]/55 p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-[var(--text-primary)]">
            ⚠️ Bu maç için kayıt mevcut ({homeGoals} - {awayGoals}).
          </span>
          <button
            type="button"
            onClick={() => setEditConfirmed((prev) => !prev)}
            className="k-buton k-buton--lacivert min-h-[34px] !py-1 !px-3 !text-xs"
          >
            {editConfirmed ? "Kilitle" : "Kaydı Düzenle"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <select
          value={selectedMatchId}
          onChange={(e) => handleSelectMatch(e.target.value)}
          className="col-span-2 k-alan font-bold min-h-[42px] text-xs sm:text-sm"
        >
          {matchList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.age_group} — {m.title} ({m.event_date?.slice(0, 10)})
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0}
          disabled={formLocked}
          value={homeGoals}
          onChange={(e) =>
            setHomeGoals(Math.max(0, Number(e.target.value) || 0))
          }
          aria-label="İkbal Spor Gol"
          className="k-alan font-black text-center text-base min-h-[42px] disabled:opacity-60"
        />

        <input
          type="number"
          min={0}
          disabled={formLocked}
          value={awayGoals}
          onChange={(e) =>
            setAwayGoals(Math.max(0, Number(e.target.value) || 0))
          }
          aria-label="Rakip Gol"
          className="k-alan font-black text-center text-base min-h-[42px] disabled:opacity-60"
        />
      </div>

      <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            disabled={formLocked}
            value={effectiveScorerId}
            onChange={(e) => setSelectedScorerId(e.target.value)}
            className="flex-1 k-alan font-bold min-h-[40px] text-xs sm:text-sm disabled:opacity-60"
          >
            {matchPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.age_group})
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={20}
              disabled={formLocked}
              value={scorerGoalCount}
              onChange={(e) =>
                setScorerGoalCount(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-20 k-alan font-black text-center min-h-[40px] disabled:opacity-60"
              aria-label="Gol sayısı"
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              disabled={formLocked}
              onClick={addScorerToList}
              className="k-buton k-buton--lacivert flex-1 sm:flex-initial min-h-[40px] !px-4 !text-xs disabled:opacity-50"
            >
              + Golcü Ekle
            </motion.button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={formLocked}
            onClick={() => setShowExtraSearch((prev) => !prev)}
            className="k-buton k-buton--hayalet min-h-[34px] !py-1 !px-2.5 !text-[11px] disabled:opacity-50"
          >
            <span>
              {showExtraSearch ? "Aramayı Kapat" : "+ Listede Olmayan Oyuncu"}
            </span>
          </button>
          <span className="text-[11px] font-bold text-[var(--text-muted)]">
            {matchPlayers.length} kadro oyuncusu
          </span>
        </div>

        <AnimatePresence initial={false}>
          {showExtraSearch && (
            <motion.div
              initial={azaltilmis ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE.yumusak }}
              className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2.5 space-y-2"
            >
              <input
                type="text"
                value={extraSearchQuery}
                onChange={(e) => setExtraSearchQuery(e.target.value)}
                placeholder="Oyuncu veya yaş grubu ara..."
                className="k-alan min-h-[38px] text-xs"
              />
              <div className="max-h-36 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {searchedOutsidePlayers.map((p) => (
                  <div
                    key={p.id}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold truncate">
                      {p.full_name}{" "}
                      <span className="text-[var(--text-muted)]">
                        ({p.age_group})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePickExtraPlayer(p)}
                      className="k-buton k-buton--kirmizi min-h-[30px] !py-0.5 !px-2.5 !text-[11px] shrink-0"
                    >
                      Seç
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {goalEvents.length > 0 && (
            <motion.div layout className="flex flex-wrap gap-1.5">
              {goalEvents.map((g) => (
                <motion.span
                  layout
                  initial={azaltilmis ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={SPRING.keskin}
                  key={g.player_id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] text-xs font-extrabold"
                >
                  <span>
                    ⚽ {g.player_name} ({g.goals})
                  </span>
                  {!formLocked && (
                    <button
                      type="button"
                      onClick={() => removeScorer(g.player_id)}
                      className="text-[var(--brand-red)] font-black cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={saving || formLocked}
        className="k-buton k-buton--kirmizi w-full min-h-[44px] !py-3 !text-xs sm:!text-sm disabled:opacity-50"
      >
        {saving
          ? "Kaydediliyor..."
          : formLocked
          ? "Kayıt Mevcut — Düzenlemek İçin 'Kaydı Düzenle' Seçin"
          : alreadyRecorded
          ? "Düzenlemeyi Kaydet"
          : "Skor ve Golcüleri Kaydet"}
      </motion.button>
    </form>
  );
}