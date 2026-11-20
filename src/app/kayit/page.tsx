"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";

function checkIsMinor(birthDate: string): boolean {
  if (!birthDate) return true;
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return true;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age < 18;
}

export default function KayitPage() {
  const [form, setForm] = useState({
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
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isMinor = checkIsMinor(form.birth_date);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMsg(null);

    if (!kvkkAccepted || !consentAccepted) {
      setResultMsg({ ok: false, text: "Lütfen KVKK Aydınlatma Metni ve Açık Rıza onay kutularını işaretleyin." });
      return;
    }

    if (isMinor && !form.guardian_name.trim()) {
      setResultMsg({ ok: false, text: "18 yaşından küçük sporcular için Veli Ad Soyad alanı zorunludur." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kvkk_accepted: kvkkAccepted,
          consent_accepted: consentAccepted,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResultMsg({ ok: false, text: data.error || "Başvuru gönderilemedi." });
      } else {
        setResultMsg({
          ok: true,
          text: "Üyelik talebiniz ve veli/KVKK onayınız başarıyla iletildi. Yönetici onayladığında giriş bilgileriniz paylaşılacaktır.",
        });
        setForm({ full_name: "", birth_date: "", parent_phone: "", position: "Orta Saha", guardian_name: "", notes: "" });
        setKvkkAccepted(false);
        setConsentAccepted(false);
      }
    } catch {
      setResultMsg({ ok: false, text: "Sunucuya bağlanılamadı." });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 py-10 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="inline-block bg-[#a60513] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
              Çorum İkbalspor
            </span>
            <h1 className="text-2xl font-extrabold text-[#02274c]">Sporcu Üyelik Başvurusu</h1>
            <p className="text-sm text-slate-600 mt-1">
              18 yaşından küçük sporcular için başvuru ve KVKK/Açık Rıza onayları velisi/vasisi tarafından doldurulmalıdır.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sporcu Adı Soyadı *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Doğum Tarihi *</label>
                <input
                  type="date"
                  required
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mevki</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
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
                <label className="block text-xs font-bold text-slate-700">Veli / Vasi Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
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
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                placeholder="05XX XXX XX XX"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notlar (Opsiyonel)</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Varsa sağlık durumu veya önceki kulüp bilgisi"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            {/* KVKK ve Açık Rıza Alanı */}
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

            {resultMsg && (
              <div
                className={`p-3 rounded-xl text-sm font-semibold ${
                  resultMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {resultMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#02274c] hover:bg-[#033669] text-white font-bold py-3 text-sm transition disabled:opacity-50"
            >
              {loading ? "Gönderiliyor..." : "Üyelik Talebini Gönder"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}