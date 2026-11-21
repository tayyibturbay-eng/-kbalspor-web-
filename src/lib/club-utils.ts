import { Player, TR_MONTHS } from "@/types/club";

export function formatDateTimeTR(isoStr?: string | null): string {
  const dt = isoStr ? new Date(isoStr) : new Date();
  if (isNaN(dt.getTime())) return isoStr || "-";
  return dt.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildDueMonths(): string[] {
  const startDate = new Date(2026, 10, 1); // Kasım 2026
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const list: string[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    list.push(`${TR_MONTHS[cur.getMonth()]} ${cur.getFullYear()}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return list;
}

export const DUE_MONTHS = buildDueMonths();

export function calcAgeGroupFromBirthDate(birthDate: string): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.split("-")[0], 10);
  if (isNaN(year)) return "U15";
  if (year < 2007) return "Çorum Süper Amatör Ligi";
  if (year >= 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  return "U19";
}

export function subtractHours(timeStr: string, hours: number): string {
  const [hStr, mStr] = (timeStr || "14:00").split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return timeStr || "14:00";
  const newH = (h - hours + 24) % 24;
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeTr(s: string): string {
  return (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanWaPhone(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return "9" + digits;
  return "90" + digits;
}

export function defaultPinFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "1234";
}

export function getDuplicatePlayerKeys(players: Player[]): Map<string, number> {
  const counts = new Map<string, number>();
  players.forEach((p) => {
    if (!p.birth_date) return;
    const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

export function getPlayerWarnings(
  p: Player,
  duplicateKeys: Map<string, number>
): string[] {
  const warnings: string[] = [];
  if (!p.birth_date) {
    warnings.push("Doğum tarihi eksik");
  } else {
    const yr = parseInt(p.birth_date.split("-")[0], 10);
    if (isNaN(yr) || yr < 1990 || yr > 2020) {
      warnings.push("Doğum tarihi şüpheli");
    }
  }
  const cleanName = (p.full_name || "").trim();
  if (cleanName.length < 4 || !cleanName.includes(" ") || /\d/.test(cleanName)) {
    warnings.push("İsim/Soyisim kontrol et");
  }
  if (p.birth_date) {
    const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
    if ((duplicateKeys.get(key) || 0) > 1) {
      warnings.push("Çift kayıt");
    }
  }
  return warnings;
}

export function buildSympatheticMatchMessage(t: {
  title: string;
  event_date: string;
  match_time: string;
  location: string;
  has_shuttle: boolean;
  age_group: string;
}): string {
  if (t.has_shuttle) {
    const meetTime = subtractHours(t.match_time, 2);
    return `⚽ Selam şampiyonlar! ${t.event_date} tarihindeki ${t.title} (${t.age_group}) maçımız saat ${t.match_time}'da ${t.location} sahasında. Servisimiz kalkacağı için maçtan 2 saat önce (saat ${meetTime}'da) Nazmi Avluca Spor Tesisi'nde buluşuyoruz! Kramponları ve enerjini unutma 💪🔴🔵`;
  }
  const meetTime = subtractHours(t.match_time, 1);
  return `⚽ Selam şampiyonlar! ${t.event_date} tarihindeki ${t.title} (${t.age_group}) maçımız saat ${t.match_time}'da ${t.location} sahasında. Bu maçta servis olmayacağı için maçtan 1 saat önce (saat ${meetTime}'da) doğrudan ${t.location} sahasında buluşuyoruz! Kramponları ve enerjini unutma 💪🔴🔵`;
}

export async function sendPushViaApi(
  ageGroups: string[],
  title: string,
  body: string
): Promise<{ sentCount: number; error?: string }> {
  try {
    const res = await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageGroups, title, body }),
    });
    const data = await res.json();
    return { sentCount: Number(data.sentCount) || 0, error: data.error };
  } catch (err) {
    return {
      sentCount: 0,
      error: err instanceof Error ? err.message : "Ağ hatası",
    };
  }
}