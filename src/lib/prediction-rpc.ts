import type { SupabaseClient } from "@supabase/supabase-js";

export async function claimPredictionRewardSafely(
  supabase: SupabaseClient,
  params: {
    predictionId: string;
    playerId: string;
    points: number;
    currentPlayerPoints: number;
  }
): Promise<{ ok: boolean; newPoints?: number; error?: string }> {
  const { predictionId, playerId, points, currentPlayerPoints } = params;
  if (points <= 0) {
    return { ok: false, error: "Toplanacak puan bulunamadı." };
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "claim_prediction_reward_rpc",
    {
      p_prediction_id: predictionId,
      p_player_id: playerId,
      p_points: points,
    }
  );

  if (!rpcErr && rpcData && typeof rpcData === "object") {
    const res = rpcData as {
      ok?: boolean;
      error?: string;
      new_skill_points?: number;
    };
    if (res.ok) {
      return {
        ok: true,
        newPoints: Number(res.new_skill_points ?? currentPlayerPoints + points),
      };
    }
    return { ok: false, error: res.error || "Ödül toplanamadı." };
  }

  const nextPoints = Number(currentPlayerPoints) + Number(points);
  const { error: pErr } = await supabase
    .from("match_predictions")
    .update({ reward_claimed: true, awarded_points: points })
    .eq("id", predictionId)
    .eq("player_id", playerId);

  if (pErr) {
    return { ok: false, error: "Ödül kaydedilemedi: " + pErr.message };
  }

  const { error: uErr } = await supabase
    .from("players")
    .update({ skill_points: nextPoints })
    .eq("id", playerId);

  if (uErr) {
    return { ok: false, error: "Puan eklenemedi: " + uErr.message };
  }

  return { ok: true, newPoints: nextPoints };
}