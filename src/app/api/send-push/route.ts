import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sinirla, sinirYaniti, istemciIp } from "@/lib/rate-limit";
import { personeliDogrula } from "@/lib/staff-session";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type ExpoPushTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const DEFAULT_LOGO_URL = "https://ikbalspor.com/logo-square.png";

// Mobil uygulamanın açılışta oluşturduğu Android bildirim kanalları ile
// birebir eşleşir (App.tsx → DUYURU_KANALLARI). Sesler ve görseller bu
// kanallar üzerinden cihazda çalınır/gösterilir.
const KANAL_ONEK = "ikbal-duyuru";
const ONAYLI_SESLER = new Set(["default", "whistle_alert", "chime_soft", "urgent_horn"]);

const MAX_BASLIK = 140;
const MAX_METIN = 600;

type Govde = {
  ageGroups?: unknown;
  title?: unknown;
  body?: unknown;
  imageUrl?: unknown;
  sound?: unknown;
};

async function expoGonder(mesajlar: unknown[]): Promise<
  { ok: true; tickets: ExpoPushTicket[] } | { ok: false; durum: number }
> {
  const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(mesajlar),
  });

  if (!expoRes.ok) {
    // 400 = gövde şeması uyuşmazlığı (ör. eski Expo sürümü channelImages'i
    // tanımıyor) → çağıran daha sade biçime düşerek yeniden deneyecek.
    return { ok: false, durum: expoRes.status };
  }
  const json = (await expoRes.json().catch(() => null)) as {
    data?: ExpoPushTicket[];
  } | null;
  return { ok: true, tickets: Array.isArray(json?.data) ? json.data : [] };
}

export async function POST(req: NextRequest) {
  try {
    // Yalnızca yetkili kulüp personeli bildirim gönderebilir
    // (yönetici Supabase oturumu veya antrenör imzalı staff çerezi).
    const yetki = await personeliDogrula(req);
    if (!yetki.ok) {
      return NextResponse.json(
        { ok: false, error: yetki.hata, sentCount: 0 },
        { status: yetki.durum }
      );
    }

    // IP başına dakikada en fazla 8 gönderim isteği
    const sinir = sinirla(`push:${istemciIp(req)}`, 8, 60_000);
    if (!sinir.izinli) {
      return sinirYaniti(
        sinir,
        "Bildirim gönderimi geçici olarak sınırlandı. Az sonra tekrar deneyin."
      );
    }

    const payload = (await req.json().catch(() => null)) as Govde | null;

    const title =
      typeof payload?.title === "string" ? payload.title.slice(0, MAX_BASLIK) : "";
    const body =
      typeof payload?.body === "string" ? payload.body.slice(0, MAX_METIN) : "";

    if (!title.trim() || !body.trim()) {
      return NextResponse.json(
        { ok: false, error: "Başlık ve mesaj zorunludur.", sentCount: 0 },
        { status: 400 }
      );
    }

    const yasGruplari = Array.isArray(payload?.ageGroups)
      ? (payload.ageGroups as unknown[])
          .filter((g): g is string => typeof g === "string")
          .slice(0, 24)
      : [];

    const soundKey =
      typeof payload?.sound === "string" && ONAYLI_SESLER.has(payload.sound)
        ? payload.sound
        : "default";
    const kanalId = `${KANAL_ONEK}-${soundKey}`;

    const rawImg =
      typeof payload?.imageUrl === "string" && payload.imageUrl.trim()
        ? payload.imageUrl.trim().slice(0, 500)
        : "";
    const normalizedImg = rawImg.startsWith("/")
      ? `https://ikbalspor.com${rawImg}`
      : rawImg;
    const cleanImage =
      normalizedImg.startsWith("https://") &&
      !normalizedImg.startsWith("blob:") &&
      !normalizedImg.startsWith("data:")
        ? normalizedImg
        : DEFAULT_LOGO_URL;
    const ozelGorsel = cleanImage !== DEFAULT_LOGO_URL;

    const supabase = createServerSupabaseClient(true);

    let query = supabase
      .from("player_push_tokens")
      .select("expo_push_token, age_group");

    if (yasGruplari.length > 0 && !yasGruplari.includes("Tümü")) {
      query = query.in("age_group", yasGruplari);
    }

    const { data: tokens, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, sentCount: 0 },
        { status: 500 }
      );
    }

    const uniqueTokens = Array.from(
      new Set(
        (tokens || [])
          .map((t) => t.expo_push_token)
          .filter(
            (tk): tk is string => Boolean(tk) && tk.startsWith("ExponentPushToken")
          )
      )
    );

    if (uniqueTokens.length === 0) {
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        uyarı:
          "Kayıtlı telefon token'ı bulunamadı. Sporcuların mobil uygulamaya bildirim izniyle giriş yapması gerekir.",
      });
    }

    const tokenChunks = chunkArray(uniqueTokens, 100);
    let totalSent = 0;
    const errors: string[] = [];

    for (const chunk of tokenChunks) {
      const taban = chunk.map((token) => ({
        to: token,
        sound: "default",
        priority: "high",
        title: title.trim(),
        body: body.trim(),
        data: {
          imageUrl: cleanImage,
          sound: soundKey,
          channelId: kanalId,
          title: title.trim(),
          body: body.trim(),
        },
      }));

      // Özel ses/görsel varsa kanala bağlanır (yeni derleme cihazlarda kanal
      // mevcut); düz duyurular kanal alanı olmadan gönderilir ki ESKİ derleme
      // (kanalsız) cihazlar da bildirimini eksiksiz alsın.
      const zenginGonderim = soundKey !== "default" || ozelGorsel;
      const katmanlar: Array<() => unknown[]> = [];
      if (zenginGonderim) {
        katmanlar.push(() =>
          taban.map((m) => ({
            ...m,
            channelId: kanalId,
            ...(ozelGorsel
              ? {
                  channelImages: [{ channelId: kanalId, imageUrl: cleanImage }],
                  richContent: { image: cleanImage },
                }
              : {}),
          }))
        );
      }
      katmanlar.push(() =>
        taban.map((m) =>
          ozelGorsel ? { ...m, richContent: { image: cleanImage } } : { ...m }
        )
      );

      let sonuc:
        | { ok: true; tickets: ExpoPushTicket[] }
        | { ok: false; durum: number } = { ok: false, durum: 0 };
      for (const katman of katmanlar) {
        sonuc = await expoGonder(katman());
        if (sonuc.ok) break;
        if (sonuc.durum !== 400) break; // 400 dışında deneme boşuna
      }

      if (!sonuc.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Expo Push hatası (${sonuc.durum})`,
            sentCount: totalSent,
          },
          { status: 502 }
        );
      }

      const tickets = sonuc.tickets;
      if (tickets.length === 0) {
        totalSent += chunk.length;
      } else {
        tickets.forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            totalSent += 1;
          } else {
            const detailErr = ticket.details?.error || ticket.message || "Bilinmeyen hata";
            errors.push(`${chunk[idx]?.slice(0, 28)}...: ${detailErr}`);
          }
        });
      }
    }

    return NextResponse.json({
      ok: totalSent > 0 || errors.length === 0,
      sentCount: totalSent,
      warning: errors.length > 0 ? errors.join(" | ") : undefined,
      error: totalSent === 0 && errors.length > 0 ? errors.join(" | ") : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sunucu hatası",
        sentCount: 0,
      },
      { status: 500 }
    );
  }
}
