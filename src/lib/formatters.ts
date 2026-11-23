export function formatEventDateTime(
  dateInput?: string | null,
  timeInput?: string | null
): { dateLabel: string; timeLabel: string; combinedLabel: string } {
  const rawDate = (dateInput || "").trim();
  const rawTime = (timeInput || "").trim();

  let parsedDate: Date | null = null;
  let extractedTime = "";

  if (rawDate) {
    const isoMatch = rawDate.match(
      /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i
    );
    if (isoMatch) {
      const datePart = isoMatch[1];
      if (isoMatch[2]) {
        extractedTime = isoMatch[2];
      }
      const candidate = new Date(
        rawDate.includes("T") ? rawDate : `${datePart}T12:00:00+03:00`
      );
      if (!Number.isNaN(candidate.getTime())) {
        parsedDate = candidate;
      }
    } else {
      const candidate = new Date(rawDate);
      if (!Number.isNaN(candidate.getTime())) {
        parsedDate = candidate;
      }
    }
  }

  const dateLabel = parsedDate
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Istanbul",
      }).format(parsedDate)
    : rawDate || "Tarih belirtilmedi";

  const cleanTime = (rawTime || extractedTime).slice(0, 5);
  const timeLabel = cleanTime || "";
  const combinedLabel = timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;

  return { dateLabel, timeLabel, combinedLabel };
}

export function formatShortDateTR(dateInput?: string | null): string {
  const raw = (dateInput || "").trim();
  if (!raw) return "-";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(d);
}