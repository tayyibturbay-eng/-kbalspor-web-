import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calcAgeGroupFromBirthDate } from "@/lib/club-utils";

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

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("5") && digits.length === 10) return "0" + digits;
  return digits;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      full_name,
      birth_date,
      parent_phone,
      notes,
      guardian_name,
      kvkk_accepted,
      consent_accepted,
    } = body;

    const cleanName = (full_name || "").trim();
    const cleanPhone = normalizePhoneDigits(parent_phone || "");

    if (cleanName.length < 3 || !cleanPhone) {
      return NextResponse.json(
        { ok: false, error: "Ad Soyad ve Telefon alanları zorunludur." },
        { status: 400 }
      );
    }

    if (!/^05\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { ok: false, error: "Lütfen geçerli bir cep telefonu numarası girin (05XX XXX XX XX)." },
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

    const supabase = createServerSupabaseClient();

    // Aynı telefon ve isimle halihazırda onay bekleyen talep var mı kontrol et
    const { data: existingPending } = await supabase
      .from("membership_requests")
      .select("id")
      .eq("parent_phone", cleanPhone)
      .ilike("full_name", cleanName)
      .eq("status", "bekliyor")
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { ok: false, error: "Bu sporcu için halihazırda onay bekleyen bir başvurunuz bulunuyor." },
        { status: 409 }
      );
    }

    const ageGroup = calcAgeGroupFromBirthDate(birth_date || "");

    const { error: insertErr } = await supabase.from("membership_requests").insert({
      full_name: cleanName,
      birth_date: birth_date || null,
      age_group: ageGroup,
      parent_phone: cleanPhone,
      position: null,
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

    try {
      const { data: tokens } = await supabase
        .from("admin_push_tokens")
        .select("expo_push_token");

      const validTokens = Array.from(
        new Set(
          (tokens || [])
            .map((t) => t.expo_push_token)
            .filter((tk): tk is string => Boolean(tk) && tk.startsWith("ExponentPushToken"))
        )
      );

      if (validTokens.length > 0) {
        const messages = validTokens.map((to) => ({
          to,
          sound: "default",
          title: "Yeni Üyelik Talebi",
          body: `${cleanName} (${ageGroup}) kulübe üyelik talebi gönderdi.`,
        }));

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messages),
        });
      }
    } catch {
      // Bildirim hatası üyelik kaydını etkilemesin
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Sunucu hatası." }, { status: 500 });
  }
}