import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "Çorum İkbal Spor Kulübü mobil uygulaması ve ikbalspor.com platformu gizlilik politikası — toplanan veriler, kullanım amaçları, cihaz izinleri, saklama ve kullanıcı hakları (KVKK / Google Play Data Safety).",
  robots: { index: true, follow: true },
};

const GUNCELLEME = "25 Kasım 2026";

function Bolum({
  no,
  baslik,
  children,
}: {
  no: string;
  baslik: string;
  children: React.ReactNode;
}) {
  return (
    <section className="k-artik space-y-3 p-6 sm:p-8">
      <div className="flex items-baseline gap-3">
        <span className="k-koz text-koz text-[var(--brand-red)]">{no}</span>
        <h2 className="k-posta text-lg text-[var(--text-primary)] sm:text-xl">
          {baslik}
        </h2>
      </div>
      <div className="k-govde text-sm space-y-2">{children}</div>
    </section>
  );
}

export default function GizlilikPolitikasiPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <header className="k-sahne k-artik mb-8 overflow-hidden px-6 py-10 text-white sm:px-10 sm:py-12">
        <p className="k-koz text-koz text-amber-200">
          ÇORUM İKBAL SPOR KULÜBÜ • YASAL ŞEFFAFLIK
        </p>
        <h1 className="k-posta mt-3 text-3xl sm:text-5xl">
          Gizlilik Politikası
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
          Bu politika;{" "}
          <strong className="text-white">Çorum İkbalspor mobil uygulaması</strong>{" "}
          (Google Play) ve{" "}
          <strong className="text-white">ikbalspor.com</strong> web platformu
          üzerinden işlenen kişisel verilerin kapsamını, işlenme amaçlarını,
          saklama sürelerini ve veri sahibinin haklarını KVKK ve Google Play
          Data Safety ilkeleriyle uyumlu biçimde açıklar.
        </p>
        <p className="mt-4 text-xs font-bold text-slate-300">
          Son güncelleme: {GUNCELLEME}
        </p>
      </header>

      <div className="space-y-5">
        <Bolum no="01" baslik="Veri Sorumlusu">
          <p>
            Kişisel verileriniz, Çorum İkbal Spor Kulübü (bundan böyle
            &quot;Kulüp&quot;) tarafından, kulüp faaliyetlerinin yürütülmesi
            amacıyla ve 6698 sayılı KVKK m.10 kapsamında işbu politika
            çerçevesinde işlenir. İletişim:{" "}
            <Link
              href="/iletisim"
              className="k-altcizgi font-extrabold text-[var(--brand-ink)]"
            >
              ikbalspor.com/iletisim
            </Link>{" "}
            sayfası üzerinden Kulüp yönetimine ulaşabilirsiniz.
          </p>
        </Bolum>

        <Bolum no="02" baslik="Toplanan Veriler">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Kimlik ve sporcu kaydı:</strong> ad soyad, doğum tarihi,
              yaş grubu, mevkii, forma numarası, profil fotoğrafı, oyuncu kodu.
            </li>
            <li>
              <strong>İletişim:</strong> veli/vasi telefon numarası (altyapı
              yaş gruplarında veli onayıyla).
            </li>
            <li>
              <strong>Giriş bilgileri:</strong> giriş PIN&apos;i doğrulaması
              veritabanında<em> hash</em> olarak saklanır; düz metin PIN
              tutulmaz ve hiçbir sayfada gösterilmez.
            </li>
            <li>
              <strong>Spor faaliyet kayıtları:</strong> antrenman/maç yoklaması
              (QR), maç tahminleri ve puanlar, aidat ve malzeme teslim
              kayıtları.
            </li>
            <li>
              <strong>Cihaz ve bildirim:</strong> Expo push bildirim token&apos;ı
              ve (sporcu hesabında) tek cihaz bağlama anahtarı (bound_device_id).
            </li>
            <li>
              <strong>Denetim izi:</strong> işlem türü ve işlemi yapan rol
              bilgisi (activity_logs); IP tam olarak loglanmaz.
            </li>
          </ul>
          <p>
            Konum, rehber, SMS/arama kayıtları, sağlık verisi veya finansal
            kart bilgisi <strong>toplanmaz</strong>; üçüncü taraf reklam
            SDK&apos;ı ve çerez tabanlı takip <strong>kullanılmaz</strong>.
          </p>
        </Bolum>

        <Bolum no="03" baslik="İşleme Amaçları ve Hukuki Sebepler">
          <p>
            Veriler yalnızca; sporcu tescil ve kadro yönetimi, antrenman/maç
            organizasyonu, QR yoklama doğrulaması, kulüp duyurularının
            iletilmesi, aidat-malzeme takibi ve hesap güvenliğinin sağlanması
            amacıyla işlenir. Hukuki sebepler: KVKK m.5/2-c (bir sözleşmenin
            kurulması/ifası — kulüp sporcu ilişkisi), m.5/2-f (veri
            sorumlusunun meşru menfaati — güvenlik) ve açık rıza (bildirim
            tercihleri).
          </p>
        </Bolum>

        <Bolum no="04" baslik="Cihaz İzinleri (Android 13+ / iOS) ve Data Safety">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Kamera:</strong> yalnızca QR yoklama kodu okutmak için,
              kullanıcı tetiklediğinde açılır; arka planda çalışmaz.
            </li>
            <li>
              <strong>Galeri/Fotoğraf seçimi:</strong> yalnızca profil
              fotoğrafı seçimi için sistem seçici üzerinden; cihaz galerinize
              toplu erişilmez.
            </li>
            <li>
              <strong>Bildirimler:</strong> kulüp duyuru ve maç hatırlatmaları;
              sistem ayarlarından tek dokunuşla kapatılabilir.
            </li>
          </ul>
          <p>
            Veriler reklam amacıyla toplanmaz, satılmaz ve üçüncü taraf
            reklam verenlerle paylaşılmaz. Uygulama içinde ödeme yoktur.
            Veriler şifreli bağlantı (TLS) üzerinden, bulut veritabanında
            (Supabase, AB/ABD bölgesi) saklanır; Google Play Data Safety
            beyanı bu politika ile birebir uyumludur.
          </p>
        </Bolum>

        <Bolum no="05" baslik="Verilerin Aktarımı">
          <p>
            Veriler; yalnızca teknik altyapı sağlayıcıları (bulut veritabanı
            ve bildirim altyapısı) ile yasal zorunluluk hâlinde yetkili kamu
            kurumlarına aktarılabilir. Sporcu adı ve kadro bilgileri kulüp
            vitrini olarak ikbalspor.com üzerinden kamuya açık yayınlanabilir;
            bunun dışında veri paylaşımı yapılmaz.
          </p>
        </Bolum>

        <Bolum no="06" baslik="Saklama Süresi">
          <p>
            Sporcu kaydı, kulüp üyelik ilişkisi devam ettiği sürece; yoklama,
            tahmin ve faaliyet kayıtları sporcu/veli talebi veya kulüp
            kayıt-imha politikası çerçevesinde saklanır. Push token&apos;ları
            uygulama kaldırıldığında veya çıkış yapıldığında silinir.
          </p>
        </Bolum>

        <Bolum no="07" baslik="Haklarınız — Erişim, Düzeltme, Silme">
          <p>
            KVKK m.11 kapsamında verilerinize erişim, düzeltilmesi ve
            silinmesini talep edebilirsiniz. Hesabınızın ve kişisel
            verilerinizin kalıcı silinmesi için:{" "}
            <Link
              href="/hesap-silme"
              className="k-altcizgi font-extrabold text-[var(--brand-red)]"
            >
              ikbalspor.com/hesap-silme
            </Link>{" "}
            sayfasındaki talebi iletin. Talepler en geç 30 gün içinde
            sonuçlandırılır. Altyapı yaş gruplarında talebi veli/vasi yürütür.
          </p>
        </Bolum>

        <Bolum no="08" baslik="Güvenlik Önlemleri">
          <p>
            PIN&apos;ler hashlenir ve deneme başına sunucu tarafı hız
            sınırına tabidir; hesaplar tek cihazla bağlanabilir. Yönetim API
            uçları kimlik doğrulaması ve hız limitine tabidir, hedef
            veritabanı satır seviyesi güvenlik politikalarıyla (RLS) korunur,
            web sitemiz CSP/HSTS/XFO gibi kurumsal güvenlik başlıklarıyla
            servis edilir.
          </p>
        </Bolum>

        <Bolum no="09" baslik="Politika Değişiklikleri">
          <p>
            Bu politika güncellendiğinde bu sayfada yayımlanır ve en üstteki
            &quot;son güncelleme&quot; tarihi değişir. Önemli değişiklikler
            kulüp duyurusu ile ayrıca bildirilir.
          </p>
        </Bolum>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/hesap-silme"
          className="k-buton k-buton--lacivert"
        >
          Hesap ve Veri Silme Talebi →
        </Link>
        <Link href="/" className="k-buton k-buton--hayalet">
          ← Ana Sayfa
        </Link>
      </div>
    </main>
  );
}
