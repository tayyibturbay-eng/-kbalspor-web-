"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface TaskItem {
  id: string;
  title: string;
  task_type: "antrenman" | "mac" | "etkinlik";
  age_group: string;
  event_date: string;
  location: string | null;
}

export default function IkbalHomePage() {
  const [upcoming, setUpcoming] = useState<TaskItem[]>([]);
  const [currentYear, setCurrentYear] = useState(2026);

  const [regForm, setRegForm] = useState({
    full_name: "",
    birth_date: "",
    parent_phone: "",
    position: "Orta Saha",
    guardian_name: "",
    notes: "",
  });
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showKvkkText, setShowKvkkText] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regResult, setRegResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks_assignments")
        .select("id, title, task_type, age_group, event_date, location")
        .order("event_date", { ascending: true })
        .limit(4);
      if (data) setUpcoming(data as TaskItem[]);
    };
    load();
  }, []);

  const birthYear = parseInt((regForm.birth_date || "").slice(0, 4), 10);
  const isMinor = isNaN(birthYear) || currentYear - birthYear < 18;

  async function handleMembershipSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegResult(null);

    if (!kvkkAccepted || !consentAccepted) {
      setRegResult({
        ok: false,
        text: "Lütfen KVKK Aydınlatma Metni ve Açık Rıza onay kutularını işaretleyin.",
      });
      return;
    }

    if (isMinor && !regForm.guardian_name.trim()) {
      setRegResult({
        ok: false,
        text: "18 yaşından küçük sporcular için Veli Ad Soyad alanı zorunludur.",
      });
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch("/api/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...regForm,
          kvkk_accepted: kvkkAccepted,
          consent_accepted: consentAccepted,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRegResult({ ok: false, text: data.error || "Başvuru gönderilemedi." });
      } else {
        setRegResult({
          ok: true,
          text: "Üyelik talebiniz ve KVKK/Veli onayınız başarıyla iletildi. Yönetici onayladığında giriş bilgileriniz paylaşılacaktır.",
        });
        setRegForm({
          full_name: "",
          birth_date: "",
          parent_phone: "",
          position: "Orta Saha",
          guardian_name: "",
          notes: "",
        });
        setKvkkAccepted(false);
        setConsentAccepted(false);
      }
    } catch {
      setRegResult({ ok: false, text: "Sunucuya bağlanılamadı." });
    }
    setRegLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#02274c] via-[#04376b] to-[#a60513] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-extrabold uppercase tracking-wider">
                Çorum İkbalspor • Profesyonelliğe Geçiş Ligi
              </span>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                Geleceğin Yıldızları{" "}
                <span className="text-red-300">İkbalspor</span> Çatısı Altında
                Yetişiyor
              </h1>

              <p className="text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                U11&apos;den U19&apos;a tüm yaş kategorilerinde antrenman ve maç
                görevleri, aidat ve malzeme takibi, Cumartesi sabah namazı QR
                yoklaması ve kendi kadronu kurma heyecanı tek platformda.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href="#uyelik-basvurusu"
                  className="px-5 py-3 rounded-xl bg-[#a60513] hover:bg-red-700 border border-white/20 text-white font-extrabold text-sm flex items-center justify-center shadow-lg transition"
                >
                  Sporcu Üyelik Başvurusu
                </a>
                <Link
                  href="/kadro-kur"
                  className="px-5 py-3 rounded-xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-sm flex items-center justify-center shadow-lg transition"
                >
                  Kendi Kadronu Kur
                </Link>
                <Link
                  href="/gorevler"
                  className="px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-extrabold text-sm flex items-center justify-center shadow-lg transition"
                >
                  Görevler & Maç Takvimi
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <h2 className="text-base sm:text-lg font-extrabold">Yaklaşan Etkinlikler</h2>
                  <Link href="/gorevler" className="text-xs font-bold text-red-200 hover:underline">
                    Tümünü Gör →
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Henüz planlanmış antrenman veya maç yok. Yönetim panelinden
                    ekleyebilirsiniz.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl bg-white/10 border border-white/15 p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-[#a60513] text-[11px] font-extrabold mr-2">
                            {t.age_group}
                          </span>
                          <span className="font-bold text-sm">{t.title}</span>
                          <p className="text-xs text-slate-200 mt-0.5">
                            {new Date(t.event_date).toLocaleString("tr-TR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {t.location ? ` • ${t.location}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Mobil Uygulama Tanıtım Kartı */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <div className="bg-gradient-to-br from-[#02274c] via-[#043666] to-[#a60513] rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl text-center md:text-left">
              <span className="inline-block bg-white/15 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Resmi Mobil Uygulama
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Çorum İkbalspor Cebinizde!
              </h2>
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                Antrenman programları, maç takvimi, taktik kadro kurma ve QR yoklama
                işlemleri tek uygulamada.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <a
                  href="https://expo.dev/artifacts/eas/Kt_SlZ1A77tyn2jT6QugMbFWt3Y_Fw_V6LGgqadQIxM.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl shadow-md transition text-sm"
                >
                  <span>🤖</span>
                  <span>Android Uygulamamız Yayında (APK İndir)</span>
                </a>

                <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-slate-100 font-semibold px-4 py-3 rounded-xl text-sm">
                  <span>🍎</span>
                  <span>iOS Çok Yakında</span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-48 h-80 sm:w-52 sm:h-88 bg-slate-950 rounded-[2.4rem] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col items-center justify-center">
                <div className="w-20 h-3.5 bg-slate-900 rounded-full absolute top-3" />
                <div className="w-full h-full bg-gradient-to-b from-[#02274c] to-[#0a192f] rounded-[1.8rem] flex flex-col items-center justify-center p-4 text-center border border-white/10">
                  <img
                    src="/logo.png"
                    alt="Çorum İkbalspor Logo"
                    className="w-20 h-20 object-contain rounded-2xl bg-white p-2 shadow-lg mb-3"
                  />
                  <p className="font-extrabold text-sm text-white tracking-wide">
                    ÇORUM İKBALSPOR
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Sporcu & Yönetim Portalı
                  </p>
                  <span className="mt-3 bg-[#a60513] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    Android Yayında
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hızlı Modüller */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/kadro-kur"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Kendi Kadronu Kur
            </h3>
            <p className="text-sm text-slate-600">
              U11–U19 ve PGL gerçek oyuncu kadrolarından kendi ilk 11&apos;ini oluştur.
            </p>
          </Link>

          <Link
            href="/gorevler"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Antrenman & Maç Görevleri
            </h3>
            <p className="text-sm text-slate-600">
              Yaş grubuna uygun antrenman faaliyetlerini ve maçları takip et.
            </p>
          </Link>

          <Link
            href="/mesajlar"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Mesajlaşma & Duyurular
            </h3>
            <p className="text-sm text-slate-600">
              Antrenör duyuruları, hatırlatıcılar ve hızlı iletişim alanı.
            </p>
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Aidat, Malzeme & Sabah Namazı QR
            </h3>
            <p className="text-sm text-slate-600">
              Yönetici panelinden aidat, malzeme ve Cumartesi QR yoklamasını yönet.
            </p>
          </Link>
        </section>

        {/* Ana Sayfa Üyelik Başvuru Formu */}
        <section id="uyelik-basvurusu" className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 sm:p-10 grid lg:grid-cols-12 gap-8 items-start">
            {/* Sol Bilgi Alanı */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <span className="inline-block bg-[#a60513] text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                  Kulübe Katıl
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#02274c] leading-tight">
                  Sporcu Üyelik Başvuru Formu
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  18 yaşından küçük sporcular için başvuru ve KVKK / Açık Rıza
                  onayları velisi veya vasisi tarafından doldurulmalıdır.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-extrabold uppercase text-[#02274c]">
                  Başvuru Süreci Nasıl İşler?
                </p>
                <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5">
                  <li>• Formu doldurduğunuzda yöneticinin telefonuna anlık bildirim gider.</li>
                  <li>• Onaylandığında sporcuya özel Giriş ID (IKB-XXXX) ve şifre tanımlanır.</li>
                  <li>• Mobil uygulama üzerinden antrenman, maç ve QR yoklama takibi başlar.</li>
                </ul>
              </div>

              <div className="bg-[#02274c] text-white rounded-2xl p-4 space-y-1">
                <p className="text-xs font-bold text-red-300 uppercase">Antrenman Tesisimiz</p>
                <p className="font-bold text-sm">Nazmi Avluca Spor Tesisi</p>
                <p className="text-xs text-slate-200">
                  Ulukavak Mah., Çiftlik Çayırı 2. Cad., Merkez / Çorum
                </p>
              </div>
            </div>

            {/* Sağ Başvuru Formu */}
            <form onSubmit={handleMembershipSubmit} className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sporcu Adı Soyadı *
                </label>
                <input
                  type="text"
                  required
                  value={regForm.full_name}
                  onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Doğum Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={regForm.birth_date}
                    onChange={(e) => setRegForm({ ...regForm, birth_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mevki
                  </label>
                  <select
                    value={regForm.position}
                    onChange={(e) => setRegForm({ ...regForm, position: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  >
                    <option value="Kaleci">Kaleci</option>
                    <option value="Defans">Defans</option>
                    <option value="Orta Saha">Orta Saha</option>
                    <option value="Forvet">Forvet</option>
                  </select>
                </div>
              </div>

              {isMinor && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-800">
                    18 Yaş Altı Sporcu — Veli Bilgisi Zorunludur
                  </p>
                  <label className="block text-xs font-bold text-slate-700">
                    Veli / Vasi Adı Soyadı *
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.guardian_name}
                    onChange={(e) => setRegForm({ ...regForm, guardian_name: e.target.value })}
                    placeholder="Anne / Baba veya Yasal Vasi Adı Soyadı"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMinor ? "Veli Telefon Numarası *" : "Telefon Numarası *"}
                </label>
                <input
                  type="tel"
                  required
                  value={regForm.parent_phone}
                  onChange={(e) => setRegForm({ ...regForm, parent_phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notlar (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  value={regForm.notes}
                  onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })}
                  placeholder="Varsa sağlık durumu veya önceki kulüp bilgisi"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#02274c] uppercase">
                    KVKK ve Açık Rıza Onayı
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKvkkText(!showKvkkText)}
                    className="text-xs font-bold text-[#a60513] underline"
                  >
                    {showKvkkText ? "Metni Gizle" : "Aydınlatma Metnini Oku"}
                  </button>
                </div>

                {showKvkkText && (
                  <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-3 max-h-44 overflow-y-auto leading-relaxed space-y-2">
                    <p>
                      <strong>Veri Sorumlusu:</strong> Çorum İkbalspor Kulübü. 6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca, sporcuya ve 18 yaş altı sporcuların velisine/vasisine ait ad-soyad, doğum tarihi, iletişim bilgileri, antrenman/maç yoklama kayıtları ve lisans bilgileri kulüp faaliyetlerinin yürütülmesi, sporcu sağlığı/güvenliği ve iletişim amaçlarıyla işlenmektedir.
                    </p>
                    <p>
                      Kişisel verileriniz yasal zorunluluklar (TFF, Gençlik ve Spor İl Müdürlüğü vb.) dışında üçüncü kişilerle paylaşılmaz. KVKK&apos;nın 11. maddesi kapsamındaki haklarınız için kulüp yönetimine başvurabilirsiniz.
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={(e) => setKvkkAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#02274c]"
                  />
                  <span>
                    6698 sayılı KVKK kapsamında{" "}
                    <strong>Aydınlatma Metnini</strong> okudum ve anladım. *
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#a60513]"
                  />
                  <span>
                    <strong>Açık Rıza Formu:</strong>{" "}
                    {isMinor
                      ? "18 yaşından küçük sporcunun velisi/vasisi olarak, sporcunun kimlik, iletişim, antrenman/yoklama ve sportif faaliyet verilerinin kulüp tarafından işlenmesine açık rıza veriyorum. *"
                      : "Kişisel verilerimin kulüp sportif faaliyetleri kapsamında işlenmesine açık rıza veriyorum. *"}
                  </span>
                </label>
              </div>

              {regResult && (
                <div
                  className={`p-3 rounded-xl text-sm font-semibold ${
                    regResult.ok
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {regResult.text}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                className="w-full rounded-xl bg-[#02274c] hover:bg-[#033669] text-white font-bold py-3 text-sm transition disabled:opacity-50"
              >
                {regLoading ? "Gönderiliyor..." : "Üyelik Talebini Gönder"}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#02274c] text-slate-200 border-t-4 border-[#a60513] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="font-extrabold text-white">
            Çorum İkbalspor • İkbalspor Kulübü
          </div>
          <div className="text-slate-300">
            © 2026 İkbalspor. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}