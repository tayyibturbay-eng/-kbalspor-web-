import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcAgeGroupFromBirthDate } from "@/lib/club-utils";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
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
    const explicitGroup =
      typeof body.age_group === "string" && body.age_group.trim()
        ? body.age_group.trim()
        : "";
    const ageGroup =
      explicitGroup || calcAgeGroupFromBirthDate(birthDate || "");
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