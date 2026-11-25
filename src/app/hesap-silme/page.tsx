"use client";

import { useState } from "react";
import Link from "next/link";

// Google Play "hesap silme" zorunluluğu: mağaza listeleme ekranında
// bildirilen bu adres, kullanıcıya UYGULAMAYI KAPATMADAN hesabını ve
// verilerini sildirme yolunu gösterir. Kulübün destek e-postası
// değişirse tek satırda güncelleyin.
const DESTEK_EPOSTASI = "bilgi@ikbalspor.com";

type Adim = {
  no: string;
  baslik: string;
  metin: string;
};

const ADIMLAR: Adim[] = [
  {
    no: "A",
    baslik: "Uygulama içinden (en hızlı yol)",
    metin:
      "Çorum İkbalspor mobil uygulamasında giriş yapın → alt menüden 'PIN & Hesap' sekmesine dokunun → 'Gizlilik & Hesap Silme' kartındaki talep bağlantısını açın ve formu doldurup gönderin.",
  },
  {
    no: "B",
    baslik: "Bu sayfadaki talep formu",
    metin:
      "Aşağıdaki formu doldurup 'Talebi Gönder' dediğinizde, kulüp yönetimine iletilecek yapılandırılmış bir e-posta hazırlanır. Talebinizde Oyuncu ID (ör. SP-1024) bilgisini mutlaka bırakın — silme işleminin doğru hesaba uygulanmasını sağlar.",
  },
  {
    no: "C",
    baslik: "Doğrudan iletişim",
    metin: `E-posta (${DESTEK_EPOSTASI}) veya ikbalspor.com/iletisim sayfasındaki telefon numaraları üzerinden kulüp yönetimine ulaşabilirsiniz. 18 yaş altı sporcularda talebi veli/vasi iletir.`,
  },
];

export default function HesapSilmePage() {
  const [adSoyad, setAdSoyad] = useState("");
  const [oyuncuId, setOyuncuId] = useState("");
  const [telefon, setTelefon] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState("");

  function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!adSoyad.trim() || !oyuncuId.trim()) {
      setHata("Ad Soyad ve Oyuncu ID alanları zorunludur.");
      return;
    }
    setHata("");
    const konu = `Hesap ve Veri Silme Talebi — ${oyuncuId.trim().toUpperCase()}`;
    const govde = [
      "Çorum İkbal Spor Kulübü Yönetimine,",
      "",
      `Ad Soyad: ${adSoyad.trim()}`,
      `Oyuncu ID: ${oyuncuId.trim().toUpperCase()}`,
      `Telefon: ${telefon.trim() || "-"}`,
      "",
      "6698 sayılı KVKK'nın 11. maddesi kapsamında; hakkımda işlenen tüm kişisel verilerin (sporcu kaydı, yoklama/tahmin/aidat/malzeme kayıtları, push bildirim token'ları ve denetim izleri) kalıcı olarak silinmesini ve hesabımın kapatılmasını talep ediyorum.",
      aciklama.trim() ? `\nEk açıklama: ${aciklama.trim()}` : "",
      "",
      "Saygılarımla.",
    ].join("\n");
    window.location.href = `mailto:${DESTEK_EPOSTASI}?subject=${encodeURIComponent(
      konu
    )}&body=${encodeURIComponent(govde)}`;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <header className="k-sahne k-artik mb-8 overflow-hidden px-6 py-10 text-white sm:px-10 sm:py-12">
        <p className="k-koz text-koz text-amber-200">
          KVKK m.11 • GOOGLE PLAY HESAP SİLME
        </p>
        <h1 className="k-posta mt-3 text-3xl sm:text-5xl">
          Hesap &amp; Veri Silme
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
          Çorum İkbalspor hesabınızı ve kişisel verilerinizi silmek istemeniz
          en doğal hakkınızdır. Aşağıdaki yollardan biriyle talebinizi iletin;
          talep en geç <strong className="text-white">30 gün</strong> içinde
          sonuçlandırılır ve işlemin ardından kulüp faaliyet kayıtlarının
          anonim istatistikleri (skor/tahmin puanlaması) kulüp arşivi için
          tutulabilir.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Yol haritası */}
        <div className="space-y-4">
          {ADIMLAR.map((a) => (
            <section key={a.no} className="k-artik space-y-2 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-red)] text-sm font-black text-white">
                  {a.no}
                </span>
                <h2 className="k-posta text-base text-[var(--text-primary)]">
                  {a.baslik}
                </h2>
              </div>
              <p className="k-govde text-sm">{a.metin}</p>
            </section>
          ))}
          <p className="px-1 text-xs text-[var(--text-muted)]">
            Sorularınız için:{" "}
            <a
              href={`mailto:${DESTEK_EPOSTASI}`}
              className="k-altcizgi font-extrabold text-[var(--brand-ink)]"
            >
              {DESTEK_EPOSTASI}
            </a>{" "}
            •{" "}
            <Link
              href="/iletisim"
              className="k-altcizgi font-extrabold text-[var(--brand-ink)]"
            >
              İletişim sayfası
            </Link>
          </p>
        </div>

        {/* Talep formu */}
        <form onSubmit={gonder} className="k-artik h-fit space-y-4 p-6 sm:p-8">
          <div>
            <span className="k-koz text-koz">RESMİ TALEP FORMU</span>
            <h2 className="k-posta mt-1 text-xl text-[var(--text-primary)]">
              Silme Talebi Oluştur
            </h2>
          </div>

          {hata ? (
            <div className="rounded-xl bg-[var(--status-danger-bg)] px-4 py-3 text-xs font-extrabold text-[var(--status-danger-text)]">
              {hata}
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-extrabold text-[var(--text-secondary)]">
              Ad Soyad *
            </span>
            <input
              value={adSoyad}
              onChange={(e) => setAdSoyad(e.target.value)}
              maxLength={100}
              className="k-alan"
              placeholder="Sporcunun veya velinin adı soyadı"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-extrabold text-[var(--text-secondary)]">
              Oyuncu ID *
            </span>
            <input
              value={oyuncuId}
              onChange={(e) => setOyuncuId(e.target.value)}
              maxLength={24}
              className="k-alan font-mono font-bold uppercase"
              placeholder="Örn: SP-1024"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-extrabold text-[var(--text-secondary)]">
              Telefon (opsiyonel)
            </span>
            <input
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              maxLength={24}
              className="k-alan"
              placeholder="Geri dönüş yapılabilecek numara"
              inputMode="tel"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-extrabold text-[var(--text-secondary)]">
              Ek açıklama (opsiyonel)
            </span>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              maxLength={500}
              rows={3}
              className="k-alan resize-none"
              placeholder="Talebinize eklemek istedikleriniz"
            />
          </label>

          <button type="submit" className="k-buton k-buton--kirmizi w-full">
            Talebi Gönder →
          </button>
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Gönder, cihazınızdaki e-posta uygulamasını yapılandırılmış talep
            metniyle açar. E-posta uygulamanız yoksa C yolundaki telefon
            numarasıyla da talebinizi iletebilirsiniz.
          </p>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/gizlilik-politikasi" className="k-buton k-buton--lacivert">
          Gizlilik Politikası
        </Link>
        <Link href="/" className="k-buton k-buton--hayalet">
          ← Ana Sayfa
        </Link>
      </div>
    </main>
  );
}
