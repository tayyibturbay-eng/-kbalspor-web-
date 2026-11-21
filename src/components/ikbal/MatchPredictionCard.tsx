"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface MatchTaskRow {
  id: string;
  title: string;
  age_group?: string | null;
  task_type?: string | null;
  due_date?: string | null;
  created_at?: string;
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

export function MatchPredictionCard({
  playerId,
  ageGroup,
}: MatchPredictionCardProps) {
  const [matches, setMatches] = useState<MatchTaskRow[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [customMatchTitle, setCustomMatchTitle] = useState<string>("");
  const [homeScore, setHomeScore] = useState<number>(2);
  const [awayScore, setAwayScore] = useState<number>(1);
  const [firstScorer, setFirstScorer] = useState<string>("");
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const activeMatchTitle = useMemo(() => {
    if (selectedMatch === "__custom__") return customMatchTitle.trim();
    return selectedMatch.trim();
  }, [selectedMatch, customMatchTitle]);

  async function loadData() {
    const [taskRes, predRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("match_predictions")
        .select("*, players(full_name, jersey_number)")
        .eq("age_group", ageGroup)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (taskRes.data) {
      const groupMatches = (taskRes.data as MatchTaskRow[]).filter((t) => {
        const groupOk = !t.age_group || t.age_group === ageGroup;
        const isMatch =
          t.task_type === "mac" ||
          (t.title || "").toLowerCase().includes("maç");
        return groupOk && isMatch;
      });
      setMatches(groupMatches);
      if (groupMatches.length > 0 && !selectedMatch) {
        setSelectedMatch(groupMatches[0].title);
      } else if (groupMatches.length === 0 && !selectedMatch) {
        setSelectedMatch("__custom__");
      }
    }

    if (predRes.data) {
      const rows = predRes.data as PredictionRow[];
      setPredictions(rows);
      const mine = rows.find((r) => r.player_id === playerId);
      if (mine) {
        setHomeScore(mine.home_score);
        setAwayScore(mine.away_score);
        setFirstScorer(mine.first_scorer_name || "");
      }
    }
  }

  useEffect(() => {
    if (!playerId || !ageGroup) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, ageGroup]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    if (!activeMatchTitle) {
      setStatusMsg({ ok: false, text: "Lütfen bir maç seçin veya maç adını yazın." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("match_predictions").upsert(
      {
        player_id: playerId,
        age_group: ageGroup,
        match_title: activeMatchTitle,
        home_score: Math.max(0, Math.min(30, Number(homeScore) || 0)),
        away_score: Math.max(0, Math.min(30, Number(awayScore) || 0)),
        first_scorer_name: firstScorer.trim() || null,
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
      text: "Maç günü tahminin kaydedildi! (Doğru skor: +1/adet, Kazanan: +3, Tam tahmin: +5)",
    });
    await loadData();
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
            {ageGroup} • Maç Günü Tahmini
          </span>
          <h2 className="text-lg font-extrabold text-[#02274c] mt-1">
            Skor & İlk Gol Tahmini
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
            Maç Seçimi
          </label>
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
          >
            {matches.map((m) => (
              <option key={m.id} value={m.title} className="bg-white text-slate-900">
                {m.title} {m.due_date ? `(${m.due_date})` : ""}
              </option>
            ))}
            <option value="__custom__" className="bg-white text-slate-900">
              + Haftalık Maç Başlığı Gir
            </option>
          </select>
        </div>

        {selectedMatch === "__custom__" && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Maç Adı
            </label>
            <input
              type="text"
              value={customMatchTitle}
              onChange={(e) => setCustomMatchTitle(e.target.value)}
              placeholder={`Örn: İkbalspor ${ageGroup} - Rakip`}
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
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

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              İlk Gol / Öne Çıkan (Opsiyonel)
            </label>
            <input
              type="text"
              value={firstScorer}
              onChange={(e) => setFirstScorer(e.target.value)}
              placeholder="Örn: Emirhan"
              className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#02274c]"
            />
          </div>
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
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#a60513] hover:bg-red-700 text-white text-sm font-extrabold transition disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Tahminimi Kaydet"}
        </button>
      </form>

      {visiblePredictions.length > 0 && (
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <h3 className="text-xs font-extrabold uppercase text-slate-700">
            {ageGroup} Grubu Tahminleri
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
                      {pred.first_scorer_name ? ` • Gol: ${pred.first_scorer_name}` : ""}
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