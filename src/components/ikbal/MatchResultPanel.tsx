"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  subscribeClubLiveUpdates,
  finalizeMatchScoreSafely,
} from "@/lib/realtime-club";

const supabase = createClient();

interface MatchTaskItem {
  id: string;
  title: string;
  age_group?: string | null;
  task_type?: string | null;
  event_date?: string | null;
  match_time?: string | null;
  location?: string | null;
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
  actual_scorer_name?: string | null;
  awarded_points?: number | null;
  reward_claimed?: boolean | null;
  first_scorer_name?: string | null;
  scorer_multiplier?: number | null;
  players?: {
    full_name?: string | null;
    jersey_number?: number | null;
  } | null;
}

export function MatchResultPanel() {
  const [matches, setMatches] = useState<MatchTaskItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [selectedMatchTitle, setSelectedMatchTitle] = useState<string>("");
  const [actualHome, setActualHome] = useState<string>("0");
  const [actualAway, setActualAway] = useState<string>("0");
  const [actualScorers, setActualScorers] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const loadMatchAndPredictionData = useCallback(async () => {
    const [taskRes, predRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select("id, title, age_group, task_type, event_date, match_time, location")
        .order("event_date", { ascending: false })
        .limit(50),
      supabase
        .from("match_predictions")
        .select("*, players(full_name, jersey_number)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const taskList = (taskRes.data as MatchTaskItem[] | null) || [];
    const predList = (predRes.data as PredictionRow[] | null) || [];

    setMatches(taskList);
    setPredictions(predList);

    setSelectedMatchTitle((prev) => {
      if (prev) return prev;
      if (taskList[0]?.title) return taskList[0].title;
      return predList[0]?.match_title || "";
    });
  }, []);

  useEffect(() => {
    const isMounted = true;

    const runInitialLoad = async () => {
      const [taskRes, predRes] = await Promise.all([
        supabase
          .from("tasks_assignments")
          .select("id, title, age_group, task_type, event_date, match_time, location")
          .order("event_date", { ascending: false })
          .limit(50),
        supabase
          .from("match_predictions")
          .select("*, players(full_name, jersey_number)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (!isMounted) return;
      const taskList = (taskRes.data as MatchTaskItem[] | null) || [];
      const predList = (predRes.data as PredictionRow[] | null) || [];
      setMatches(taskList);
      setPredictions(predList);
      setSelectedMatchTitle((prev) => {
        if (prev) return prev;
        if (taskList[0]?.title) return taskList[0].title;
        return predList[0]?.match_title || "";
      });
    };

    void runInitialLoad();

    return subscribeClubLiveUpdates(
      supabase,
      () => {
        if (isMounted) {
          void loadMatchAndPredictionData();
        }
      },
      "web-match-result-panel-live"
    );
  }, [loadMatchAndPredictionData]);

  async function handleFinalizeMatch(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    const cleanTitle = selectedMatchTitle.trim();
    if (!cleanTitle) {
      setStatusMsg({
        ok: false,
        text: "Lütfen maç başlığını seçin veya girin.",
      });
      return;
    }

    const homeNum = Math.max(0, Math.min(30, parseInt(actualHome, 10) || 0));
    const awayNum = Math.max(0, Math.min(30, parseInt(actualAway, 10) || 0));

    setSaving(true);
    const res = await finalizeMatchScoreSafely(supabase, {
      matchTitle: cleanTitle,
      actualHome: homeNum,
      actualAway: awayNum,
      actualScorerName: actualScorers.trim() || null,
    });
    setSaving(false);

    if (!res.ok) {
      setStatusMsg({
        ok: false,
        text: res.error || "Maç sonucu işlenemedi.",
      });
      return;
    }

    setStatusMsg({
      ok: true,
      text: `"${cleanTitle}" (${homeNum} - ${awayNum}) sonucu işlendi. ${
        res.processedCount ?? 0
      } tahmin için puanlar güncellendi.`,
    });
    await loadMatchAndPredictionData();
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <section className="rounded-3xl bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white p-6 shadow-md">
        <span className="inline-block px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
          Çorum İkbalspor • Maç Sonucu Yönetimi
        </span>
        <h1 className="text-2xl font-black mt-2">
          Maç Sonucu &amp; Tahmin Puanlama Merkezi
        </h1>
        <p className="text-xs sm:text-sm text-slate-200 mt-1">
          Biten maçın skorunu ve gol atan oyuncuları girin; tüm sporcuların
          tahmin puanları otomatik hesaplanır.
        </p>
      </section>

      <form
        onSubmit={handleFinalizeMatch}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs"
      >
        <h2 className="text-base font-black text-[var(--text-primary)]">
          Maç Sonucunu Kesinleştir ve Puanları Hesapla
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Maç Seçimi / Başlığı
            </label>
            <input
              list="ikbal-match-options"
              type="text"
              value={selectedMatchTitle}
              onChange={(e) => setSelectedMatchTitle(e.target.value)}
              placeholder="Maç adı seçin veya yazın..."
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
            />
            <datalist id="ikbal-match-options">
              {matches.map((m) => (
                <option key={m.id} value={m.title}>
                  {m.age_group ? `${m.age_group} — ` : ""}
                  {m.title}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              İkbalspor Gol
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={actualHome}
              onChange={(e) => setActualHome(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-black text-center text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Rakip Gol
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={actualAway}
              onChange={(e) => setActualAway(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-black text-center text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            Gol Atan Oyuncu(lar) (Birden fazla ise virgülle ayırın)
          </label>
          <input
            type="text"
            value={actualScorers}
            onChange={(e) => setActualScorers(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz, Mehmet Demir"
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
          />
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              statusMsg.ok
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-extrabold cursor-pointer disabled:opacity-50"
        >
          {saving ? "Puanlar Hesaplanıyor..." : "Sonucu Kaydet & Puanları Dağıt"}
        </button>
      </form>

      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-3 shadow-xs">
        <h3 className="text-sm font-black text-[var(--text-primary)]">
          Güncel Tahmin &amp; Puan Kayıtları ({predictions.length})
        </h3>
        <div className="divide-y divide-[var(--border-subtle)]">
          {predictions.slice(0, 20).map((pr) => (
            <div
              key={pr.id}
              className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
            >
              <div>
                <span className="font-extrabold text-[var(--text-primary)]">
                  {pr.players?.full_name || "Sporcu"}
                </span>{" "}
                <span className="text-[var(--text-secondary)]">
                  • {pr.match_title} ({pr.age_group})
                </span>
                {pr.first_scorer_name && (
                  <span className="block text-[11px] text-[var(--text-muted)]">
                    Golcü Tahmini: {pr.first_scorer_name}
                    {typeof pr.scorer_multiplier === "number"
                      ? ` (x${pr.scorer_multiplier})`
                      : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white font-black text-xs">
                  Tahmin: {pr.home_score} - {pr.away_score}
                </span>
                {typeof pr.awarded_points === "number" && (
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--status-success-bg)] text-[var(--status-success-text)] font-black text-xs">
                    +{pr.awarded_points}p {pr.reward_claimed ? "(Toplandı)" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}