import type { SupabaseClient } from "@supabase/supabase-js";

export function subscribeClubLiveUpdates(
  supabase: SupabaseClient,
  onAnyChange: () => void,
  channelName = "ikbalspor-live-sync"
): () => void {
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "club_messages" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prayer_attendance" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks_assignments" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_predictions" },
      () => onAnyChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players" },
      () => onAnyChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function finalizeMatchScoreSafely(
  supabase: SupabaseClient,
  params: {
    matchTitle: string;
    actualHome: number;
    actualAway: number;
    actualScorerName?: string | null;
  }
): Promise<{ ok: boolean; processedCount?: number; error?: string }> {
  const { matchTitle, actualHome, actualAway, actualScorerName = null } = params;
  const cleanTitle = matchTitle.trim();
  if (!cleanTitle) {
    return { ok: false, error: "Maç başlığı zorunludur." };
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "finalize_match_score_rpc",
    {
      p_match_title: cleanTitle,
      p_actual_home: actualHome,
      p_actual_away: actualAway,
      p_actual_scorer_name: actualScorerName,
    }
  );

  if (!rpcErr && rpcData && typeof rpcData === "object") {
    const res = rpcData as {
      ok?: boolean;
      error?: string;
      processed_predictions?: number;
    };
    if (res.ok) {
      return {
        ok: true,
        processedCount: Number(res.processed_predictions ?? 0),
      };
    }
    return { ok: false, error: res.error || "Maç sonucu işlenemedi." };
  }

  const { data: rows, error: selErr } = await supabase
    .from("match_predictions")
    .select("*")
    .eq("match_title", cleanTitle);

  if (selErr) {
    return { ok: false, error: "Tahminler okunamadı: " + selErr.message };
  }

  const list = (rows || []) as Array<{
    id: string;
    home_score: number;
    away_score: number;
    first_scorer_name?: string | null;
    scorer_multiplier?: number | null;
  }>;

  const actOutcome =
    actualHome > actualAway ? "H" : actualHome < actualAway ? "A" : "D";

  for (const row of list) {
    const homeOk = row.home_score === actualHome;
    const awayOk = row.away_score === actualAway;
    const predOutcome =
      row.home_score > row.away_score
        ? "H"
        : row.home_score < row.away_score
        ? "A"
        : "D";

    const mult =
      row.scorer_multiplier === 1 ||
      row.scorer_multiplier === 2 ||
      row.scorer_multiplier === 3
        ? row.scorer_multiplier
        : 1;

    const scorerOk = Boolean(
      actualScorerName &&
        row.first_scorer_name &&
        actualScorerName
          .split(",")
          .some(
            (tok) =>
              tok.trim().toLowerCase() ===
              row.first_scorer_name!.trim().toLowerCase()
          )
    );

    let pts = 0;
    if (homeOk) pts += 1;
    if (awayOk) pts += 1;
    if (predOutcome === actOutcome) pts += 3;
    if (homeOk && awayOk) pts += 5;
    if (scorerOk) pts += mult;

    const { error: updErr } = await supabase
      .from("match_predictions")
      .update({
        actual_home_score: actualHome,
        actual_away_score: actualAway,
        actual_scorer_name: actualScorerName,
        awarded_points: pts,
      })
      .eq("id", row.id);

    if (updErr) {
      return { ok: false, error: "Puan güncellenemedi: " + updErr.message };
    }
  }

  return { ok: true, processedCount: list.length };
}