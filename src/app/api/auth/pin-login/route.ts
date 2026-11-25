import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  getClientIp,
  sanitizeInput,
} from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const role = body?.role === "coach" ? "coach" : "player";
    const cleanCode = sanitizeInput(body?.code, 32).toUpperCase();
    const cleanPin = sanitizeInput(body?.pin, 16);
    const deviceId = sanitizeInput(body?.deviceId, 128);

    const rl = checkRateLimit(
      `pin:${ip}:${role}:${cleanCode || "empty"}`,
      8,
      10 * 60 * 1000
    );
    if (!rl.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Çok fazla hatalı giriş denemesi. ${rl.retryAfterSec} saniye sonra tekrar deneyin.`,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    if (!cleanCode || !cleanPin || !/^[A-Z0-9_-]{2,32}$/.test(cleanCode)) {
      return NextResponse.json(
        { ok: false, error: "Geçerli bir kod ve şifre giriniz." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: verified, error: rpcErr } = await supabase.rpc(
      "verify_pin_login_rpc",
      { p_role: role, p_code: cleanCode, p_pin: cleanPin }
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