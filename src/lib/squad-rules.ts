import { Player } from "@/types/club";

export type SquadPlayer = Pick<
  Player,
  | "id"
  | "player_code"
  | "full_name"
  | "age_group"
  | "birth_date"
  | "position"
  | "jersey_number"
  | "photo_url"
>;

export const SQUAD_CATEGORIES = [
  { key: "U11", label: "U11" },
  { key: "U12", label: "U12" },
  { key: "Çorum Süper Amatör Ligi-U13", label: "U13" },
  { key: "Çorum Süper Amatör Ligi-U14", label: "U14" },
  { key: "Çorum Süper Amatör Ligi-U15", label: "U15" },
  { key: "Çorum Süper Amatör Ligi-U16", label: "U16" },
  { key: "Çorum Süper Amatör Ligi-U17", label: "U17" },
  { key: "Çorum Süper Amatör Ligi-U19", label: "U19" },
  { key: "Çorum Süper Amatör Ligi-GENEL", label: "SAL" },
] as const;

export const FORMATIONS: Record<
  string,
  { label: string; group: "11" | "altyapi"; rows: { role: string; count: number }[] }
> = {
  "4-3-3": {
    label: "4-3-3 (Hücum)",
    group: "11",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1 (Modern)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Ofansif Orta", count: 3 },
      { role: "Ön Libero", count: 2 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-4-2": {
    label: "4-4-2 (Dengeli)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-4-2-elmas": {
    label: "4-4-2 (Elmas)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "On Numara", count: 1 },
      { role: "Merkez Orta", count: 2 },
      { role: "Ön Libero", count: 1 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-1-4-1": {
    label: "4-1-4-1 (Kontrollü)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Orta Saha", count: 4 },
      { role: "Ön Libero", count: 1 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-5-2": {
    label: "3-5-2 (Kanat)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 5 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-4-3": {
    label: "3-4-3 (Baskılı)",
    group: "11",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "5-3-2": {
    label: "5-3-2 (Savunma)",
    group: "11",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 5 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "5-4-1": {
    label: "5-4-1 (Kontra)",
    group: "11",
    rows: [
      { role: "Santrafor", count: 1 },
      { role: "Orta Saha", count: 4 },
      { role: "Defans", count: 5 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "2-3-1": {
    label: "2-3-1 (7'li)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 2 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-2-1": {
    label: "3-2-1 (7'li)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 2 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-1": {
    label: "3-3-1 (8'li U11/U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 1 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "2-3-2": {
    label: "2-3-2 (8'li U11/U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 2 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-2-3": {
    label: "3-2-3 (9'lu U12)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 2 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-2": {
    label: "3-3-2 (9'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "3-3-3": {
    label: "3-3-3 (10'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 3 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 3 },
      { role: "Kaleci", count: 1 },
    ],
  },
  "4-3-2": {
    label: "4-3-2 (10'lu)",
    group: "altyapi",
    rows: [
      { role: "Forvet", count: 2 },
      { role: "Orta Saha", count: 3 },
      { role: "Defans", count: 4 },
      { role: "Kaleci", count: 1 },
    ],
  },
};

export const TACTIC_PLANS = [
  "Dengeli Oyun",
  "Ön Alan Baskısı (Yüksek Pres)",
  "Topa Sahip Olma & Pas Oyunu",
  "Hızlı Kontra Atak",
  "Kanat Organizasyonu",
  "Merkezden Kilit Açma",
] as const;

export type EligibilityResult = {
  eligible: boolean;
  isQuota: boolean;
  reason?: string;
};

export function checkPlayerEligibility(
  player: SquadPlayer,
  categoryKey: string
): EligibilityResult {
  const d = player.birth_date;
  if (categoryKey === "Çorum Süper Amatör Ligi-GENEL") {
    return { eligible: true, isQuota: false };
  }
  if (!d) {
    return { eligible: false, isQuota: false, reason: "Doğum tarihi girilmemiş" };
  }

  switch (categoryKey) {
    case "Çorum Süper Amatör Ligi-U13":
      if (d >= "2013-01-01") return { eligible: true, isQuota: false };
      if (d >= "2012-10-01" && d <= "2012-12-31") {
        return { eligible: true, isQuota: true, reason: "2012 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U14":
      if (d >= "2012-01-01") return { eligible: true, isQuota: false };
      if (d >= "2011-10-01" && d <= "2011-12-31") {
        return { eligible: true, isQuota: true, reason: "2011 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U15":
      if (d >= "2011-01-01") return { eligible: true, isQuota: false };
      if (d >= "2010-10-01" && d <= "2010-12-31") {
        return { eligible: true, isQuota: true, reason: "2010 Son Çeyrek Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "Çorum Süper Amatör Ligi-U16":
      return { eligible: d >= "2010-01-01", isQuota: false };

    case "Çorum Süper Amatör Ligi-U17":
      return { eligible: d >= "2009-01-01", isQuota: false };

    case "Çorum Süper Amatör Ligi-U19":
      if (d >= "2007-01-01" && d <= "2010-12-31")
        return { eligible: true, isQuota: false };
      if (d >= "2006-01-01" && d <= "2006-12-31") {
        return { eligible: true, isQuota: true, reason: "2006 Kontenjan" };
      }
      return { eligible: false, isQuota: false };

    case "U12":
      return { eligible: d >= "2014-01-01", isQuota: false };

    case "U11":
      return { eligible: d >= "2015-01-01", isQuota: false };

    default:
      return { eligible: true, isQuota: false };
  }
}