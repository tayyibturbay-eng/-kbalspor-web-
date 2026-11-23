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
 * Doğum tarihinden bulunduğumuz yıla göre dinamik yaş grubu hesaplar.
 * Örn: 2026 yılında yaşı 11 olan (2015 doğumlu) sporcu -> U11
 */
export function calcAgeGroupFromBirthDate(
  birthDate?: string | null,
  referenceYear = new Date().getFullYear()
): AgeGroup {
  if (!birthDate) return "Minikler";
  const birthYear = parseInt(birthDate.slice(0, 4), 10);
  if (Number.isNaN(birthYear)) return "Minikler";

  const age = referenceYear - birthYear;
  if (age <= 10) return "Minikler";
  if (age >= 20) return "Çorum Süper Amatör Ligi";

  const candidate = `U${age}` as AgeGroup;
  return AGE_GROUPS.includes(candidate) ? candidate : "Minikler";
}

export function resolveAgeGroupByAgeOrText(
  age?: number | null,
  fallbackText = ""
): AgeGroup {
  if (typeof age === "number" && !Number.isNaN(age)) {
    if (age <= 10) return "Minikler";
    if (age >= 20) return "Çorum Süper Amatör Ligi";
    const match = `U${age}` as AgeGroup;
    if (AGE_GROUPS.includes(match)) return match;
  }

  const upper = fallbackText.toLocaleUpperCase("tr-TR");
  if (upper.includes("MİNİKLER") || upper.includes("MINIKLER") || /\bU10\b/.test(upper)) {
    return "Minikler";
  }

  const uMatch = /\b(U1[1-9])\b/.exec(upper);
  if (uMatch && AGE_GROUPS.includes(uMatch[1] as AgeGroup)) {
    return uMatch[1] as AgeGroup;
  }

  if (
    upper.includes("SÜPER AMATÖR") ||
    upper.includes("SUPER AMATOR") ||
    /\bSAL\b/.test(upper)
  ) {
    return "Çorum Süper Amatör Ligi";
  }

  return "Minikler";
}