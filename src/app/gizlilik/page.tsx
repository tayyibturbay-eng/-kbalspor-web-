import React from "react";

export const metadata = {
  title: "Gizlilik Politikası | Çorum İkbal Spor Kulübü",
  description:
    "Çorum İkbal Spor Kulübü mobil uygulaması ve web platformu gizlilik politikası.",
};

export default function GizlilikPolitikasiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-red-700">
          Çorum İkbal Spor Kulübü
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Gizlilik Politikası
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Son Güncelleme: 25 Kasım 2026 • Kapsam: Çorum İkbalspor Mobil
          Uygulaması ve ikbalspor.com
        </p>

        <section className="mt-6 space-y-2 text-sm leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            1. Toplanan Bilgiler
          </h2>
          <p>
            Çorum İkbal Spor Kulübü dijital platformu ve Çorum İkbalspor
            mobil uygulaması üzerinden; sporcu ad soyadı, doğum tarihi, yaş
            grubu/kategori, forma ve mevki bilgisi, veli/iletişim telefon
            numarası, oyuncu kodu ve giriş PIN bilgisi, profil fotoğrafı,
            futbolcu kartı özelleştirmeleri, antrenman ve QR yoklama kayıtları,
            maç tahminleri ve puanlar, aidat ve malzeme kayıtları ile anlık
            bildirim token bilgileri işlenebilir.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            2. Bilgilerin Kullanım Amaçları
          </h2>
          <p>
            Toplanan bilgiler; sporcu ve altyapı kayıtlarının yürütülmesi,
            antrenman ve maç organizasyonlarının planlanması, QR yoklama ve
            duyuru bildirimlerinin iletilmesi, kadro kurma ve maç tahmini
            özelliklerinin sunulması, aidat/malzeme takibi ve sistem
            güvenliğinin sağlanması amacıyla kullanılır.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            3. Cihaz İzinleri ve Veri Güvenliği
          </h2>
          <p>
            Kamera izni QR yoklama okutma, medya/fotoğraf izni profil fotoğrafı
            seçimi, bildirim izni ise kulüp duyuru ve bilgilendirmeleri için
            kullanılır. Kullanıcı verileri üçüncü taraflara satılmaz; yalnızca
            hizmet altyapısı ve yasal yükümlülükler kapsamında korunarak
            saklanır.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            4. Altyapı Sporcuları ve İletişim
          </h2>
          <p>
            Altyapı yaş gruplarına ilişkin kayıt ve bilgilendirme süreçlerinde
            veli onayı ve ilgili mevzuat esaslarına uyulur. Veri güncelleme veya
            silme talepleriniz için{" "}
            <a
              href="https://ikbalspor.com"
              className="font-semibold text-blue-900 underline"
            >
              ikbalspor.com
            </a>{" "}
            üzerinden kulüp yönetimiyle iletişime geçebilirsiniz.
          </p>
        </section>
      </div>
    </main>
  );
}