"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildOverallLeaderboard,
  calculateCorrectScorerGuessBonus,
  calculateGoalPointsForScorer,
  PlayerGoalStats,
} from "@/lib/goal-scoring";
import { LeaderboardPodium } from "./LeaderboardPodium";

const supabase = createClient();

interface SimplePlayer {
  id: string;
  full_name: string;
  age_group: string;
  photo_url?: string | null;
  skill_points?: number | null;
}

interface MatchTask {
  id: string;
  title: string;
  age_group: string;
  event_date: string;
  match_time?: string | null;
  location?: string | null;
}

interface GoalPredictionRecord {
  id: string;
  match_id: string;
  predictor_player_id: string;
  predicted_scorer_id: string;
  awarded_points?: number;
}

interface MatchGoalPredictionHubProps {
  isAdmin?: boolean;
  currentPlayerId?: string | null;
}

export function MatchGoalPredictionHub({
  isAdmin = false,
  currentPlayerId = null,
}: MatchGoalPredictionHubProps) {
  const [matches, setMatches] = useState<MatchTask[]>([]);
  const [players, setPlayers] = useState<SimplePlayer[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  // Kullanıcı gol tahmini state'i
  const [predictorId, setPredictorId] = useState<string>(currentPlayerId || "");
  const [predictedScorerId, setPredictedScorerId] = useState<string>("");
  const [predictions, setPredictions] = useState<GoalPredictionRecord[]>([]);

  // Admin maç gol sonuçları state'i (her gol tek tek hangi oyuncu atmış)
  const [goalScorerIds, setGoalScorerIds] = useState<string[]>([""]);
  const [playerGoalHistory, setPlayerGoalHistory] = useState<
    Record<string, number>
  >({});
  const [isFirstMatch, setIsFirstMatch] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (currentPlayerId) setPredictorId(currentPlayerId);
  }, [currentPlayerId]);

  useEffect(() => {
    (async () => {
      const [mRes, pRes] = await Promise.all([
        supabase
          .from("tasks_assignments")
          .select("id, title, age_group, event_date, match_time, location")
          .order("event_date", { ascending: false })
          .limit(30),
        supabase
          .from("players")
          .select("id, full_name, age_group, photo_url, skill_points")
          .order("full_name", { ascending: true }),
      ]);

      if (mRes.data && mRes.data.length > 0) {
        const list = mRes.data as MatchTask[];
        setMatches(list);
        setSelectedMatchId(list[0].id);
      }

      if (pRes.data && pRes.data.length > 0) {
        const pList = pRes.data as SimplePlayer[];
        setPlayers(pList);
        if (!predictorId) {
          setPredictorId(currentPlayerId || pList[0].id);
        }

        const initialHist: Record<string, number> = {};
        pList.forEach((pl) => {
          initialHist[pl.id] = 0;
        });
        setPlayerGoalHistory(initialHist);
      }
    })();
  }, [currentPlayerId, predictorId]);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );

  // Seçilen maçın yaş grubundaki oyuncular (eşleşme yoksa tüm oyuncular)
  const groupPlayers = useMemo(() => {
    if (!selectedMatch) return players;
    const byGroup = players.filter(
      (p) =>
        p.age_group === selectedMatch.age_group ||
        selectedMatch.age_group === "Tümü"
    );
    return byGroup.length > 0 ? byGroup : players;
  }, [players, selectedMatch]);

  useEffect(() => {
    if (groupPlayers.length > 0) {
      setPredictedScorerId((prev) =>
        groupPlayers.some((p) => p.id === prev) ? prev : groupPlayers[0].id
      );
      setGoalScorerIds((prev) =>
        prev.length > 0 ? prev : [groupPlayers[0].id]
      );
    }
  }, [groupPlayers]);

  function handleSavePrediction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMatch || !predictorId || !predictedScorerId) return;

    const record: GoalPredictionRecord = {
      id: `pred-${Date.now()}`,
      match_id: selectedMatch.id,
      predictor_player_id: predictorId,
      predicted_scorer_id: predictedScorerId,
    };

    setPredictions((prev) => [
      record,
      ...prev.filter(
        (x) =>
          !(
            x.match_id === selectedMatch.id &&
            x.predictor_player_id === predictorId
          )
      ),
    ]);
    const scorerName =
      players.find((p) => p.id === predictedScorerId)?.full_name || "Oyuncu";
    setStatusBanner(
      `✅ "${selectedMatch.title}" maçı için gol tahmininiz kaydedildi: ${scorerName}`
    );
  }

  function addGoalSlot() {
    const defaultId = groupPlayers[0]?.id || "";
    setGoalScorerIds((prev) => [...prev, defaultId]);
  }

  function updateGoalSlot(index: number, playerId: string) {
    setGoalScorerIds((prev) =>
      prev.map((item, idx) => (idx === index ? playerId : item))
    );
  }

  function removeGoalSlot(index: number) {
    setGoalScorerIds((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)
    );
  }

  async function handleFinalizeMatchGoals(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMatch) return;
    const validScorers = goalScorerIds.filter(Boolean);
    if (validScorers.length === 0) return;

    setSaving(true);
    try {
      const scorerPointGainMap: Record<string, number> = {};
      const nextHistory: Record<string, number> = { ...playerGoalHistory };

      // Her golü tek tek işleyerek 1-3 arası çarpan puanını hesapla
      for (const scorerId of validScorers) {
        const prevGoals = nextHistory[scorerId] || 0;
        const ptsForThisGoal = calculateGoalPointsForScorer(
          prevGoals,
          isFirstMatch
        );
        scorerPointGainMap[scorerId] = Number(
          ((scorerPointGainMap[scorerId] || 0) + ptsForThisGoal).toFixed(2)
        );
        nextHistory[scorerId] = prevGoals + 1;
      }

      setPlayerGoalHistory(nextHistory);

      // Gol atan kişiyi doğru bilen tahmincilere +1 puan ver
      const predictorBonusMap: Record<string, number> = {};
      const matchPreds = predictions.filter(
        (pr) => pr.match_id === selectedMatch.id
      );

      const updatedPreds = predictions.map((pr) => {
        if (pr.match_id !== selectedMatch.id) return pr;
        const isRight = validScorers.includes(pr.predicted_scorer_id);
        const bonus = calculateCorrectScorerGuessBonus(isRight);
        if (bonus > 0) {
          predictorBonusMap[pr.predictor_player_id] =
            (predictorBonusMap[pr.predictor_player_id] || 0) + bonus;
        }
        return { ...pr, awarded_points: bonus };
      });
      setPredictions(updatedPreds);

      // Genel (overall) puanları güncelle (tüm kategoriler aynı potada)
      const updatedPlayers = await Promise.all(
        players.map(async (pl) => {
          const currentPts = Number(pl.skill_points ?? 20);
          const scorerPts = scorerPointGainMap[pl.id] || 0;
          const guessPts = predictorBonusMap[pl.id] || 0;
          const added = Number((scorerPts + guessPts).toFixed(2));
          if (added <= 0) return pl;

          const nextPts = Number((currentPts + added).toFixed(2));
          await supabase
            .from("players")
            .update({ skill_points: nextPts })
            .eq("id", pl.id);

          return { ...pl, skill_points: nextPts };
        })
      );

      setPlayers(updatedPlayers);
      setStatusBanner(
        `🏆 ${selectedMatch.title} gol sonuçları işlendi (${validScorers.length} gol). Gol atanlara çarpan puanı, doğru tahmincilere +1 puan eklendi.`
      );
    } finally {
      setSaving(false);
    }
  }

  const overallLeaderboard = useMemo(() => {
    const stats: PlayerGoalStats[] = players.map((p) => ({
      player_id: p.id,
      full_name: p.full_name,
      age_group: p.age_group,
      photo_url: p.photo_url,
      total_goals: playerGoalHistory[p.id] || 0,
      matches_played_or_scored: playerGoalHistory[p.id] || 0,
      base_points: Number(p.skill_points ?? 20),
    }));
    return buildOverallLeaderboard(stats);
  }, [players, playerGoalHistory]);

  return (
    <div className="space-y-8 text-slate-900">
      {statusBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold flex justify-between items-center gap-3">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="underline text-xs cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Maç Seçimi & Gol Tahmini Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSavePrediction}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs"
        >
          <h3 className="text-base font-black text-[#02274c]">
            ⚽ Maç Gol Tahmini Yap
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Maç Seçin
            </label>
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.age_group}) — {m.event_date}
                </option>
              ))}
            </select>
          </div>

          {!currentPlayerId && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tahmin Yapan Kişi
              </label>
              <select
                value={predictorId}
                onChange={(e) => setPredictorId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.age_group})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Bu Maçta Kim Gol Atar? ({selectedMatch?.age_group || "Grup"} Kadrosu)
            </label>
            <select
              value={predictedScorerId}
              onChange={(e) => setPredictedScorerId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-[#02274c] bg-white"
            >
              {groupPlayers.map((gp) => (
                <option key={gp.id} value={gp.id}>
                  {gp.full_name} ({gp.age_group})
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-slate-600">
            Gol atan oyuncuyu doğru bilirseniz <strong>+1 puan</strong> kazanırsınız.
          </p>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white text-sm font-extrabold cursor-pointer"
          >
            Gol Tahminimi Kaydet
          </button>
        </form>

        {/* Admin Gol Sonucu Giriş Paneli */}
        {isAdmin ? (
          <form
            onSubmit={handleFinalizeMatchGoals}
            className="bg-white rounded-2xl border-2 border-[#02274c]/20 p-5 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-[#02274c]">
                📝 Admin: Maç Gollerini Tek Tek Gir
              </h3>
              <button
                type="button"
                onClick={addGoalSlot}
                className="px-3 py-1 rounded-lg bg-[#02274c] text-white text-xs font-extrabold cursor-pointer"
              >
                + Gol Ekle
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isFirstMatch}
                onChange={(e) => setIsFirstMatch(e.target.checked)}
              />
              İlk maç kuralı aktif (İlk maçta gol atanlar 1 puan kazandırır)
            </label>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {goalScorerIds.map((scorerId, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#a60513] w-14 shrink-0">
                    {idx + 1}. Gol
                  </span>
                  <select
                    value={scorerId}
                    onChange={(e) => updateGoalSlot(idx, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold bg-white"
                  >
                    {groupPlayers.map((gp) => (
                      <option key={gp.id} value={gp.id}>
                        {gp.full_name} ({gp.age_group})
                      </option>
                    ))}
                  </select>
                  {goalScorerIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoalSlot(idx)}
                      className="px-2.5 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-600">
              Az gol atan oyunculara yüksek çarpan (en fazla <strong>3 puan</strong>, hiç gol atmayanda 3 puan) uygulanır; tüm kategoriler tek genel sıralamada yarışır.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold cursor-pointer"
            >
              {saving ? "Puanlar İşleniyor..." : "✓ Golleri Kaydet & Genel Puanları Güncelle"}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
            <h3 className="text-base font-black text-[#02274c]">
              🏆 Genel (Overall) Puan Sistemi Nasıl Çalışır?
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              • Maçtaki golcüyü doğru tahmin ettiğinizde <strong>+1 puan</strong> kazanırsınız.
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              • Golcü çarpanı <strong>1 ile 3 puan</strong> arasındadır; hiç gol atmayan bir oyuncu gol attığında <strong>3 puan</strong> kazandırır.
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              • Kategoriler kendi içinde ayrılmadan <strong>U11 ile U17 ve diğer tüm kategoriler aynı genel sıralamada</strong> yarışır.
            </p>
          </div>
        )}
      </div>

      {/* Ortak Genel Sıralama & Podyum Kartları */}
      <LeaderboardPodium
        rankings={overallLeaderboard}
        currentPlayerId={currentPlayerId || predictorId}
      />
    </div>
  );
}