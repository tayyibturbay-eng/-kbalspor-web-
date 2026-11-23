"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";

const supabase = createClient();

interface MatchTaskRow {
  id: string;
  title: string;
  age_group?: string | null;
  task_type?: string | null;
  event_date?: string | null;
  match_time?: string | null;
  location?: string | null;
  created_at?: string | null;
}

interface PredictionRecord {
  id: string;
  player_id: string;
  age_group: string;
  match_title: string;
  home_score: number;
  away_score: number;
  first_scorer_name?: string | null;
  scorer_multiplier?: number | null;
  actual_home_score?: number | null;
  actual_away_score?: number | null;
  actual_scorer_name?: string | null;
  awarded_points?: number | null;
  reward_claimed?: boolean | null;
  created_at?: string | null;
}

interface MatchPredictionCardProps {
  playerId?: string | null;
  playerAgeGroup?: string | null;
  onRewardClaimed?: (pointsAdded: number) => void;
}

function getMatchStartDate(match: MatchTaskRow): Date | null {
  if (!match.event_date) return null;
  const datePart = match.event_date.slice(0, 10);
  const timePart = (match.match_time || "23:59").slice(0, 5);
  const parsed = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithin24Hours(match: MatchTaskRow, nowMs: number): boolean {
  if (!nowMs) return true;
  const start = getMatchStartDate(match);
  if (!start) return true;
  const diffMs = nowMs - start.getTime();
  return diffMs <= 24 * 60 * 60 * 1000;
}

function isMatchStarted(match: MatchTaskRow, nowMs: number): boolean {
  if (!nowMs) return false;
  const start = getMatchStartDate(match);
  if (!start) return false;
  return nowMs >= start.getTime();
}

export function MatchPredictionCard({
  playerId,
  playerAgeGroup,
  onRewardClaimed,
}: MatchPredictionCardProps) {
  const [matches, setMatches] = useState<MatchTaskRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [homeScore, setHomeScore] = useState<string>("1");
  const [awayScore, setAwayScore] = useState<string>("0");
  const [firstScorer, setFirstScorer] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      supabase
        .from("tasks_assignments")
        .select(
          "id, title, age_group, task_type, event_date, match_time, location, created_at"
        )
        .order("event_date", { ascending: true })
        .limit(60),
      supabase
        .from("match_predictions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    const matchRows = ((mRes.data as MatchTaskRow[] | null) || []).filter(
      (m) => {
        const t = (m.task_type || "").toLowerCase();
        const title = (m.title || "").toLowerCase();
        return (
          t.includes("maç") ||
          t.includes("match") ||
          title.includes("maç") ||
          title.includes("vs") ||
          title.includes("-") ||
          !m.task_type
        );
      }
    );

    setMatches(matchRows);
    setPredictions((pRes.data as PredictionRecord[] | null) || []);
    setSelectedMatchId((prev) => {
      if (prev && matchRows.some((x) => x.id === prev)) return prev;
      return matchRows[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    const syncClock = () => setNowMs(Date.now());
    const initTimer = window.setTimeout(() => {
      syncClock();
      void loadData();
    }, 0);

    const clockInterval = window.setInterval(syncClock, 15000);

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadData();
      },
      "web-match-predictions-live"
    );

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(clockInterval);
      unsubscribe();
    };
  }, [loadData]);

  const activeMatches = useMemo(
    () => matches.filter((m) => isWithin24Hours(m, nowMs)),
    [matches, nowMs]
  );

  const pastMatches = useMemo(
    () => matches.filter((m) => !isWithin24Hours(m, nowMs)),
    [matches, nowMs]
  );

  const selectedMatch = useMemo(
    () =>
      activeMatches.find((m) => m.id === selectedMatchId) ||
      activeMatches[0] ||
      null,
    [activeMatches, selectedMatchId]
  );

  const lockedByTime = useMemo(
    () => (selectedMatch ? isMatchStarted(selectedMatch, nowMs) : false),
    [selectedMatch, nowMs]
  );

  const effectivePlayerId = useMemo(() => {
    if (playerId) return playerId;
    if (typeof window !== "undefined") {
      return localStorage.getItem("ikbal_logged_player_id") || "guest";
    }
    return "guest";
  }, [playerId]);

  async function handleSavePrediction(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!selectedMatch) {
      setFeedback({
        ok: false,
        text: "Tahmin yapılacak aktif bir maç bulunamadı.",
      });
      return;
    }

    if (lockedByTime) {
      setFeedback({
        ok: false,
        text: "Maç saati geldiği için bu maçın tahmin ekranı kilitlendi.",
      });
      return;
    }

    const hNum = Math.max(0, Math.min(30, parseInt(homeScore, 10) || 0));
    const aNum = Math.max(0, Math.min(30, parseInt(awayScore, 10) || 0));

    setSaving(true);
    const { error } = await supabase.from("match_predictions").insert({
      player_id: effectivePlayerId,
      age_group: selectedMatch.age_group || playerAgeGroup || "Genel",
      match_title: selectedMatch.title,
      home_score: hNum,
      away_score: aNum,
      first_scorer_name: firstScorer.trim() || null,
      scorer_multiplier: firstScorer.trim() ? 1.5 : 1,
      awarded_points: 10,
      reward_claimed: false,
      created_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      setFeedback({
        ok: false,
        text: "Tahmin kaydedilemedi: " + error.message,
      });
      return;
    }

    setFeedback({
      ok: true,
      text: `"${selectedMatch.title}" için ${hNum}-${aNum} skor tahmininiz kaydedildi.`,
    });
    setFirstScorer("");
    await loadData();
  }

  async function handleClaimReward(pred: PredictionRecord) {
    if (pred.reward_claimed) return;
    const rewardPts = Number(pred.awarded_points ?? 10);
    setClaimingId(pred.id);
    setFeedback(null);

    const { error: updPredErr } = await supabase
      .from("match_predictions")
      .update({ reward_claimed: true })
      .eq("id", pred.id);

    if (updPredErr) {
      setClaimingId(null);
      setFeedback({
        ok: false,
        text: "Ödül güncellenemedi: " + updPredErr.message,
      });
      return;
    }

    if (pred.player_id && pred.player_id !== "guest") {
      try {
        const localKey = `ikbal_player_card_${pred.player_id}`;
        const rawLocal = localStorage.getItem(localKey);
        const parsedLocal = rawLocal
          ? (JSON.parse(rawLocal) as { skill_points?: number })
          : {};
        const nextLocalPts = Number(parsedLocal.skill_points ?? 0) + rewardPts;
        localStorage.setItem(
          localKey,
          JSON.stringify({ ...parsedLocal, skill_points: nextLocalPts })
        );
      } catch {
        // yoksay
      }

      const { data: pRow } = await supabase
        .from("players")
        .select("skill_points")
        .eq("id", pred.player_id)
        .maybeSingle();

      const currentPts = Number(
        (pRow as { skill_points?: number | null } | null)?.skill_points ?? 0
      );
      await supabase
        .from("players")
        .update({ skill_points: currentPts + rewardPts })
        .eq("id", pred.player_id);
    }

    setClaimingId(null);
    onRewardClaimed?.(rewardPts);
    setFeedback({
      ok: true,
      text: `+${rewardPts} puan oyuncu kartınıza aktarıldı!`,
    });
    await loadData();
  }

  return (
    <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-xs space-y-5 text-[var(--text-primary)] tabular-nums">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-[var(--brand-red)]">
            Çorum İkbalspor • Tüm Yaş Grupları Açık
          </span>
          <h2 className="text-lg font-black text-[var(--text-primary)]">
            Maç Skor &amp; Golcü Tahmini
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Tüm maçlara tahmin yapabilir, maç saati geldiğinde kilitlenen
            ekrandan sonra ödül puanınızı kartınıza aktarabilirsiniz.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold">
          Aktif Maç: {activeMatches.length} • Geçmiş: {pastMatches.length}
        </span>
      </div>

      <form onSubmit={handleSavePrediction} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Maç Seçimi (Tüm Yaş Grupları)
            </label>
            <select
              value={selectedMatch?.id || ""}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              {activeMatches.length === 0 ? (
                <option value="">Şu an 24 saat içinde aktif maç yok</option>
              ) : (
                activeMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.age_group || "Genel"}] {m.title}{" "}
                    {m.event_date ? `(${m.event_date})` : ""}{" "}
                    {m.match_time ? m.match_time : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              İkbalspor Skor
            </label>
            <input
              type="number"
              min={0}
              max={30}
              disabled={lockedByTime || !selectedMatch}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-black text-center text-[var(--text-primary)] disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Rakip Skor
            </label>
            <input
              type="number"
              min={0}
              max={30}
              disabled={lockedByTime || !selectedMatch}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-black text-center text-[var(--text-primary)] disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            İlk Golü Kim Atar? (İsteğe Bağlı)
          </label>
          <input
            type="text"
            disabled={lockedByTime || !selectedMatch}
            value={firstScorer}
            onChange={(e) => setFirstScorer(e.target.value)}
            placeholder="Oyuncu adı yazın..."
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50"
          />
        </div>

        {lockedByTime && (
          <div className="p-3 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold">
            🔒 Maç saati geldiği için tahmin girişi kilitlendi.
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              feedback.ok
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <button
          type="button"
          disabled={saving || !selectedMatch}
          onClick={() => {
            if (lockedByTime) {
              setFeedback({
                ok: false,
                text: "🔒 Tahmin kilitli! Maç başlama saati geldiği için tahmin kaydedilemez.",
              });
              return;
            }
            const formEl = document.querySelector("form");
            if (formEl) {
              const fakeEvent = {
                preventDefault: () => {},
              } as React.FormEvent;
              void handleSavePrediction(fakeEvent);
            }
          }}
          className={`w-full py-3 rounded-2xl text-white text-sm font-black transition cursor-pointer disabled:opacity-50 ${
            lockedByTime
              ? "bg-rose-900 hover:bg-rose-800 border-2 border-rose-400"
              : "bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)]"
          }`}
        >
          {lockedByTime
            ? "🔒 Gol & Skor Tahmini Kaydet (Kilitli)"
            : saving
            ? "Kaydediliyor..."
            : "Gol & Skor Tahmini Kaydet"}
        </button>
      </form>

      {predictions.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <h3 className="text-sm font-black text-[var(--text-primary)]">
            Son Tahminler &amp; Ödül Aktarımı
          </h3>
          <div className="divide-y divide-[var(--border-subtle)]">
            {predictions.slice(0, 10).map((pr) => {
              const pts = Number(pr.awarded_points ?? 10);
              return (
                <div
                  key={pr.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div>
                    <div className="font-extrabold text-[var(--text-primary)]">
                      {pr.match_title}{" "}
                      <span className="text-xs font-bold text-[var(--brand-navy)] dark:text-sky-300">
                        ({pr.home_score} - {pr.away_score})
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {pr.age_group}
                      {pr.first_scorer_name
                        ? ` • Golcü: ${pr.first_scorer_name}`
                        : ""}{" "}
                      • Ödül: +{pts} Puan
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(pr.reward_claimed) || claimingId === pr.id}
                    onClick={() => void handleClaimReward(pr)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      pr.reward_claimed
                        ? "bg-emerald-900/30 text-emerald-300 cursor-default"
                        : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                    }`}
                  >
                    {pr.reward_claimed
                      ? "Kartına Aktarıldı ✓"
                      : claimingId === pr.id
                      ? "Aktarılıyor..."
                      : `Ödül Topla (+${pts})`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pastMatches.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
            Geçmiş Maçlar ({pastMatches.length})
          </h3>
          <div className="divide-y divide-[var(--border-subtle)]">
            {pastMatches.slice(0, 8).map((pm) => (
              <div
                key={pm.id}
                className="py-2 flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]"
              >
                <span className="font-bold">
                  {pm.title} ({pm.age_group || "Genel"})
                </span>
                <span>{pm.event_date || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}