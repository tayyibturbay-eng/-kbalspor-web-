// MatchResultsTab.tsx
"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player, TaskAssignment } from "@/types/club";

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
  const [saving, setSaving] = useState(false);

  const [showExtraSearch, setShowExtraSearch] = useState(false);
  const [extraSearchQuery, setExtraSearchQuery] = useState("");

  const activeMatch =
    matchList.find((m) => m.id === selectedMatchId) || matchList[0] || null;

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

    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter(
        (p) =>
          p.full_name.toLocaleLowerCase("tr-TR").includes(q) ||
          (p.age_group || "").toLocaleLowerCase("tr-TR").includes(q)
      )
      .slice(0, 8);
  }, [players, matchPlayers, extraSearchQuery]);

  async function handleSelectMatch(matchId: string) {
    setSelectedMatchId(matchId);
    setExtraSquadIds([]);
    setShowExtraSearch(false);
    setExtraSearchQuery("");

    const { data } = await supabase
      .from("match_results")
      .select("home_goals, away_goals, goal_events")
      .eq("match_id", matchId)
      .maybeSingle();

    if (data) {
      setHomeGoals(Number(data.home_goals ?? 0));
      setAwayGoals(Number(data.away_goals ?? 0));
      setGoalEvents(Array.isArray(data.goal_events) ? data.goal_events : []);
    } else {
      setHomeGoals(0);
      setAwayGoals(0);
      setGoalEvents([]);
    }
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

      for (const gEvent of goalEvents) {
        if (!gEvent.player_id || gEvent.goals <= 0) continue;
        const { data: scorerRow } = await supabase
          .from("players")
          .select("goals_scored")
          .eq("id", gEvent.player_id)
          .maybeSingle();
        if (scorerRow && "goals_scored" in scorerRow) {
          const prevGoals = Number(scorerRow.goals_scored ?? 0);
          await supabase
            .from("players")
            .update({ goals_scored: prevGoals + gEvent.goals })
            .eq("id", gEvent.player_id);
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

      await onLogActivity(
        "Maç Sonucu & Golcüler",
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

  return (
    <form
      onSubmit={handleSaveResult}
      className="bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs space-y-5 tabular-nums"
    >
      <div>
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Maç Skoru ve Gol Atan Oyuncular
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Maç kadrosundaki/kategorisindeki oyuncuları seçebilir veya alttaki +
          butonundan başka oyuncu arayarak ekleyebilirsin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            Maç Seçin
          </label>
          <select
            value={selectedMatchId}
            onChange={(e) => handleSelectMatch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-strong)] px-3 py-2.5 text-sm font-semibold bg-[var(--bg-subtle)] text-[var(--text-primary)]"
          >
            {matchList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.age_group} — {m.title} ({m.event_date?.slice(0, 10)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            İkbalspor / Ev Sahibi Gol
          </label>
          <input
            type="number"
            min={0}
            value={homeGoals}
            onChange={(e) =>
              setHomeGoals(Math.max(0, Number(e.target.value) || 0))
            }
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] px-3 py-2.5 text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            Rakip / Deplasman Gol
          </label>
          <input
            type="number"
            min={0}
            value={awayGoals}
            onChange={(e) =>
              setAwayGoals(Math.max(0, Number(e.target.value) || 0))
            }
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] px-3 py-2.5 text-sm font-bold"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
            Maçta Oynayanlar — Golcü Ekle
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {matchPlayers.length} oyuncu listeleniyor
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={effectiveScorerId}
            onChange={(e) => setSelectedScorerId(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--border-strong)] px-3 py-2 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            {matchPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.age_group})
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={20}
            value={scorerGoalCount}
            onChange={(e) =>
              setScorerGoalCount(Math.max(1, Number(e.target.value) || 1))
            }
            className="w-24 rounded-xl border border-[var(--border-strong)] px-3 py-2 text-sm font-bold bg-[var(--bg-surface)] text-[var(--text-primary)]"
            placeholder="Gol"
          />

          <button
            type="button"
            onClick={addScorerToList}
            className="px-4 py-2 rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold cursor-pointer"
          >
            Golcü Ekle
          </button>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowExtraSearch((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:opacity-90 border border-dashed border-[var(--border-strong)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-[var(--brand-red)] text-white text-[11px] font-black leading-none">
              +
            </span>
            <span>
              {showExtraSearch
                ? "Arama Alanını Kapat"
                : "Listede Olmayan Oyuncu Ekle"}
            </span>
          </button>

          {showExtraSearch && (
            <div className="mt-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 space-y-2.5">
              <input
                type="text"
                value={extraSearchQuery}
                onChange={(e) => setExtraSearchQuery(e.target.value)}
                placeholder="Oyuncu adı veya kategori ara (örn. U13, Ahmet)..."
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] px-3 py-2 text-xs sm:text-sm"
                autoFocus
              />

              <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {searchedOutsidePlayers.length === 0 ? (
                  <div className="py-2 text-xs text-[var(--text-muted)]">
                    Eşleşen başka oyuncu bulunamadı.
                  </div>
                ) : (
                  searchedOutsidePlayers.map((p) => (
                    <div
                      key={p.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <div className="truncate">
                        <span className="font-bold text-[var(--text-primary)]">
                          {p.full_name}
                        </span>{" "}
                        <span className="text-xs text-[var(--text-muted)]">
                          ({p.age_group})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePickExtraPlayer(p)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                      >
                        + Seç
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {goalEvents.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {goalEvents.map((g) => (
              <span
                key={g.player_id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] text-xs font-extrabold text-[var(--text-primary)]"
              >
                <span>
                  {g.player_name} ({g.goals} gol)
                </span>
                <button
                  type="button"
                  onClick={() => removeScorer(g.player_id)}
                  className="text-[var(--brand-red)] font-black cursor-pointer"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] disabled:opacity-60 text-white text-sm font-extrabold cursor-pointer"
        >
          {saving ? "Kaydediliyor..." : "Skor ve Golcüleri Kaydet"}
        </button>
      </div>
    </form>
  );
}