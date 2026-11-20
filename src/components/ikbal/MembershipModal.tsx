"use client";

import React, { useState } from "react";

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
}

export function MembershipModal({
  isOpen,
  onClose,
  currentYear,
}: MembershipModalProps) {
  const [regForm, setRegForm] = useState({
    full_name: "",
    birth_date: "",
    parent_phone: "",
    guardian_name: "",
    notes: "",
  });
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showKvkkText, setShowKvkkText] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regResult, setRegResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  if (!isOpen) return null;

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
        setRegResult({
          ok: false,
          text: data.error || "Başvuru gönderilemedi.",
        });
      } else {
        setRegResult({
          ok: true,
          text: "Üyelik talebiniz ve KVKK/Veli onayınız başarıyla iletildi. Yönetici onayladığında giriş bilgileriniz paylaşılacaktır.",
        });
        setRegForm({
          full_name: "",
          birth_date: "",
          parent_phone: "",
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 relative"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="inline-block bg-[#a60513] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
              Çorum İkbalspor
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#02274c]">
              Sporcu Üyelik Başvurusu
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              18 yaşından küçük sporcular için form ve KVKK/Açık Rıza onayları
              velisi tarafından doldurulmalıdır.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleMembershipSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sporcu Adı Soyadı *
            </label>
            <input
              type="text"
              required
              value={regForm.full_name}
              onChange={(e) =>
                setRegForm({ ...regForm, full_name: e.target.value })
              }
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Doğum Tarihi *
            </label>
            <input
              type="date"
              required
              value={regForm.birth_date}
              onChange={(e) =>
                setRegForm({ ...regForm, birth_date: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
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
                onChange={(e) =>
                  setRegForm({ ...regForm, guardian_name: e.target.value })
                }
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
              onChange={(e) =>
                setRegForm({ ...regForm, parent_phone: e.target.value })
              }
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
              onChange={(e) =>
                setRegForm({ ...regForm, notes: e.target.value })
              }
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
                className="text-xs font-bold text-[#a60513] underline cursor-pointer"
              >
                {showKvkkText ? "Metni Gizle" : "Aydınlatma Metnini Oku"}
              </button>
            </div>

            {showKvkkText && (
              <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto leading-relaxed space-y-2">
                <p>
                  <strong>Veri Sorumlusu:</strong> Çorum İkbalspor Kulübü. 6698
                  sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;)
                  uyarınca, sporcuya ve 18 yaş altı sporcuların velisine/vasisine
                  ait ad-soyad, doğum tarihi, iletişim bilgileri, antrenman/maç
                  yoklama kayıtları ve lisans bilgileri kulüp faaliyetlerinin
                  yürütülmesi, sporcu sağlığı/güvenliği ve iletişim amaçlarıyla
                  işlenmektedir.
                </p>
                <p>
                  Kişisel verileriniz yasal zorunluluklar (TFF, Gençlik ve Spor
                  İl Müdürlüğü vb.) dışında üçüncü kişilerle paylaşılmaz.
                  KVKK&apos;nın 11. maddesi kapsamındaki haklarınız için kulüp
                  yönetimine başvurabilirsiniz.
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 text-sm transition cursor-pointer"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={regLoading}
              className="w-2/3 rounded-xl bg-[#02274c] hover:bg-[#033669] text-white font-bold py-3 text-sm transition disabled:opacity-50 cursor-pointer"
            >
              {regLoading ? "Gönderiliyor..." : "Üyelik Talebini Gönder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}