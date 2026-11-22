import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function cleanEnvValue(raw?: string): string {
  if (!raw) return "";
  return raw.trim().replace(/^["']+|["']+$/g, "").trim();
}

function getSupabaseClient() {
  const url =
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnvValue(process.env.SUPABASE_URL);
  const key =
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_ANON_KEY);

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(
      "Geçerli bir Supabase URL bulunamadı (NEXT_PUBLIC_SUPABASE_URL)."
    );
  }

  if (!key) {
    throw new Error("Supabase API anahtarı (SERVICE_ROLE veya ANON KEY) eksik.");
  }

  return createClient(url, key);
}

function decodeHtmlBuffer(buf: ArrayBuffer, contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  const asciiPreview = new TextDecoder("latin1").decode(buf.slice(0, 2048));
  const metaCharset = /charset=["']?([a-z0-9_-]+)/i.exec(asciiPreview)?.[1]?.toLowerCase();
  const charset = metaCharset || (ct.includes("charset=") ? ct.split("charset=")[1].split(";")[0].trim() : "");

  try {
    if (charset.includes("1254") || charset.includes("8859-9") || charset.includes("turkish")) {
      return new TextDecoder("windows-1254").decode(buf);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
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
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Geçerli takvim tarihini YYYY-MM-DD olarak döndürür.
 * Hatalı / bozuk tarihlerde null döner.
 */
function parseStrictValidDate(rawDate: string, rawTime?: string | null): {
  isoDate: string;
  eventTimestamp: number;
} | null {
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
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec((rawTime || "").trim());
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
  if (upper.includes("SÜPER AMATÖR") || upper.includes("SUPER AMATOR") || /\bSAL\b/.test(upper)) {
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

  for (const rm of rowMatches) {
    const rowHtml = rm[1];
    const cells = Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
      (c) => normalizeTurkishText(c[1])
    );
    const joined = cells.length > 0 ? cells.join(" | ") : normalizeTurkishText(rowHtml);
    if (!joined) continue;

    const lower = joined.toLocaleLowerCase("tr-TR");
    if (!lower.includes("ikbal")) continue;

    const dateToken =
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/.exec(joined)?.[0] ||
      /\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/.exec(joined)?.[0] ||
      "";

    const timeToken = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(joined)?.[0] || null;
    const parsed = parseStrictValidDate(dateToken, timeToken);

    if (!parsed) continue;
    if (parsed.eventTimestamp < nowTs) continue;

    const nonDateCells = cells.filter(
      (c) =>
        c &&
        !/^(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/.test(c) &&
        !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(c)
    );

    const title =
      nonDateCells.find((c) => c.toLocaleLowerCase("tr-TR").includes("ikbal")) ||
      joined.slice(0, 120);

    const location =
      nonDateCells.find(
        (c) =>
          c !== title &&
          /saha|tesis|stad|kompleks|çorum|merkez|sungurlu|osmancık|iskilip|alaca/i.test(c)
      ) || "Nazmi Avluca Spor Tesisi";

    found.push({
      title: title.slice(0, 140),
      age_group: detectAgeGroup(joined),
      event_date: parsed.isoDate,
      match_time: timeToken,
      location: location.slice(0, 140),
    });
  }

  return found;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      html?: string;
    };

    let htmlContent = typeof body.html === "string" ? body.html : "";
    const targetUrl =
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : "https://corumfit.org/index.asp?id=hft_prg";

    if (!htmlContent.trim()) {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Corumfit sayfası alınamadı (HTTP ${res.status}). Gerekirse sayfa HTML içeriğini gönderebilirsiniz.`,
          },
          { status: 502 }
        );
      }

      const buf = await res.arrayBuffer();
      htmlContent = decodeHtmlBuffer(buf, res.headers.get("content-type"));
    }

    const upcomingMatches = extractMatchesFromHtml(htmlContent);
    const supabase = getSupabaseClient();

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