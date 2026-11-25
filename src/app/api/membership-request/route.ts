import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcAgeGroupFromBirthDate } from "@/lib/club-utils";
import { sinirla, sinirYaniti, istemciIp } from "@/lib/rate-limit";

// Alan boyutu kuralı — aşırı uzun başvurular reddedilir
const KISIT = {
  adSoyad: 100,
  telefon: 24,
  veli: 100,
  not: 500,
  mevki: 60,
  yasGrubu: 40,
} as const;

export async function POST(req: NextRequest) {
  try {
    // Spam/bot koruması: IP başına 10 dakikada en fazla 5 başvuru
    const sinir = sinirla(`uyelik:${istemciIp(req)}`, 5, 10 * 60_000);
    if (!sinir.izinli) {
      return sinirYaniti(
        sinir,
        "Çok fazla başvuru gönderildi. Lütfen birkaç dakika sonra tekrar deneyin."
      );
    }

    const supabase = createServerSupabaseClient();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Geçersiz başvuru verisi." },
        { status: 400 }
      );
    }

    const fullName = String(body.full_name || "").trim().slice(0, KISIT.adSoyad);
    const parentPhone = String(body.parent_phone || "").trim().slice(0, KISIT.telefon);

    if (!fullName || !parentPhone) {
      return NextResponse.json(
        { ok: false, error: "Ad Soyad ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    // Telefon en az 7 hane içermeli; yalnızca rakam/+/parantez/boşluk/tire
    if (!/^[+()\d\s-]{7,24}$/.test(parentPhone)) {
      return NextResponse.json(
        { ok: false, error: "Telefon numarası geçerli değil." },
        { status: 400 }
      );
    }

    const birthDate = body.birth_date
      ? String(body.birth_date).trim().slice(0, 24)
      : null;

    // Doğuştan yanlış tarih girdisini engelle (YYYY-MM-DD veya GG.AA.YYYY)
    if (birthDate && !/^(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})$/.test(birthDate)) {
      return NextResponse.json(
        { ok: false, error: "Doğum tarihi biçimi geçersiz." },
        { status: 400 }
      );
    }

    const explicitGroup =
      typeof body.age_group === "string" && body.age_group.trim()
        ? body.age_group.trim().slice(0, KISIT.yasGrubu)
        : "";
    const ageGroup =
      explicitGroup || calcAgeGroupFromBirthDate(birthDate || "");
    const nowIso = new Date().toISOString(); // sunucu saati — istemci saatine güvenilemez

    const notesParts: string[] = [];
    if (body.guardian_name && String(body.guardian_name).trim()) {
      notesParts.push(`Veli: ${String(body.guardian_name).trim().slice(0, KISIT.veli)}`);
    }
    if (body.notes && String(body.notes).trim()) {
      notesParts.push(String(body.notes).trim().slice(0, KISIT.not));
    }

    const { error: insertErr } = await supabase.from("membership_requests").insert({
      full_name: fullName,
      birth_date: birthDate,
      age_group: ageGroup,
      parent_phone: parentPhone,
      position: body.position ? String(body.position).trim().slice(0, KISIT.mevki) : null,
      notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
      status: "bekliyor",
      created_at: nowIso,
    });

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: insertErr.message },
        { status: 500 }
      );
    }

    await supabase.from("activity_logs").insert({
      actor: fullName,
      action: "Üyelik Talebi",
      details: `${fullName} (${ageGroup} • ${parentPhone}) üyelik talebi gönderdi.`,
      created_at: nowIso,
    });

    let pushSentCount = 0;
    const { data: tokens } = await supabase
      .from("admin_push_tokens")
      .select("expo_push_token");

    if (tokens && tokens.length > 0) {
      const messages = tokens
        .map((t: { expo_push_token?: string | null }) => t.expo_push_token)
        .filter((tok): tok is string => Boolean(tok))
        .map((to) => ({
          to,
          sound: "default",
          title: "🆕 Yeni Üyelik Talebi",
          body: `${fullName} (${ageGroup}) yeni üyelik talebi gönderdi.`,
          data: { type: "membership_request" },
        }));

      if (messages.length > 0) {
        const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messages),
        });
        if (pushRes.ok) {
          pushSentCount = messages.length;
        }
      }
    }

    return NextResponse.json({ ok: true, pushSentCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}