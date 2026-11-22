export const AGE_GROUPS = [
  "Minikler",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "Çorum Süper Amatör Ligi",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

/**
 * Yaş bilgisi 10 ve altındaysa "Minikler" döndürür;
 * aksi halde metindeki yaş kategorisini algılar.
 */
export function resolveAgeGroupByAgeOrText(
  age?: number | null,
  fallbackText = ""
): AgeGroup | string {
  if (typeof age === "number" && !Number.isNaN(age) && age <= 10) {
    return "Minikler";
  }

  const upper = fallbackText.toLocaleUpperCase("tr-TR");
  if (
    upper.includes("MİNİKLER") ||
    upper.includes("MINIKLER") ||
    /\bU10\b/.test(upper)
  ) {
    return "Minikler";
  }

  const uMatch = /\b(U1[1-9])\b/.exec(upper);
  if (uMatch) return uMatch[1];

  if (
    upper.includes("SÜPER AMATÖR") ||
    upper.includes("SUPER AMATOR") ||
    /\bSAL\b/.test(upper)
  ) {
    return "Çorum Süper Amatör Ligi";
  }

  return "Minikler";
}