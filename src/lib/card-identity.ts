export const CARD_MOTTOS: readonly string[] = [
  "Sahada her şey takım için!",
  "Çorum'un kırmızı-lacivert ruhuyla her maça!",
  "Son düdüğe kadar vazgeçmek yok!",
  "İlk temas, doğru pas, net sonuç.",
  "Terimizin son damlasına kadar mücadele.",
  "Saha içinde tek yürek, tek hedef.",
  "Büyük maçlar soğukkanlı yüreklerle kazanılır.",
  "Her idman bir adım, her maç bir sınav.",
  "Hız, cesaret ve takım disiplini.",
  "Kalenin ve çizginin sarsılmaz bekçisi.",
  "Oyunu okuyan, skoru değiştiren anlar.",
  "Altyapıdan zirveye İkbal Spor gururu.",
] as const;

export interface StatProfile {
  pace?: number | null;
  shooting?: number | null;
  passing?: number | null;
  dribbling?: number | null;
  defending?: number | null;
  physical?: number | null;
}

/**
 * Yükseltilen özelliklere göre en az 6 farklı kart unvanı (7 unvan) üretir.
 */
export function resolveTitleByStats(stats: StatProfile): string {
  const pac = Number(stats.pace ?? 20);
  const sho = Number(stats.shooting ?? 20);
  const pas = Number(stats.passing ?? 20);
  const dri = Number(stats.dribbling ?? 20);
  const def = Number(stats.defending ?? 20);
  const phy = Number(stats.physical ?? 20);

  const vals = [pac, sho, pas, dri, def, phy];
  const maxVal = Math.max(...vals);
  const minVal = Math.min(...vals);

  if (maxVal - minVal <= 4) {
    return "Sahaların Joker'i";
  }

  if (sho >= maxVal) return "Gol Makinesi";
  if (pac >= maxVal) return "Kanat Şimşeği";
  if (pas >= maxVal) return "Orta Saha Maestrosu";
  if (dri >= maxVal) return "Saha Generali";
  if (def >= maxVal) return "Duvar Savunmacı";
  if (phy >= maxVal) return "Çelik Atlet";

  return "Gol Makinesi";
}

export function pickRandomCardMotto(seedOrId?: string): string {
  if (!CARD_MOTTOS.length) return "Sahada her şey takım için!";
  if (seedOrId) {
    let hash = 0;
    for (let i = 0; i < seedOrId.length; i++) {
      hash = (hash * 31 + seedOrId.charCodeAt(i)) >>> 0;
    }
    return CARD_MOTTOS[hash % CARD_MOTTOS.length];
  }
  const idx = Math.floor(Math.random() * CARD_MOTTOS.length);
  return CARD_MOTTOS[idx];
}