import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const TR_MONTHS: Record<string, number> = {
  OCAK: 1,
  SUBAT: 2,
  ŞUBAT: 2,
  MART: 3,
  NISAN: 4,
  NİSAN: 4,
  MAYIS: 5,
  HAZIRAN: 6,
  HAZİRAN: 6,
  TEMMUZ: 7,
  AGUSTOS: 8,
  AĞUSTOS: 8,
  EYLUL: 9,
  EYLÜL: 9,
  EKIM: 10,
  EKİM: 10,
  KASIM: 11,
  ARALIK: 12,
};

function decodeHtmlBuffer(buf: ArrayBuffer, contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  const asciiPreview = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  const metaCharset = /charset=["']?([a-z0-9_-]+)/i.exec(asciiPreview)?.[1]?.toLowerCase() || "";
  const charset = metaCharset || (ct.includes("charset=") ? ct.split("charset=")[1].split(";")[0].trim() : "");

  try {
    if (charset.includes("1254") || charset.includes("8859-9") || charset.includes("turkish")) {
      return new TextDecoder("windows-1254").decode(buf);
    }
    const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (utf8Text.includes("\uFFFD")) {
      return new TextDecoder("windows-1254").decode(buf);
    }
    return utf8Text;
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

function normalizeTurkishText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDateTokenFromText(text: string): string {
  const numeric =
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/.exec(text)?.[0] ||
    /\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/.exec(text)?.[0];
  if (numeric) return numeric;

  const upper = text.toLocaleUpperCase("tr-TR");
  const trWordMatch = /\b(\d{1,2})\s+(OCAK|ŞUBAT|SUBAT|MART|NİSAN|NISAN|MAYIS|HAZİRAN|HAZIRAN|TEMMUZ|AĞUSTOS|AGUSTOS|EYLÜL|EYLUL|EKİM|EKIM|KASIM|ARALIK)\s+(\d{4})\b/.exec(
    upper
  );
  if (trWordMatch) {
    const day = trWordMatch[1].padStart(2, "0");
    const month = String(TR_MONTHS[trWordMatch[2]] || 0).padStart(2, "0");
    const year = trWordMatch[3];
    if (month !== "00") return `${day}.${month}.${year}`;
  }
  return "";
}

function parseStrictValidDate(
  rawDate: string,
  rawTime?: string | null
): { isoDate: string; eventTimestamp: number } | null {
  const trimmed = rawDate.trim();
  let year = 0;
  let month = 0;
  let day = 0;

  const trMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  const isoMatch = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(trimmed);

  if (trMatch) {
    day = Number(trMatch[1]);
    month = Number(trMatch[2]);
    year = Number(trMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  const currentYear = new Date().getFullYear();
  if (year < currentYear - 1 || year > currentYear + 2) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const checkDate = new Date(year, month - 1, day);
  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    return null;
  }

  let hours = 23;
  let minutes = 59;
  const timeMatch = /^(\d{1,2})[:.](\d{2})/.exec((rawTime || "").trim());
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      hours = h;
      minutes = m;
    }
  }

  const eventDt = new Date(year, month - 1, day, hours, minutes, 59, 999);
  if (Number.isNaN(eventDt.getTime())) return null;

  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { isoDate, eventTimestamp: eventDt.getTime() };
}

function detectAgeGroup(text: string): string {
  const upper = text.toLocaleUpperCase("tr-TR");
  const uMatch = /\b(U1[1-9])\b/.exec(upper);
  if (uMatch) return uMatch[1];
  if (upper.includes("MİNİK") || upper.includes("MINIK")) return "Minikler";
  if (
    upper.includes("SÜPER AMATÖR") ||
    upper.includes("SUPER AMATOR") ||
    upper.includes("BÜYÜKLER") ||
    /\bSAL\b/.test(upper)
  ) {
    return "Çorum Süper Amatör Ligi";
  }
  return "U15";
}

function extractMatchesFromHtml(html: string) {
  const rowMatches = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  const found: Array<{
    title: string;
    age_group: string;
    event_date: string;
    match_time: string | null;
    location: string | null;
  }> = [];

  const nowTs = Date.now();
  let currentDateToken = "";
  let currentLeagueContext = "";
  let currentHeaderLocation = "";

  for (const rm of rowMatches) {
    const rowHtml = rm[1];
    const cells = Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
      (c) => normalizeTurkishText(c[1])
    );
    const joined = cells.length > 0 ? cells.join(" | ") : normalizeTurkishText(rowHtml);
    if (!joined) continue;

    const upperJoined = joined.toLocaleUpperCase("tr-TR");
    if (
      upperJoined.includes("LİGİ") ||
      upperJoined.includes("LIGI") ||
      upperJoined.includes("KÜME") ||
      /\bU1[1-9]\b/.test(upperJoined)
    ) {
      if (!upperJoined.includes("İKBAL") && !upperJoined.includes("IKBAL")) {
        currentLeagueContext = joined;
      }
    }

    const headerDate = extractDateTokenFromText(joined);
    if (headerDate && cells.length <= 2) {
      currentDateToken = headerDate;
      const locMatch = /[-—]\s*([^|]+(?:SAHA|TESİS|STAD)[^|]*)/i.exec(joined);
      currentHeaderLocation = locMatch ? locMatch[1].trim() : "";
    }

    const lower = joined.toLocaleLowerCase("tr-TR");
    if (!lower.includes("ikbal")) continue;

    const rowDateToken = headerDate || currentDateToken;
    const rawTimeMatch = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(joined);
    const timeToken = rawTimeMatch
      ? `${rawTimeMatch[1].padStart(2, "0")}:${rawTimeMatch[2]}`
      : null;

    const parsed = parseStrictValidDate(rowDateToken, timeToken);
    if (!parsed) continue;
    if (parsed.eventTimestamp < nowTs) continue;

    const nonDateTimeCells = cells.filter(
      (c) =>
        c &&
        !extractDateTokenFromText(c) &&
        !/^([01]?\d|2[0-3])[:.]([0-5]\d)$/.test(c) &&
        !/^U1[1-9]$/i.test(c)
    );

    const ikbalIdx = nonDateTimeCells.findIndex((c) =>
      c.toLocaleLowerCase("tr-TR").includes("ikbal")
    );

    let title = "";
    let location = currentHeaderLocation || "";

    if (ikbalIdx >= 0 && nonDateTimeCells.length >= 2) {
      const prevCell = nonDateTimeCells[ikbalIdx - 1];
      const nextCell = nonDateTimeCells[ikbalIdx + 1];
      const looksLikeField = (s?: string) =>
        Boolean(
          s &&
            /^(nazmi|itfaiye|devane|mimar|sungurlu|osmancık|iskilip|alaca|bayat|mecitözü|kargı|ortaköy|laçin|uğurludağ|dodurga|oğuzlar)/i.test(
              s
            )
        );

      if (nextCell && !looksLikeField(nextCell)) {
        title = `${nonDateTimeCells[ikbalIdx]} - ${nextCell}`;
      } else if (prevCell && !looksLikeField(prevCell)) {
        title = `${prevCell} - ${nonDateTimeCells[ikbalIdx]}`;
      } else if (prevCell && looksLikeField(prevCell) && nextCell) {
        title = `${nonDateTimeCells[ikbalIdx]} - ${nextCell}`;
      } else {
        title = nonDateTimeCells[ikbalIdx];
      }

      const fieldCandidate = nonDateTimeCells.find(
        (c, idx) =>
          idx !== ikbalIdx &&
          (looksLikeField(c) || /saha|tesis|stad|kompleks/i.test(c))
      );
      if (fieldCandidate) location = fieldCandidate;
    } else {
      title =
        nonDateTimeCells.find((c) => c.toLocaleLowerCase("tr-TR").includes("ikbal")) ||
        joined.slice(0, 120);
    }

    if (!location) location = "Nazmi Avluca Spor Tesisi";

    found.push({
      title: title.slice(0, 140),
      age_group: detectAgeGroup(`${currentLeagueContext} ${joined}`),
      event_date: parsed.isoDate,
      match_time: timeToken,
      location: location.slice(0, 140),
    });
  }

  return found;
}

async function fetchHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; status: number }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status };
  const buf = await res.arrayBuffer();
  return { ok: true, html: decodeHtmlBuffer(buf, res.headers.get("content-type")) };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      html?: string;
    };

    let htmlContent = typeof body.html === "string" ? body.html : "";
    let targetUrl =
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : "https://corumfit.org/index.asp?id=hft_prg";

    if (!htmlContent.trim()) {
      const firstRes = await fetchHtml(targetUrl);
      if (!firstRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Corumfit sayfası alınamadı (HTTP ${firstRes.status}). Gerekirse sayfa HTML içeriğini gönderebilirsiniz.`,
          },
          { status: 502 }
        );
      }
      htmlContent = firstRes.html;
    }

    let upcomingMatches = extractMatchesFromHtml(htmlContent);

    if (upcomingMatches.length === 0 && !targetUrl.includes("hf_pr_id=")) {
      const linkMatch = /href=["']([^"']*id=hft_prg&amp;hf_pr_id=\d+[^"']*|[^"']*id=hft_prg&hf_pr_id=\d+[^"']*)["']/i.exec(
        htmlContent
      );
      if (linkMatch) {
        const cleanHref = linkMatch[1].replace(/&amp;/g, "&").replace(/^\/+/, "");
        const nextUrl = cleanHref.startsWith("http")
          ? cleanHref
          : `https://corumfit.org/${cleanHref}`;
        const subRes = await fetchHtml(nextUrl);
        if (subRes.ok) {
          targetUrl = nextUrl;
          upcomingMatches = extractMatchesFromHtml(subRes.html);
        }
      }
    }

    const supabase = createServerSupabaseClient(true);

    const { data: existingRows } = await supabase
      .from("tasks_assignments")
      .select("id, title, event_date, match_time, age_group");

    const existingSet = new Set(
      (existingRows || []).map((r) => {
        const d = String(r.event_date || "").slice(0, 10);
        const t = String(r.match_time || "").trim();
        const ti = String(r.title || "").trim().toLocaleLowerCase("tr-TR");
        return `${d}|${t}|${ti}`;
      })
    );

    const toInsert = upcomingMatches
      .filter((m) => {
        const key = `${m.event_date}|${m.match_time || ""}|${m.title
          .trim()
          .toLocaleLowerCase("tr-TR")}`;
        if (existingSet.has(key)) return false;
        existingSet.add(key);
        return true;
      })
      .map((m) => ({
        title: m.title,
        task_type: "mac",
        age_group: m.age_group,
        event_date: m.event_date,
        match_time: m.match_time,
        location: m.location,
        has_shuttle: false,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("tasks_assignments")
        .insert(toInsert);

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: insErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      sourceUrl: targetUrl,
      foundUpcomingMatches: upcomingMatches.length,
      insertedCount: toInsert.length,
      insertedMatches: toInsert,
      matches: upcomingMatches,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Senkronizasyon hatası",
      },
      { status: 500 }
    );
  }
}