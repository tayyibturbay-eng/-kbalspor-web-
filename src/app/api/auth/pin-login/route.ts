import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = body?.role === "coach" ? "coach" : "player";
    const cleanCode = String(body?.code || "").trim().toUpperCase();
    const cleanPin = String(body?.pin || "").trim();
    const deviceId = String(body?.deviceId || "").trim();

    if (!cleanCode || !cleanPin) {
      return NextResponse.json(
        { ok: false, error: "Kod ve şifre alanları zorunludur." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: verified, error: rpcErr } = await supabase.rpc(
      "verify_pin_login_rpc",
      {
        p_role: role,
        p_code: cleanCode,
        p_pin: cleanPin,
      }
    );

    if (rpcErr) {
      return NextResponse.json(
        { ok: false, error: "Doğrulama servisi hatası." },
        { status: 500 }
      );
    }

    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          error:
            role === "player"
              ? "Oyuncu ID veya şifre hatalı."
              : "Antrenör kodu veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    if (role === "player") {
      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("*")
        .eq("player_code", cleanCode)
        .maybeSingle();

      if (pErr || !p) {
        return NextResponse.json(
          { ok: false, error: "Oyuncu kaydı bulunamadı." },
          { status: 404 }
        );
      }

      if (deviceId) {
        if (p.bound_device_id && p.bound_device_id !== deviceId) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Bu oyuncu hesabı başka bir cihaza bağlı. Yönetici ile iletişime geçin.",
            },
            { status: 403 }
          );
        }
        if (!p.bound_device_id) {
          await supabase
            .from("players")
            .update({ bound_device_id: deviceId })
            .eq("id", p.id);
          p.bound_device_id = deviceId;
        }
      }

      const { player_pin: _pp, pin_hash: _ph, ...safePlayer } = p;
      return NextResponse.json({ ok: true, player: safePlayer });
    }

    const { data: c, error: cErr } = await supabase
      .from("coaches")
      .select("*")
      .eq("coach_code", cleanCode)
      .maybeSingle();

    if (cErr || !c) {
      return NextResponse.json(
        { ok: false, error: "Antrenör kaydı bulunamadı." },
        { status: 404 }
      );
    }

    if (c.is_active === false) {
      return NextResponse.json(
        { ok: false, error: "Bu antrenör hesabı pasif durumda." },
        { status: 403 }
      );
    }

    const { pin: _cp, pin_hash: _ch, ...safeCoach } = c;
    return NextResponse.json({ ok: true, coach: safeCoach });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz istek." },
      { status: 400 }
    );
  }
}