"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateGoalPointsForScorer } from "@/lib/goal-scoring";

const supabase = createClient();

interface MatchTaskRow {
  id: string;
  title: string;
  age_group?: string | null;
  task_type?: string | null;
  event_date?: string | null;
  due_date?: string | null;
  match_time?: string | null;
  created_at?: string;
}

interface CategoryPlayerRow {
  id: string;
  full_name: string;
  age_group: string;
  jersey_number?: number | null;
}

interface PredictionRow {
  id: string;
  player_id: string;
  age_group: string;
  match_title: string;
  home_score: number;
  away_score: number;
  actual_home_score?: number | null;
  actual_away_score?: number | null;
  awarded_points?: number | null;
  first_scorer_name: string | null;
  scorer_multiplier?: number | null;
  created_at: string;
  players?: {
    full_name?: string | null;
    jersey_number?: number | null;
  } | null;
}

interface MatchPredictionCardProps {
  playerId: string;
  ageGroup: string;
}

function calcPredictionPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  let pts = 0;
  if (predHome === actualHome) pts += 1;
  if (predAway === actualAway) pts += 1;

  const predOutcome = predHome > predAway ? "H" : predHome < predAway ? "A" : "D";
  const actualOutcome =
    actualHome > actualAway ? "H" : actualHome < actualAway ? "A" : "D";
  if (predOutcome === actualOutcome) pts += 3;

  if (predHome === actualHome && predAway === actualAway) pts += 5;
  return pts;
}

function isMatchRecord(t: MatchTaskRow): boolean {
  const titleLower = (t.title || "").toLowerCase();
  return t.task_type === "mac" || titleLower.includes("maç") || titleLower.includes("mac");
}

