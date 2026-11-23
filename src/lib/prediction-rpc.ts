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
  if (!playerId || playerId === "guest") {
    return { ok: false, error: "Ödül toplamak için sporcu girişi yapmalısınız." };
  }
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

  if (rpcErr) {
    return {
      ok: false,
      error: "Ödül sunucuda doğrulanamadı: " + rpcErr.message,
    };
  }

  if (rpcData && typeof rpcData === "object") {
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

  return { ok: false, error: "Sunucudan geçersiz yanıt alındı." };
}