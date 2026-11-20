import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aimaeqouwsyftwtjdtoo.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_rV2Gq89vqhvDLCEpyUXwEg_3JaZteJU";

function calcAgeGroup(birthDate: string): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.split("-")[0], 10);
  if (isNaN(year)) return "U15";
  if (year >= 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  if (year === 2007 || year === 2008) return "U19";
  return "PGL Kadro";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, birth_date, parent_phone, position, notes } = body as {
      full_name: string;
      birth_date?: string;
      parent_phone: string;
      position?: string;
      notes?: string;
    };

    if (!full_name?.trim() || !parent_phone?.trim()) {
      return NextResponse.json({ ok: false, error: "Ad Soyad ve Telefon zorunludur." }, { status: 400 });
    }

    const age_group = calcAgeGroup(birth_date || "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: inserted, error } = await supabase
      .from("membership_requests")
      .insert({
        full_name: full_name.trim(),
        birth_date: birth_date || null,
        age_group,
        parent_phone: parent_phone.trim(),
        position: position || "Orta Saha",
        notes: notes?.trim() || null,
        status: "bekliyor",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Admin telefonlarına Expo Push Bildirimi gönder
    const { data: tokens } = await supabase.from("admin_push_tokens").select("expo_push_token");
    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t) => ({
        to: t.expo_push_token,
        sound: "default",
        title: "🆕 Yeni Üyelik Talebi!",
        body: `${full_name.trim()} (${age_group}) kulübe katılmak istiyor. Onaylamak veya silmek için dokunun.`,
        data: { type: "membership_request", requestId: inserted.id },
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, request: inserted });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}