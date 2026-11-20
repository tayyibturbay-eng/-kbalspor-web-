import Link from "next/link";

export default function IletisimPage() {
  const facilityName = "Nazmi Avluca Spor Tesisi";
  const facilityAddress =
    "Ulukavak Mah., Çiftlik Çayırı 2. Cad. (Çiftlik Çayırı - Küçük Evler Yolu civarı), Merkez / Çorum";
  const mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=Nazmi+Avluca+Futbol+Sahas%C4%B1+%C3%87orum";
  const mapsEmbedUrl =
    "https://maps.google.com/maps?q=Nazmi%20Avluca%20Futbol%20Sahas%C4%B1%20%C3%87orum&t=&z=16&ie=UTF8&iwloc=&output=embed";

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Başlık */}
        <div className="bg-[#02274c] text-white rounded-2xl p-6 sm:p-8 shadow-lg border-b-4 border-[#a60513]">
          <span className="inline-block text-xs font-bold uppercase tracking-widest bg-[#a60513] px-3 py-1 rounded-full mb-3">
            Çorum İkbalspor
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            İletişim ve Tesis Konumu
          </h1>
          <p className="text-slate-200 mt-2 text-sm sm:text-base">
            Antrenman tesisimiz, konum bilgimiz ve kulüp kayıt başvuruları için
            aşağıdaki bilgileri kullanabilirsiniz.
          </p>
        </div>

        {/* Adres ve Harita Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sol: Tesis Bilgileri */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#a60513]">
                  Antrenman Tesisi
                </p>
                <h2 className="text-xl font-bold text-[#02274c] mt-1">
                  {facilityName}
                </h2>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                  Açık Adres
                </p>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  {facilityAddress}
                </p>
              </div>

              <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-semibold text-[#02274c] uppercase mb-1">
                  Kulüp Kayıt & Başvuru
                </p>
                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                  Kulübümüze katılmak isteyen sporcularımız online üyelik
                  talebi oluşturabilir.
                </p>
                <Link
                  href="/kayit"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-[#a60513] hover:bg-[#8a040f] text-white font-semibold py-2.5 px-4 text-sm transition"
                >
                  Üyelik Başvurusu Yap
                </Link>
              </div>
            </div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full rounded-xl bg-[#02274c] hover:bg-[#033669] text-white font-semibold py-3 px-4 text-sm transition shadow-sm"
            >
              Google Haritalar&apos;da Yol Tarifi Al
            </a>
          </div>

          {/* Sağ: Harita */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200">
            <div className="w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden bg-slate-100">
              <iframe
                title="Nazmi Avluca Spor Tesisi Konumu"
                src={mapsEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}