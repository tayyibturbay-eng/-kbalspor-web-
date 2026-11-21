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

export function MatchResultsTab({
  players,
  tasks,
  onFeedback,
  onLogActivity,
}: MatchResultsTabProps) {
  const matchList = useMemo(() => {
    const onlyMatches = tasks.filter((t) => t.task_type === "mac");
    return onlyMatches.length > 0 ? onlyMatches : tasks;
  }, [tasks]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matchList[0]?.id || ""
  );
  const [homeGoals, setHomeGoals] = useState<number>(0);
  const [awayGoals, setAwayGoals] = useState<number>(0);
  const [selectedScorerId, setSelectedScorerId] = useState<string>(
    players[0]?.id || ""
  );
  const [scorerGoalCount, setScorerGoalCount] = useState<number>(1);
  const [goalEvents, setGoalEvents] = useState<GoalEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const activeMatch =
    matchList.find((m) => m.id === selectedMatchId) || matchList[0] || null;

  async function handleSelectMatch(matchId: string) {
    setSelectedMatchId(matchId);
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

  function addScorerToList() {
    if (!selectedScorerId || scorerGoalCount < 1) return;
    const foundPlayer = players.find((p) => p.id === selectedScorerId);
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

      // Bu maça yapılan tahminleri çek ve puan hesapla
      const { data: preds } = await supabase
        .from("match_predictions")
        .select("*")
        .eq("match_id", activeMatch.id);

      if (preds && preds.length > 0) {
        for (const pred of preds) {
          let earned = 0;
          const scorerHit =
            pred.predicted_scorer_id &&
            scorerIds.includes(pred.predicted_scorer_id);
          const scoreHit =
            Number(pred.predicted_home_goals) === Number(homeGoals) &&
            Number(pred.predicted_away_goals) === Number(awayGoals);

          if (scorerHit) earned += 2;
          if (scoreHit) earned += 3;

          await supabase
            .from("match_predictions")
            .update({ points_earned: earned })
            .eq("id", pred.id);

          if (earned > 0 && pred.player_id) {
            const targetPlayer = players.find((p) => p.id === pred.player_id);
            const currentPts = Number(
              (targetPlayer as Player & { skill_points?: number | null })
                ?.skill_points ?? 20
            );
            await supabase
              .from("players")
              .update({ skill_points: currentPts + earned })
              .eq("id", pred.player_id);
          }
        }
      }

      await onLogActivity(
        "Maç Sonucu & Golcüler",
        `${activeMatch.title}: ${homeGoals} - ${awayGoals} | Gol atanlar: ${
          goalEvents.map((g) => `${g.player_name} (${g.goals})`).join(", ") ||
          "Yok"
        }`
      );

      onFeedback("Maç skoru ve gol atan oyuncular kaydedildi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSaveResult}
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5"
    >
      <div>
        <h2 className="text-lg font-black text-[#02274c]">
          Maç Skoru ve Gol Atan Oyuncular
        </h2>
        <p className="text-xs text-slate-500">
          Maç skorunu ve gol atan sporcuları girerek kayıt altına alabilirsin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Maç Seçin
          </label>
          <select
            value={selectedMatchId}
            onChange={(e) => handleSelectMatch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold bg-white"
          >
            {matchList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.age_group} — {m.title} ({m.event_date?.slice(0, 10)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            İkbalspor / Ev Sahibi Gol
          </label>
          <input
            type="number"
            min={0}
            value={homeGoals}
            onChange={(e) => setHomeGoals(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Rakip / Deplasman Gol
          </label>
          <input
            type="number"
            min={0}
            value={awayGoals}
            onChange={(e) => setAwayGoals(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
        <div className="text-xs font-extrabold text-[#02274c] uppercase tracking-wider">
          Gol Atan Oyuncu Ekle
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={selectedScorerId}
            onChange={(e) => setSelectedScorerId(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {players.map((p) => (
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
            className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold bg-white"
            placeholder="Gol"
          />

          <button
            type="button"
            onClick={addScorerToList}
            className="px-4 py-2 rounded-xl bg-[#02274c] hover:bg-[#043666] text-white text-xs font-extrabold cursor-pointer"
          >
            + Golcü Ekle
          </button>
        </div>

        {goalEvents.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {goalEvents.map((g) => (
              <span
                key={g.player_id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-300 text-xs font-extrabold text-[#02274c]"
              >
                <span>
                  ⚽ {g.player_name} ({g.goals} gol)
                </span>
                <button
                  type="button"
                  onClick={() => removeScorer(g.player_id)}
                  className="text-[#a60513] font-black cursor-pointer"
                >
                  ✕
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
          className="px-6 py-3 rounded-xl bg-[#a60513] hover:bg-red-700 disabled:opacity-60 text-white text-sm font-extrabold cursor-pointer"
        >
          {saving ? "Kaydediliyor..." : "Skor ve Golcüleri Kaydet"}
        </button>
      </div>
    </form>
  );
}