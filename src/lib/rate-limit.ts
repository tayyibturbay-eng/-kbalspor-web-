// Kurumsal API güvenlik katmanı — kayan pencere (sliding window) sınırlayıcı.
//
// NOT: Bu uygulama tek süreçli bellekte çalışır; çok örnekli (multi-instance)
// bir dağıtımda sayaç örnek başınadır. Vercel Edge gibi sunucusuz ortamlarda
// bu koruma "en az bu kadar" garantisi verir; daha sıkı garanti için Upstash
// Redis gibi merkezi bir depo takılabilir. Uygulama mantığını bozmayan,
// kutudan çıktığı an çalışan ilk savunma hattı budur.

type Pencere = {
  adet: number;
  baslangic: number;
};

const HAVUZ = new Map<string, Pencere>();
const MAX_ANAHTAR = 10_000;

function temizle(): void {
  // Süresi dolmuş anahtarları ara ara süpür — bellek sızıntısını önle.
  if (HAVUZ.size <= MAX_ANAHTAR) return;
  const simdi = Date.now();
  for (const [k, p] of HAVUZ) {
    if (simdi - p.baslangic > 60 * 60 * 1000) HAVUZ.delete(k);
  }
}

export type SinirSonuc = {
  izinli: boolean;
  kalan: number;
  /** İzinsizse: pencerenin sıfırlanmasına kalan saniye */
  sifirlanmaSn: number;
};

/**
 * `anahtar` başına `pencereMs` milisaniyelik pencerede en fazla `limit` istek.
 */
export function sinirla(anahtar: string, limit: number, pencereMs: number): SinirSonuc {
  temizle();
  const simdi = Date.now();
  const mevcut = HAVUZ.get(anahtar);

  if (!mevcut || simdi - mevcut.baslangic >= pencereMs) {
    HAVUZ.set(anahtar, { adet: 1, baslangic: simdi });
    return { izinli: true, kalan: Math.max(0, limit - 1), sifirlanmaSn: 0 };
  }

  mevcut.adet += 1;
  const kalanSn = Math.max(0, Math.ceil((mevcut.baslangic + pencereMs - simdi) / 1000));
  if (mevcut.adet > limit) {
    return { izinli: false, kalan: 0, sifirlanmaSn: kalanSn };
  }
  return { izinli: true, kalan: Math.max(0, limit - mevcut.adet), sifirlanmaSn: kalanSn };
}

/** x-forwarded-for zincirinden ilk (istemci) IP'yi alır. */
export function istemciIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ilk = xff.split(",")[0]?.trim();
    if (ilk) return ilk.slice(0, 64);
  }
  return req.headers.get("x-real-ip")?.trim().slice(0, 64) || "bilinmeyen";
}

/** 429 yanıtı için Retry-After başlıklı standart gövde üreticisi. */
export function sinirYaniti(sonuc: SinirSonuc, mesaj = "Çok fazla deneme. Lütfen biraz bekleyin.") {
  return Response.json(
    { ok: false, error: mesaj },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, sonuc.sifirlanmaSn)) },
    }
  );
}
