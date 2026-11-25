// Kurumsal yetki katmanı — "personel (staff) oturumu" imzası.
//
// Yönetim API uçları (/api/send-push, /api/sync-corumfit-matches) artık şu
// iki meşru kapıdan biriyle kilitlidir:
//   1) Yönetici girişi: tarayıcıdaki Supabase access token'i (Bearer) —
//      sunucuda getUser() ile DOĞRULANIR, başlığı atan kişi iddia etmez.
//   2) Antrenör girişi: PIN doğrulaması başarılı olduğunda pin-login
//      rotasının httpOnly çerez olarak bastığı imzalı staff oturumu.
//
// İmza: HMAC-SHA256(payload, SESSION_SECRET). Sır boşta kalmasın diye
// SESSION_SECRET yoksa service-role anahtarından, o da yoksa anon anahtarın
// karışımından türetilir (üretimde SESSION_SECRET şarttır — .env.example).

import { createHmac, timingSafeEqual } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const STAFF_CEREZ_ADI = "ikbal_staff";
export const STAFF_OTURUM_SAAT = 12;

function gizliSir(): string {
  const s = (process.env.SESSION_SECRET || "").replace(/['"]/g, "").trim();
  if (s.length >= 16) return s;
  const svc = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/['"]/g, "").trim();
  if (svc) return `ikbal-fallback:${svc}`;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (anon) return `ikbal-anon-fallback:${anon}`;
  throw new Error("Staff oturumu için SESSION_SECRET yapılandırması eksik.");
}

function imzala(govde: string): string {
  return createHmac("sha256", gizliSir()).update(govde).digest("base64url");
}

export type StaffOturum = { r: "admin" | "coach"; c: string; exp: number };

/** Süresi dolmuş, imzalı oturum çerezi değeri üretir. */
export function staffCerezDegeriOluştur(rol: "admin" | "coach", kod: string): string {
  const payload: StaffOturum = {
    r: rol,
    c: kod.slice(0, 32),
    exp: Date.now() + STAFF_OTURUM_SAAT * 60 * 60 * 1000,
  };
  const govde = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${govde}.${imzala(govde)}`;
}

/** Çerez değerinin imzasını ve süresini doğrular. */
export function staffCerezDogrula(deger?: string): StaffOturum | null {
  if (!deger) return null;
  const nokta = deger.lastIndexOf(".");
  if (nokta <= 0) return null;
  const govde = deger.slice(0, nokta);
  const imza = deger.slice(nokta + 1);

  const beklenen = Buffer.from(imzala(govde));
  const gelen = Buffer.from(imza);
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) return null;

  try {
    const payload = JSON.parse(Buffer.from(govde, "base64url").toString("utf8")) as StaffOturum;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.r !== "admin" && payload.r !== "coach") return null;
    return payload;
  } catch {
    return null;
  }
}

export type PersonelDogrulama =
  | { ok: true; kaynak: "cookie" | "bearer"; kim: string }
  | { ok: false; durum: number; hata: string };

/**
 * İstenen isteğin yetkili bir personelden geldiğini doğrular:
 * önce imzalı staff çerezi, yoksa sunucuda doğrulanan Supabase Bearer token.
 */
export async function personeliDogrula(req: Request): Promise<PersonelDogrulama> {
  // 1) İmzalı staff çerezi (antrenör PIN girişi bunu kurar)
  const cookieHeader = req.headers.get("cookie") || "";
  const eslesme = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${STAFF_CEREZ_ADI}=`));
  const cerezDeger = eslesme ? decodeURIComponent(eslesme.slice(STAFF_CEREZ_ADI.length + 1)) : undefined;
  const cerez = staffCerezDogrula(cerezDeger);
  if (cerez) return { ok: true, kaynak: "cookie", kim: `${cerez.r}:${cerez.c}` };

  // 2) Supabase access token (yönetici e-posta/şifre girişi) — sunucuda doğrulanır
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        return { ok: true, kaynak: "bearer", kim: data.user.email || data.user.id };
      }
    } catch {
      // doğrulama başarısız → düşür
    }
  }

  return { ok: false, durum: 401, hata: "Bu işlem için yetkili kulüp personeli olmalısınız." };
}
