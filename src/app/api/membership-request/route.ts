import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function calcAgeGroup(birthDate: string | null): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.slice(0, 4), 10);
  if (isNaN(year)) return "U15";
  if (year < 2007) return "PGL Kadro";
  if (year <= 2008) return "U19";
  if (year === 2009) return "U17";
  if (year === 2010) return "U16";
  if (year === 2011) return "U15";
  if (year === 2012) return "U14";
  if (year === 2013) return "U13";
  if (year === 2014) return "U12";
  return "U11";
}

function isUnder18(birthDate: string | null): boolean {
  if (!birthDate) return true;
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return true;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      full_name,
      birth_date,
      parent_phone,
      position,
      notes,
      guardian_name,
      kvkk_accepted,
      consent_accepted,
    } = body;

    if (!full_name?.trim() || !parent_phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Ad Soyad ve Telefon alanları zorunludur." },
        { status: 400 }
      );
    }

    if (!kvkk_accepted || !consent_accepted) {
      return NextResponse.json(
        { ok: false, error: "KVKK Aydınlatma Metni ve Açık Rıza onayı zorunludur." },
        { status: 400 }
      );
    }

    if (isUnder18(birth_date || null) && !guardian_name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "18 yaşından küçük sporcular için Veli Ad Soyad alanı zorunludur." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ageGroup = calcAgeGroup(birth_date || null);

    const { error: insertErr } = await supabase.from("membership_requests").insert({
      full_name: full_name.trim(),
      birth_date: birth_date || null,
      age_group: ageGroup,
      parent_phone: parent_phone.trim(),
      position: position || "Orta Saha",
      notes: notes?.trim() || null,
      guardian_name: guardian_name?.trim() || null,
      kvkk_accepted: true,
      consent_accepted: true,
      kvkk_accepted_at: new Date().toISOString(),
      status: "bekliyor",
    });

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // Admin Push Bildirimi
    const { data: tokens } = await supabase
      .from("admin_push_tokens")
      .select("expo_push_token");

    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t) => ({
        to: t.expo_push_token,
        sound: "default",
        title: "Yeni Üyelik Talebi",
        body: `${full_name.trim()} (${ageGroup}) kulübe üyelik talebi gönderdi.`,
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Sunucu hatası." }, { status: 500 });
  }
}