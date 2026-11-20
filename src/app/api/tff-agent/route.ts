import { NextRequest, NextResponse } from "next/server";

function decodeHtml(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function turkishDateToIso(trDate: string): string {
  const m = trDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function fetchTffProfileById(kisiId: string) {
  const url = `https://www.tff.org/Default.aspx?pageID=30&kisiID=${encodeURIComponent(kisiId)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`TFF sunucusu yanıt vermedi (HTTP ${res.status})`);
  }

  const html = await res.text();
  if (html.includes("Access Denied") || html.includes("cf-browser-verification")) {
    throw new Error("TFF güvenlik duvarı otomatik isteği engelledi.");
  }

  const text = decodeHtml(html);

  const titleMatch = html.match(/<title>([^<-]+)/i);
  const nameFromLabel = html.match(/id="[^"]*lblAdiSoyadi[^"]*"[^>]*>([^<]+)</i);
  const fullName = decodeHtml(nameFromLabel?.[1] || titleMatch?.[1] || "").replace(/Futbolcu Bilgileri.*/i, "").trim();

  const birthMatch =
    html.match(/Doğum Tarihi[\s\S]{0,250}?(\d{1,2}\.\d{1,2}\.\d{4})/i) ||
    text.match(/Doğum Tarihi\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
  const birthDate = birthMatch ? turkishDateToIso(birthMatch[1]) : "";

  const licenseMatch =
    html.match(/Lisans No[\s\S]{0,200}?>\s*(\d{5,12})\s*</i) ||
    text.match(/Lisans No\s*:?\s*(\d{5,12})/i);
  const licenseNo = licenseMatch ? licenseMatch[1] : "";

  const clubMatch =
    html.match(/Kulüp[\s\S]{0,250}?<a[^>]*>([^<]+)<\/a>/i) ||
    text.match(/Mevcut Kulüp\s*:?\s*([A-ZÇĞİÖŞÜ0-9\s.\-]+?)(?:Doğum|Lisans|Uyruk|$)/i);
  const club = clubMatch ? decodeHtml(clubMatch[1]) : "";

  const placeMatch = text.match(/Doğum Yeri\s*:?\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s\/-]+?)(?:Doğum Tarihi|Uyruk|$)/i);
  const birthPlace = placeMatch ? placeMatch[1].trim() : "";

  return {
    tff_kisi_id: kisiId,
    full_name: fullName,
    birth_date: birthDate,
    license_no: licenseNo,
    club,
    birth_place: birthPlace,
    profile_url: url,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, query, kisiIdOrUrl } = body as {
      action: "profile" | "search";
      query?: string;
      kisiIdOrUrl?: string;
    };

    if (action === "profile" && kisiIdOrUrl) {
      const idMatch = kisiIdOrUrl.match(/kisiID=(\d+)/i) || kisiIdOrUrl.match(/^(\d{4,12})$/);
      if (!idMatch) {
        return NextResponse.json(
          { ok: false, error: "Geçerli bir TFF kisiID numarası veya TFF oyuncu linki girin." },
          { status: 400 }
        );
      }
      const profile = await fetchTffProfileById(idMatch[1]);
      return NextResponse.json({ ok: true, results: [profile] });
    }

    if (action === "search" && query) {
      const searchPageUrl = "https://www.tff.org/default.aspx?pageID=130";
      const initRes = await fetch(searchPageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!initRes.ok) {
        return NextResponse.json({
          ok: false,
          blocked: true,
          error: `TFF arama sayfasına ulaşılamadı (HTTP ${initRes.status}). 'TFF Metni Yapıştır' yöntemini kullanabilirsiniz.`,
        });
      }

      const initHtml = await initRes.text();
      const viewState = initHtml.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/i)?.[1] || "";
      const viewStateGen = initHtml.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/i)?.[1] || "";
      const eventVal = initHtml.match(/name="__EVENTVALIDATION"[^>]*value="([^"]*)"/i)?.[1] || "";

      const parts = query.trim().split(/\s+/);
      const isLicense = /^\d{5,12}$/.test(query.trim());
      const firstName = !isLicense && parts.length > 1 ? parts.slice(0, -1).join(" ") : !isLicense ? parts[0] : "";
      const lastName = !isLicense && parts.length > 1 ? parts[parts.length - 1] : "";

      const adInput =
        initHtml.match(/name="([^"]*txtAdi[^"]*)"/i)?.[1] || "ctl00$MPane$m_130_510_ctnr$m_130_510$txtAdi";
      const soyadInput =
        initHtml.match(/name="([^"]*txtSoyadi[^"]*)"/i)?.[1] || "ctl00$MPane$m_130_510_ctnr$m_130_510$txtSoyadi";
      const lisansInput =
        initHtml.match(/name="([^"]*txtLisansNo[^"]*)"/i)?.[1] || "ctl00$MPane$m_130_510_ctnr$m_130_510$txtLisansNo";
      const btnInput =
        initHtml.match(/name="([^"]*btnAra[^"]*)"/i)?.[1] || "ctl00$MPane$m_130_510_ctnr$m_130_510$btnAra";

      const form = new URLSearchParams();
      if (viewState) form.append("__VIEWSTATE", viewState);
      if (viewStateGen) form.append("__VIEWSTATEGENERATOR", viewStateGen);
      if (eventVal) form.append("__EVENTVALIDATION", eventVal);

      if (isLicense) {
        form.append(lisansInput, query.trim());
      } else {
        form.append(adInput, firstName);
        if (lastName) form.append(soyadInput, lastName);
      }
      form.append(btnInput, "Ara");

      const cookies = initRes.headers.get("set-cookie") || "";
      const postRes = await fetch(searchPageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: searchPageUrl,
          ...(cookies ? { Cookie: cookies.split(";")[0] } : {}),
        },
        body: form.toString(),
        signal: AbortSignal.timeout(12000),
      });

      const resultHtml = await postRes.text();
      const matches = [...resultHtml.matchAll(/href="[^"]*pageID=30&amp;kisiID=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi)];

      if (matches.length === 0) {
        return NextResponse.json({
          ok: false,
          blocked: true,
          error:
            "TFF üzerinden otomatik sonuç alınamadı (TFF bot koruması veya kayıt bulunamadı). Oyuncu profilini tff.org'dan açıp linki veya sayfa metnini yapıştırabilirsiniz.",
        });
      }

      const uniqueIds = Array.from(new Set(matches.map((m) => m[1]))).slice(0, 6);
      const profiles = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            return await fetchTffProfileById(id);
          } catch {
            const label = matches.find((m) => m[1] === id)?.[2] || "";
            return {
              tff_kisi_id: id,
              full_name: decodeHtml(label),
              birth_date: "",
              license_no: "",
              club: "",
              birth_place: "",
              profile_url: `https://www.tff.org/Default.aspx?pageID=30&kisiID=${id}`,
            };
          }
        })
      );

      return NextResponse.json({ ok: true, results: profiles });
    }

    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ ok: false, blocked: true, error: message }, { status: 200 });
  }
}