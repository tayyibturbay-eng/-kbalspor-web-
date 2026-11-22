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
  skill_points?: number | null;
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
  reward_claimed?: boolean | null;
  first_scorer_name: string | null;
  scorer_multiplier?: number | null;
  created_at: string;
  players?: {
    full_name?: string | null;
    jersey_number?: number | null;
    skill_points?: number | null;
  } | null;
}

interface MatchPredictionCardProps {
  playerId: string;
  ageGroup: string;
  onPointsClaimed?: (newTotalPoints: number) => void;
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

function normalizeScoreInput(raw: string): { str: string; num: number } {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (!digitsOnly) return { str: "", num: 0 };
  const stripped = digitsOnly.replace(/^0+(?=\d)/, "");
  const num = Math.max(0, Math.min(30, Number(stripped) || 0));
  return { str: String(num), num };
}

export function MatchPredictionCard({
  playerId,
  ageGroup,
  onPointsClaimed,
}: MatchPredictionCardProps) {
  const [matches, setMatches] = useState<MatchTaskRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [categoryPlayers, setCategoryPlayers] = useState<CategoryPlayerRow[]>([]);
  const [homeScore, setHomeScore] = useState<number>(2);
  const [homeScoreInput, setHomeScoreInput] = useState<string>("2");
  const [awayScore, setAwayScore] = useState<number>(1);
  const [awayScoreInput, setAwayScoreInput] = useState<string>("1");
  const [firstScorer, setFirstScorer] = useState<string>("");
  const [showOtherAgePlayers, setShowOtherAgePlayers] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
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

  const groupPlayers = useMemo(() => {
    if (!effectiveCategory || effectiveCategory === "Tümü") {
      return categoryPlayers;
    }
    const exact = categoryPlayers.filter(
      (p) => (p.age_group || "").trim() === effectiveCategory
    );
    return exact.length > 0 ? exact : categoryPlayers;
  }, [categoryPlayers, effectiveCategory]);

  const otherPlayers = useMemo(() => {
    const groupIds = new Set(groupPlayers.map((p) => p.id));
    return categoryPlayers.filter((p) => !groupIds.has(p.id));
  }, [categoryPlayers, groupPlayers]);

  const selectableScorers = useMemo(() => {
    return showOtherAgePlayers ? categoryPlayers : groupPlayers;
  }, [showOtherAgePlayers, categoryPlayers, groupPlayers]);

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
    for (const p of categoryPlayers) {
      const prevGoals = goalCounts.get(p.full_name.trim().toLowerCase()) || 0;
      map.set(p.id, calculateGoalPointsForScorer(prevGoals, false));
    }
    return map;
  }, [categoryPlayers, predictions]);

  const fetchPredictionData = useCallback(async () => {
    const [taskRes, predRes, playersRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("event_date", { ascending: true })
        .limit(40),
      supabase
        .from("match_predictions")
        .select("*, players(full_name, jersey_number, skill_points)")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("players")
        .select("id, full_name, age_group, jersey_number, skill_points")
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
          setHomeScoreInput(String(mine.home_score));
          setAwayScore(mine.away_score);
          setAwayScoreInput(String(mine.away_score));
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
    if (!groupPlayers.length) return;
    setFirstScorer((prev) => {
      if (prev && categoryPlayers.some((p) => p.full_name === prev)) return prev;
      return groupPlayers[0].full_name;
    });
  }, [groupPlayers, categoryPlayers]);

  const claimablePredictions = useMemo(() => {
    return predictions
      .filter((pred) => {
        if (pred.player_id !== playerId) return false;
        if (pred.reward_claimed === true) return false;
        const hasActual =
          typeof pred.actual_home_score === "number" &&
          typeof pred.actual_away_score === "number";
        if (!hasActual) return false;
        const pts =
          typeof pred.awarded_points === "number"
            ? pred.awarded_points
            : calcPredictionPoints(
                pred.home_score,
                pred.away_score,
                pred.actual_home_score!,
                pred.actual_away_score!
              );
        return pts > 0;
      })
      .map((pred) => {
        const pts =
          typeof pred.awarded_points === "number"
            ? pred.awarded_points
            : calcPredictionPoints(
                pred.home_score,
                pred.away_score,
                pred.actual_home_score!,
                pred.actual_away_score!
              );
        return { ...pred, earnedPts: pts };
      });
  }, [predictions, playerId]);

  async function handleClaimReward(predId: string, earnedPts: number) {
    if (!playerId || earnedPts <= 0) return;
    setClaimingId(predId);
    setStatusMsg(null);

    const currentPlayer = categoryPlayers.find((p) => p.id === playerId);
    const currentPts = Number(currentPlayer?.skill_points ?? 0);
    const nextTotalPts = currentPts + earnedPts;

    const { error: updPredErr } = await supabase
      .from("match_predictions")
      .update({ reward_claimed: true, awarded_points: earnedPts })
      .eq("id", predId)
      .eq("player_id", playerId);

    if (updPredErr) {
      setClaimingId(null);
      setStatusMsg({
        ok: false,
        text: "Ödül durumu güncellenemedi: " + updPredErr.message,
      });
      return;
    }

    const { error: updPlayerErr } = await supabase
      .from("players")
      .update({ skill_points: nextTotalPts })
      .eq("id", playerId);

    setClaimingId(null);
    if (updPlayerErr) {
      setStatusMsg({
        ok: false,
        text: "Puan eklenemedi: " + updPlayerErr.message,
      });
      return;
    }

    setCategoryPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, skill_points: nextTotalPts } : p))
    );
    setPredictions((prev) =>
      prev.map((r) =>
        r.id === predId ? { ...r, reward_claimed: true, awarded_points: earnedPts } : r
      )
    );
    onPointsClaimed?.(nextTotalPts);
    setStatusMsg({
      ok: true,
      text: `🎉 +${earnedPts} tahmin puanı toplandı! Yeni toplam puanın: ${nextTotalPts}p`,
    });
  }

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

    const chosenScorer = firstScorer.trim() || groupPlayers[0]?.full_name || null;
    const matchedPlayer = chosenScorer
      ? categoryPlayers.find((p) => p.full_name === chosenScorer)
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

      {claimablePredictions.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2.5">
          <div className="text-xs font-extrabold text-amber-950 uppercase">
            🎁 Toplanabilir Tahmin Ödüllerin Var!
          </div>
          {claimablePredictions.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-200 rounded-xl px-3.5 py-2.5"
            >
              <div>
                <p className="text-xs font-extrabold text-[#02274c]">
                  {item.match_title} ({item.home_score} - {item.away_score})
                </p>
                <p className="text-xs font-bold text-emerald-700">
                  Kazanılan Ödül: +{item.earnedPts} Puan
                </p>
              </div>
              <button
                type="button"
                disabled={claimingId === item.id}
                onClick={() => handleClaimReward(item.id, item.earnedPts)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {claimingId === item.id
                  ? "Toplanıyor..."
                  : `Ödülü Topla (+${item.earnedPts}p)`}
              </button>
            </div>
          ))}
        </div>
      )}

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
              type="text"
              inputMode="numeric"
              value={homeScoreInput}
              onFocus={() => setHomeScoreInput("")}
              onBlur={() => {
                if (homeScoreInput.trim() === "") {
                  setHomeScore(0);
                  setHomeScoreInput("0");
                }
              }}
              onChange={(e) => {
                const { str, num } = normalizeScoreInput(e.target.value);
                setHomeScoreInput(str);
                setHomeScore(num);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Rakip Gol
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={awayScoreInput}
              onFocus={() => setAwayScoreInput("")}
              onBlur={() => {
                if (awayScoreInput.trim() === "") {
                  setAwayScore(0);
                  setAwayScoreInput("0");
                }
              }}
              onChange={(e) => {
                const { str, num } = normalizeScoreInput(e.target.value);
                setAwayScoreInput(str);
                setAwayScore(num);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-extrabold text-center focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-800">
              Gol Atacak Oyuncu ({showOtherAgePlayers ? "Tüm Kategoriler" : `${effectiveCategory} Kadrosu`})
            </label>
            <div className="flex items-center gap-2">
              {otherPlayers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOtherAgePlayers((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                    showOtherAgePlayers
                      ? "bg-[#02274c] text-white border-[#02274c]"
                      : "bg-slate-100 text-[#02274c] border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {showOtherAgePlayers ? "Yalnızca Maç Grubu" : "+ Diğer Yaş Grupları"}
                </button>
              )}
              <span className="text-[11px] font-bold text-[#02274c]">
                {selectableScorers.length} oyuncu
              </span>
            </div>
          </div>

          {selectableScorers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectableScorers.map((cand) => {
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
                      {showOtherAgePlayers ? ` (${cand.age_group})` : ""}
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