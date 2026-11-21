import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase ortam değişkenleri (URL veya KEY) tanımlı değil.");
  }

  return createClient(url, key);
}

function resolveAgeGroup(
  birthDate: string | null,
  explicitGroup?: string | null
): string {
  if (explicitGroup && explicitGroup.trim()) return explicitGroup.trim();
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.slice(0, 4), 10);
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

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    const fullName = String(body.full_name || "").trim();
    const parentPhone = String(body.parent_phone || "").trim();

    if (!fullName || !parentPhone) {
      return NextResponse.json(
        { ok: false, error: "Ad Soyad ve Telefon zorunludur." },
        { status: 400 }
      );
    }

    const birthDate = body.birth_date ? String(body.birth_date).trim() : null;
    const ageGroup = resolveAgeGroup(birthDate, body.age_group);
    const nowIso = body.created_at || new Date().toISOString();

    const notesParts: string[] = [];
    if (body.guardian_name && String(body.guardian_name).trim()) {
      notesParts.push(`Veli: ${String(body.guardian_name).trim()}`);
    }
    if (body.notes && String(body.notes).trim()) {
      notesParts.push(String(body.notes).trim());
    }

    const { error: insertErr } = await supabase.from("membership_requests").insert({
      full_name: fullName,
      birth_date: birthDate,
      age_group: ageGroup,
      parent_phone: parentPhone,
      position: body.position ? String(body.position).trim() : null,
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