export interface PlayerGoalStats {
  player_id: string;
  full_name: string;
  age_group: string;
  photo_url?: string | null;
  total_goals: number;
  matches_played_or_scored: number;
  base_points: number;
  total_earned_points?: number;
}

export interface RankedPlayer {
  player_id: string;
  full_name: string;
  age_group: string;
  photo_url?: string | null;
  overall_points: number;
  total_earned_points?: number;
  rank: number;
}

/**
 * Oyuncunun geçmiş gol sayısına göre 1 ile 3 puan arasında gol çarpanı üretir.
 * - Hiç gol atmayan veya ilk maçtaki düşük gol geçmişine sahip oyunculara daha yüksek puan (en fazla 3) verir.
 * - Çok gol atan oyuncuların puan çarpanı kademeli düşerek minimum 1 puana iner.
 */
export function calculateGoalPointsForScorer(
  previousGoals: number,
  isFirstMatchOfTeam = false
): number {
  if (isFirstMatchOfTeam) {
    return 1;
  }
  if (previousGoals <= 0) {
    return 3;
  }
  const raw = 3 - previousGoals * 0.5;
  return Number(Math.max(1, Math.min(3, raw)).toFixed(2));
}

/**
 * Gol atan kişiyi doğru bilen kullanıcıya +1 puan ekler.
 */
export function calculateCorrectScorerGuessBonus(isCorrectScorer: boolean): number {
  return isCorrectScorer ? 1 : 0;
}

/**
 * Kategoriler arası ayrım yapmadan (U11 ile U17 aynı sıralamada)
 * genel (overall) puana göre sıralama ve her oyuncunun sırasını hesaplar.
 */
export function buildOverallLeaderboard(
  players: PlayerGoalStats[]
): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => {
    if (b.base_points !== a.base_points) {
      return b.base_points - a.base_points;
    }
    return a.full_name.localeCompare(b.full_name, "tr-TR");
  });

  return sorted.map((p, index) => ({
    player_id: p.player_id,
    full_name: p.full_name,
    age_group: p.age_group,
    photo_url: p.photo_url,
    overall_points: p.base_points,
    total_earned_points: p.total_earned_points ?? p.base_points,
    rank: index + 1,
  }));
}