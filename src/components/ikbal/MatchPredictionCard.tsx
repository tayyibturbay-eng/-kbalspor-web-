"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { EASE } from "@/lib/motion";

const supabase = createClient();

// Giriş yapmış sporcunun depolanan kimliği — sekmeler arası 'storage'
// olaylarıyla canlı senkron; sunucu tarafında boş görünür (hidrasyon güvenli).
function yerelSporcuKimligiOku(): string {
  try {
    return (
      localStorage.getItem("ikbal_logged_player_id") ||
      localStorage.getItem("ikbal_player_id") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}
function yerelKimlikAboneOl(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const olay = () => cb();
  window.addEventListener("storage", olay);
  window.addEventListener("ikbal-auth-changed", olay);
  return () => {
    window.removeEventListener("storage", olay);
    window.removeEventListener("ikbal-auth-changed", olay);
  };
}
function useYerelSporcuKimligi(): string {
  return useSyncExternalStore(yerelKimlikAboneOl, yerelSporcuKimligiOku, () => "");
}

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

interface SquadPlayerRow {
  id: string;
  full_name: string;
  age_group: string;
  secondary_age_group?: string | null;
  jersey_number?: number | null;
}

interface MatchPredictionCardProps {
  playerId?: string | null;
  playerAgeGroup?: string | null;
  currentSkillPoints?: number;
  onRewardClaimed?: (pointsAdded: number) => void;
}

function formatMatchDateShort(raw?: string | null): string {
  if (!raw) return "";
  const clean = String(raw).trim().slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return clean;
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
  const [players, setPlayers] = useState<SquadPlayerRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [homeScore, setHomeScore] = useState<string>("1");
  const [awayScore, setAwayScore] = useState<string>("0");
  const [firstScorer, setFirstScorer] = useState<string>("");
  const [extraScorerIds, setExtraScorerIds] = useState<string[]>([]);
  const [showExtraSearch, setShowExtraSearch] = useState<boolean>(false);
  const [extraSearchQuery, setExtraSearchQuery] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [mRes, pRes, plRes] = await Promise.all([
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
        .limit(120),
      supabase
        .from("players")
        .select("id, full_name, age_group, secondary_age_group, jersey_number")
        .order("full_name", { ascending: true }),
    ]);

    const matchRows = ((mRes.data as MatchTaskRow[] | null) || []).filter(
      (m) => {
        const t = (m.task_type || "").toLowerCase();
        const title = (m.title || "").toLowerCase();
        return (
          t.includes("maç") ||
          t.includes("mac") ||
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
    setPlayers((plRes.data as SquadPlayerRow[] | null) || []);
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

  // Prop'tan gelen kimlik türetilir; depolamada tutulan giriş kimliği ise
  // useSyncExternalStore ile okunur — hidrasyonda sunucu boş görür, client
  // eşleşmeyi React'in kendisi çözer (efekt + setState zinciri gerekmez).
  const propId = playerId && playerId.trim() ? playerId.trim() : "";
  const depolananId = useYerelSporcuKimligi();
  const effectivePlayerId = propId || depolananId || "guest";

  const isPlayerAuthenticated = Boolean(
    (playerId && playerId.trim()) ||
      (effectivePlayerId && effectivePlayerId !== "guest")
  );

  const groupScorerOptions = useMemo(() => {
    const targetGroup = selectedMatch?.age_group || playerAgeGroup || "";
    const baseFiltered =
      !targetGroup || targetGroup === "Genel" || targetGroup === "Tümü"
        ? players
        : players.filter(
            (p) =>
              p.age_group === targetGroup ||
              p.secondary_age_group === targetGroup ||
              extraScorerIds.includes(p.id)
          );

    const scoredMatchSet = new Set<string>();
    const scorerStats = new Map<string, { count: number; lastTs: number }>();

    for (const pr of predictions) {
      if (targetGroup && pr.age_group && pr.age_group !== targetGroup) continue;
      if (pr.actual_scorer_name && pr.actual_scorer_name.trim()) {
        scoredMatchSet.add(pr.match_title);
        const key = pr.actual_scorer_name.trim().toLocaleLowerCase("tr-TR");
        const ts = pr.created_at ? new Date(pr.created_at).getTime() : 0;
        const prev = scorerStats.get(key) || { count: 0, lastTs: 0 };
        scorerStats.set(key, {
          count: prev.count + 1,
          lastTs: Math.max(prev.lastTs, Number.isNaN(ts) ? 0 : ts),
        });
      }
    }

    const isEarlySeason = scoredMatchSet.size < 2;
    const refNow = nowMs;

    return baseFiltered.map((p) => {
      if (!refNow || isEarlySeason) {
        return { ...p, multiplier: 1 as 1 | 2 | 3 };
      }
      const stat = scorerStats.get(p.full_name.trim().toLocaleLowerCase("tr-TR"));
      if (!stat || stat.count === 0) {
        return { ...p, multiplier: 3 as 1 | 2 | 3 };
      }
      const daysSinceLast = stat.lastTs
        ? (refNow - stat.lastTs) / (1000 * 60 * 60 * 24)
        : 999;

      let mult: 1 | 2 | 3 = 2;
      if (stat.count >= 3 || (stat.count >= 2 && daysSinceLast <= 14)) {
        mult = 1;
      } else if (daysSinceLast > 28) {
        mult = 3;
      }
      return { ...p, multiplier: mult };
    });
  }, [
    players,
    predictions,
    selectedMatch,
    playerAgeGroup,
    nowMs,
    extraScorerIds,
  ]);

  const searchedOutsidePlayers = useMemo(() => {
    const q = extraSearchQuery.trim().toLocaleLowerCase("tr-TR");
    const existingIds = new Set(groupScorerOptions.map((p) => p.id));
    const candidates = players.filter((p) => !existingIds.has(p.id));
    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter(
        (p) =>
          p.full_name.toLocaleLowerCase("tr-TR").includes(q) ||
          (p.age_group || "").toLocaleLowerCase("tr-TR").includes(q)
      )
      .slice(0, 8);
  }, [players, groupScorerOptions, extraSearchQuery]);

  function handlePickExtraScorer(pl: SquadPlayerRow) {
    setExtraScorerIds((prev) => (prev.includes(pl.id) ? prev : [...prev, pl.id]));
    setFirstScorer(pl.full_name);
    setExtraSearchQuery("");
    setShowExtraSearch(false);
  }

  const selectedScorerMult = useMemo(() => {
    if (!firstScorer) return 1;
    const found = groupScorerOptions.find((x) => x.full_name === firstScorer);
    return found ? found.multiplier : 1;
  }, [firstScorer, groupScorerOptions]);

  async function handleSavePrediction() {
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
        text: "Maç saati geldiği için tahmin girişi kilitlendi.",
      });
      return;
    }

    const hNum = Math.max(0, Math.min(30, parseInt(homeScore, 10) || 0));
    const aNum = Math.max(0, Math.min(30, parseInt(awayScore, 10) || 0));
    const cleanScorer = firstScorer.trim() || null;
    const multVal = cleanScorer ? selectedScorerMult : 1;
    const createdAt = new Date().toISOString();
    const tempId = `temp-pred-${Date.now()}`;
    const snapshot = predictions;

    const optimisticPred: PredictionRecord = {
      id: tempId,
      player_id: effectivePlayerId,
      age_group: selectedMatch.age_group || playerAgeGroup || "Genel",
      match_title: selectedMatch.title,
      home_score: hNum,
      away_score: aNum,
      first_scorer_name: cleanScorer,
      scorer_multiplier: multVal,
      awarded_points: 10,
      reward_claimed: false,
      created_at: createdAt,
    };

    setSaving(true);
    setPredictions((prev) => [optimisticPred, ...prev]);
    setFirstScorer("");
    setFeedback({
      ok: true,
      text: `"${selectedMatch.title}" için ${hNum}-${aNum} skor tahmininiz kaydedildi.`,
    });

    const { error } = await supabase.from("match_predictions").insert({
      player_id: optimisticPred.player_id,
      age_group: optimisticPred.age_group,
      match_title: optimisticPred.match_title,
      home_score: hNum,
      away_score: aNum,
      first_scorer_name: cleanScorer,
      scorer_multiplier: multVal,
      awarded_points: 10,
      reward_claimed: false,
      created_at: createdAt,
    });
    setSaving(false);

    if (error) {
      setPredictions(snapshot);
      setFeedback({
        ok: false,
        text: "Tahmin kaydedilemedi, geri alındı: " + error.message,
      });
      return;
    }

    await loadData();
  }

  async function handleClaimReward(pred: PredictionRecord) {
    if (pred.reward_claimed) return;
    const rewardPts = Number(pred.awarded_points ?? 10);
    const snapshot = predictions;

    setClaimingId(pred.id);
    setFeedback(null);
    setPredictions((prev) =>
      prev.map((x) => (x.id === pred.id ? { ...x, reward_claimed: true } : x))
    );

    const { data: claimRows, error: updPredErr } = await supabase
      .from("match_predictions")
      .update({ reward_claimed: true })
      .eq("id", pred.id)
      .eq("reward_claimed", false)
      .select("id");

    if (updPredErr) {
      setPredictions(snapshot);
      setClaimingId(null);
      setFeedback({
        ok: false,
        text: "Ödül güncellenemedi, geri alındı: " + updPredErr.message,
      });
      return;
    }

    if (!claimRows || claimRows.length === 0) {
      setClaimingId(null);
      setFeedback({ ok: false, text: "Bu ödül zaten aktarılmış." });
      await loadData();
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
      const { error: ptsErr } = await supabase
        .from("players")
        .update({ skill_points: currentPts + rewardPts })
        .eq("id", pred.player_id);

      if (ptsErr) {
        await supabase
          .from("match_predictions")
          .update({ reward_claimed: false })
          .eq("id", pred.id);
        setPredictions(snapshot);
        setClaimingId(null);
        setFeedback({
          ok: false,
          text: "Puanlar karta işlenemedi, geri alındı: " + ptsErr.message,
        });
        return;
      }
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
    <section className="k-artik p-4 sm:p-6 space-y-5 text-[var(--text-primary)] tabular-nums min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
        <div className="space-y-0.5 min-w-0 flex-1">
          <span className="k-koz text-[10px] text-[var(--brand-red)] block">
            Çorum İkbal Spor Kulübü • Tüm Yaş Grupları Açık
          </span>
          <h2 className="k-posta text-lg sm:text-2xl text-[var(--text-primary)] break-words">
            Maç Skor &amp; Golcü Tahmini
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Tüm maçlara tahmin yapabilir, maç saati geldiğinde kilitlenen
            ekrandan sonra ödül puanınızı kartınıza aktarabilirsiniz.
          </p>
        </div>
        <span className="k-etiket k-etiket--lacivert shrink-0">
          Aktif: {activeMatches.length} • Geçmiş: {pastMatches.length}
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSavePrediction();
        }}
        className="space-y-4 min-w-0"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
          <div className="col-span-2 min-w-0">
            <label className="k-koz text-[10px] block mb-1.5">
              Maç Seçimi (Tüm Yaş Grupları)
            </label>
            <select
              value={selectedMatch?.id || ""}
              onChange={(e) => {
                setSelectedMatchId(e.target.value);
                setFirstScorer("");
              }}
              className="k-alan font-bold min-h-[42px]"
            >
              {activeMatches.length === 0 ? (
                <option value="">Şu an 24 saat içinde aktif maç yok</option>
              ) : (
                activeMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.age_group || "Genel"}] {m.title}
                    {m.event_date ? ` • ${formatMatchDateShort(m.event_date)}` : ""}
                    {m.match_time ? ` ${String(m.match_time).slice(0, 5)}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="min-w-0">
            <label className="k-koz text-[10px] block mb-1.5 truncate">
              İkbal Spor Skor
            </label>
            <input
              type="number"
              min={0}
              max={30}
              disabled={lockedByTime || !selectedMatch}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="k-alan font-black text-center text-base min-h-[42px]"
            />
          </div>

          <div className="min-w-0">
            <label className="k-koz text-[10px] block mb-1.5 truncate">
              Rakip Skor
            </label>
            <input
              type="number"
              min={0}
              max={30}
              disabled={lockedByTime || !selectedMatch}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="k-alan font-black text-center text-base min-h-[42px]"
            />
          </div>
        </div>

        <div className="space-y-2.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="k-koz text-[10px]">
              İlk Golü Kim Atar? ({selectedMatch?.age_group || "Kadro"} Oyuncuları &amp; Çarpanlar)
            </label>
            {firstScorer && (
              <button
                type="button"
                onClick={() => setFirstScorer("")}
                className="text-[11px] font-extrabold text-[var(--brand-red)] hover:underline cursor-pointer"
              >
                Seçimi Temizle ({firstScorer} • {selectedScorerMult}x)
              </button>
            )}
          </div>

          {groupScorerOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
              Bu yaş grubunda kayıtlı oyuncu bulunamadı.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groupScorerOptions.map((pl) => {
                const selected = firstScorer === pl.full_name;
                return (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    key={pl.id}
                    type="button"
                    disabled={lockedByTime || !selectedMatch}
                    onClick={() =>
                      setFirstScorer(selected ? "" : pl.full_name)
                    }
                    className={`inline-flex items-center gap-2 min-h-[38px] px-3 py-2 rounded-xl border text-xs font-extrabold transition cursor-pointer disabled:opacity-50 max-w-full ${
                      selected
                        ? "bg-[var(--brand-red)] border-[var(--brand-red)] text-white shadow-xs"
                        : "bg-[var(--bg-subtle)] border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--brand-navy)]"
                    }`}
                  >
                    <span className="truncate">
                      {pl.jersey_number ? `#${pl.jersey_number} ` : ""}
                      {pl.full_name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                        selected
                          ? "bg-white/20 text-white"
                          : pl.multiplier === 3
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : pl.multiplier === 2
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-[var(--brand-navy-soft)] text-[var(--brand-ink)]"
                      }`}
                    >
                      {pl.multiplier}x
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              disabled={lockedByTime || !selectedMatch}
              onClick={() => setShowExtraSearch((prev) => !prev)}
              className="k-buton k-buton--hayalet min-h-[38px] !py-1.5 !px-3 !text-xs"
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

            <AnimatePresence initial={false}>
              {showExtraSearch && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: EASE.yumusak }}
                  className="mt-2 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3 space-y-2"
                >
                  <input
                    type="text"
                    value={extraSearchQuery}
                    onChange={(e) => setExtraSearchQuery(e.target.value)}
                    placeholder="Oyuncu adı veya yaş grubu ara..."
                    className="k-alan text-xs sm:text-sm min-h-[40px]"
                  />
                  <div className="max-h-40 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                    {searchedOutsidePlayers.length === 0 ? (
                      <div className="py-2 text-xs text-[var(--text-muted)]">
                        Eşleşen başka oyuncu bulunamadı.
                      </div>
                    ) : (
                      searchedOutsidePlayers.map((op) => (
                        <div
                          key={op.id}
                          className="py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                        >
                          <span className="font-bold text-[var(--text-primary)] truncate">
                            {op.full_name}{" "}
                            <span className="text-[var(--text-muted)]">
                              ({op.age_group})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handlePickExtraScorer(op)}
                            className="k-buton k-buton--kirmizi min-h-[32px] !py-1 !px-2.5 !text-[11px] shrink-0"
                          >
                            + Seç
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {lockedByTime && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold">
            🔒 Maç saati geldiği için tahmin girişi kilitlendi.
          </div>
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE.yumusak }}
              className={`p-3.5 rounded-2xl text-xs font-extrabold ${
                feedback.ok
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                  : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
              }`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {!isPlayerAuthenticated ? (
          <Link
            href="/sporcu"
            className="k-buton k-buton--kirmizi w-full min-h-[44px] !py-3 !text-sm"
          >
            Tahmin için Sporcu Girişi Yapın
          </Link>
        ) : lockedByTime ? (
          <div className="w-full min-h-[44px] py-3.5 px-4 rounded-2xl bg-[var(--bg-subtle)] text-[var(--status-danger-text)] border border-[var(--status-danger-text)]/35 text-center text-xs sm:text-sm font-black">
            🔒 Maç saati geldiği için tahmin girişi kilitlendi.
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={saving || !selectedMatch}
            onClick={() => {
              void handleSavePrediction();
            }}
            className="k-buton k-buton--kirmizi w-full min-h-[44px] !py-3.5 !text-sm"
          >
            {saving ? "Kaydediliyor..." : "Skor & Golcü Tahminini Kaydet"}
          </motion.button>
        )}
      </form>

      <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)] min-w-0">
        <span className="k-koz text-[10px] block">TAHMİN GEÇMİŞİ</span>
        <h3 className="k-posta text-lg text-[var(--text-primary)]">
          Tahminlerim &amp; Ödül Aktarımı
        </h3>
        {predictions.filter(
          (p) =>
            !isPlayerAuthenticated ||
            effectivePlayerId === "guest" ||
            p.player_id === effectivePlayerId
        ).length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Henüz kayıtlı tahmin bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2">
            {predictions
              .filter(
                (p) =>
                  !isPlayerAuthenticated ||
                  effectivePlayerId === "guest" ||
                  p.player_id === effectivePlayerId
              )
              .slice(0, 8)
              .map((pred) => (
                <div
                  key={pred.id}
                  className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[var(--text-primary)] break-words">
                      {pred.match_title} ({pred.home_score} - {pred.away_score})
                    </div>
                    <div className="text-[var(--text-secondary)] mt-0.5 break-words">
                      {pred.age_group}
                      {pred.first_scorer_name
                        ? ` • Golcü: ${pred.first_scorer_name} (${Math.round(
                            Number(pred.scorer_multiplier ?? 1)
                          )}x)`
                        : ""}
                      {` • Ödül: +${pred.awarded_points ?? 10} Puan`}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      Boolean(pred.reward_claimed) || claimingId === pred.id
                    }
                    onClick={() => void handleClaimReward(pred)}
                    className={`min-h-[36px] px-3.5 py-2 rounded-xl font-extrabold text-xs transition shrink-0 ${
                      pred.reward_claimed
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-default"
                        : "k-buton k-buton--lacivert !py-2 !px-3.5"
                    }`}
                  >
                    {pred.reward_claimed
                      ? "Kartına Aktarıldı ✓"
                      : claimingId === pred.id
                      ? "Aktarılıyor..."
                      : "Ödülü Karta Aktar"}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}