export function MatchPredictionCard({
  playerId,
  ageGroup,
}: MatchPredictionCardProps) {
  const [matches, setMatches] = useState<MatchTaskRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [categoryPlayers, setCategoryPlayers] = useState<CategoryPlayerRow[]>([]);
  const [homeScore, setHomeScore] = useState<number>(2);
  const [awayScore, setAwayScore] = useState<number>(1);
  const [firstScorer, setFirstScorer] = useState<string>("");
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const selectedMatch = useMemo(() => {
    if (!matches.length) return null;
    return matches.find((m) => m.id === selectedMatchId) || matches[0];
  }, [matches, selectedMatchId]);

  const activeMatchTitle = useMemo(() => {
    return (selectedMatch?.title || "").trim();
  }, [selectedMatch]);

  const effectiveCategory = useMemo(() => {
    return (selectedMatch?.age_group || ageGroup || "Tümü").trim();
  }, [selectedMatch, ageGroup]);

  const filteredPlayers = useMemo(() => {
    if (!effectiveCategory || effectiveCategory === "Tümü") {
      return categoryPlayers;
    }
    const exact = categoryPlayers.filter(
      (p) => (p.age_group || "").trim() === effectiveCategory
    );
    return exact.length > 0 ? exact : categoryPlayers;
  }, [categoryPlayers, effectiveCategory]);

  const playerMultipliers = useMemo(() => {
    const goalCounts = new Map<string, number>();
    for (const pred of predictions) {
      if (
        typeof pred.actual_home_score === "number" &&
        typeof pred.actual_away_score === "number" &&
        pred.first_scorer_name
      ) {
        const key = pred.first_scorer_name.trim().toLowerCase();
        goalCounts.set(key, (goalCounts.get(key) || 0) + 1);
      }
    }

    const map = new Map<string, number>();
    for (const p of filteredPlayers) {
      const prevGoals = goalCounts.get(p.full_name.trim().toLowerCase()) || 0;
      map.set(p.id, calculateGoalPointsForScorer(prevGoals, false));
    }
    return map;
  }, [filteredPlayers, predictions]);

  const fetchPredictionData = useCallback(async () => {
    const [taskRes, predRes, playersRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("event_date", { ascending: true })
        .limit(40),
      supabase
        .from("match_predictions")
        .select("*, players(full_name, jersey_number)")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("players")
        .select("id, full_name, age_group, jersey_number")
        .order("full_name", { ascending: true }),
    ]);

    return {
      taskData: (taskRes.data as MatchTaskRow[] | null) || [],
      predData: (predRes.data as PredictionRow[] | null) || [],
      playersData: (playersRes.data as CategoryPlayerRow[] | null) || [],
    };
  }, []);

  const applyFetchedData = useCallback(
    (
      taskData: MatchTaskRow[],
      predData: PredictionRow[],
      playersData: CategoryPlayerRow[],
      syncMine = false
    ) => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const matchRows = taskData.filter((t) => {
        if (!isMatchRecord(t)) return false;
        const dateVal = String(t.event_date || t.due_date || "").slice(0, 10);
        return !dateVal || dateVal >= todayIso;
      });
      const finalMatches =
        matchRows.length > 0 ? matchRows : taskData.filter((t) => isMatchRecord(t));

      setMatches(finalMatches);
      setCategoryPlayers(playersData);
      setPredictions(predData);

      setSelectedMatchId((prev) => {
        if (prev && finalMatches.some((m) => m.id === prev)) return prev;
        const groupFirst = finalMatches.find(
          (m) => !m.age_group || m.age_group === ageGroup
        );
        return groupFirst?.id || finalMatches[0]?.id || "";
      });

      if (syncMine) {
        const mine = predData.find((r) => r.player_id === playerId);
        if (mine) {
          setHomeScore(mine.home_score);
          setAwayScore(mine.away_score);
          setFirstScorer(mine.first_scorer_name || "");
        }
      }
    },
    [ageGroup, playerId]
  );

  useEffect(() => {
    if (!playerId) return;
    let active = true;

    (async () => {
      const { taskData, predData, playersData } = await fetchPredictionData();
      if (!active) return;
      applyFetchedData(taskData, predData, playersData, true);
    })();

    return () => {
      active = false;
    };
  }, [playerId, fetchPredictionData, applyFetchedData]);

  useEffect(() => {
    if (!filteredPlayers.length) return;
    setFirstScorer((prev) => {
      if (prev && filteredPlayers.some((p) => p.full_name === prev)) return prev;
      return filteredPlayers[0].full_name;
    });
  }, [filteredPlayers]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    if (!activeMatchTitle) {
      setStatusMsg({
        ok: false,
        text: "Şu anda seçilebilir aktif maç bulunmuyor.",
      });
      return;
    }

    const chosenScorer = firstScorer.trim() || filteredPlayers[0]?.full_name || null;
    const matchedPlayer = chosenScorer
      ? filteredPlayers.find((p) => p.full_name === chosenScorer)
      : null;
    const multiplier = matchedPlayer
      ? playerMultipliers.get(matchedPlayer.id) ?? 1
      : 1;

    setSaving(true);
    const { error } = await supabase.from("match_predictions").upsert(
      {
        player_id: playerId,
        age_group: effectiveCategory,
        match_title: activeMatchTitle,
        home_score: Math.max(0, Math.min(30, Number(homeScore) || 0)),
        away_score: Math.max(0, Math.min(30, Number(awayScore) || 0)),
        first_scorer_name: chosenScorer,
        scorer_multiplier: multiplier,
      },
      { onConflict: "player_id,match_title" }
    );
    setSaving(false);

    if (error) {
      setStatusMsg({ ok: false, text: "Tahmin kaydedilemedi: " + error.message });
      return;
    }

    setStatusMsg({
      ok: true,
      text: `Maç günü tahminin kaydedildi! (Gol çarpanı: x${multiplier.toFixed(2)})`,
    });

    const { taskData, predData, playersData } = await fetchPredictionData();
    applyFetchedData(taskData, predData, playersData, false);
  }

  const visiblePredictions = useMemo(() => {
    if (!activeMatchTitle) return predictions;
    const exact = predictions.filter((p) => p.match_title === activeMatchTitle);
    return exact.length > 0 ? exact : predictions;
  }, [predictions, activeMatchTitle]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="inline-block bg-[#02274c] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
            {effectiveCategory} • Maç Günü Tahmini
          </span>
          <h2 className="text-lg font-extrabold text-[#02274c] mt-1">
            Skor &amp; Golcü Tahmini
          </h2>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            Her doğru skor: +1 puan • Kazananı bilme: +3 puan • Tam doğru maç: +5 puan
          </p>
        </div>
        <span className="text-xs font-bold text-slate-600">
          {visiblePredictions.length} tahmin yapıldı
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Aktif Maç Seçimi
          </label>
          {matches.length > 0 ? (
            <select
              value={selectedMatch?.id || ""}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id} className="bg-white text-slate-900">
                  {m.title}
                  {m.age_group ? ` [${m.age_group}]` : ""}
                  {m.event_date || m.due_date ? ` (${m.event_date || m.due_date})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-3.5 py-2.5 text-xs font-bold">
              Şu anda aktif maç kaydı bulunmuyor.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              İkbalspor Gol
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={homeScore}
              onChange={(e) => setHomeScore(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Rakip Gol
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={awayScore}
              onChange={(e) => setAwayScore(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-800">
              Gol Atacak Oyuncu ({effectiveCategory} Kadrosu)
            </label>
            <span className="text-[11px] font-bold text-[#02274c]">
              {filteredPlayers.length} oyuncu
            </span>
          </div>

          {filteredPlayers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filteredPlayers.map((cand) => {
                const mult = playerMultipliers.get(cand.id) ?? 1;
                const isSelected = firstScorer === cand.full_name;
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setFirstScorer(cand.full_name)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#a60513] text-white border-[#a60513] shadow-sm"
                        : "bg-slate-50 text-[#02274c] border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>
                      {cand.full_name}
                      {cand.jersey_number ? ` #${cand.jersey_number}` : ""}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#02274c]/10 text-[#02274c]"
                      }`}
                    >
                      x{mult.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {effectiveCategory} kategorisinde kayıtlı oyuncu bulunamadı.
            </p>
          )}
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              statusMsg.ok
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !activeMatchTitle}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#a60513] hover:bg-red-700 text-white text-sm font-extrabold transition disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Kaydediliyor..." : "Tahminimi Kaydet"}
        </button>
      </form>

      {visiblePredictions.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <h3 className="text-xs font-extrabold uppercase text-slate-700">
            {effectiveCategory} Grubu Tahminleri
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {visiblePredictions.map((pred) => {
              const hasActual =
                typeof pred.actual_home_score === "number" &&
                typeof pred.actual_away_score === "number";
              const pts = hasActual
                ? pred.awarded_points ??
                  calcPredictionPoints(
                    pred.home_score,
                    pred.away_score,
                    pred.actual_home_score!,
                    pred.actual_away_score!
                  )
                : null;

              return (
                <div
                  key={pred.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#02274c] truncate">
                      {pred.players?.full_name || "Sporcu"}
                      {pred.players?.jersey_number ? ` (#${pred.players.jersey_number})` : ""}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {pred.match_title}
                      {pred.first_scorer_name
                        ? ` • Gol: ${pred.first_scorer_name}${
                            typeof pred.scorer_multiplier === "number"
                              ? ` (x${pred.scorer_multiplier.toFixed(2)})`
                              : ""
                          }`
                        : ""}
                      {pts !== null ? ` • +${pts}p` : ""}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 px-2.5 py-1 rounded-lg bg-[#02274c] text-white text-xs font-black">
                    {pred.home_score} - {pred.away_score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}