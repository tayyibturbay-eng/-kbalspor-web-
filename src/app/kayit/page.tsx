"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import { Vitrin } from "@/components/ikbal/Motion";
import { EASE } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { calcAgeGroupFromBirthDate } from "@/lib/age-groups";
import { MEMBERSHIP_STATUS } from "@/lib/membership-status";

const supabase = createClient();

function isApplicantUnder18(birthDateStr: string): boolean {
  if (!birthDateStr) return false;
  const parts = birthDateStr.split("-");
  if (parts.length !== 3) return false;
  const dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mDiff = today.getMonth() - dob.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18;
}

export default function MembershipRequestPage() {
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const under18 = isApplicantUnder18(birthDate);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const autoAgeGroup = useMemo(() => {
    if (!birthDate) return "";
    return calcAgeGroupFromBirthDate(birthDate);
  }, [birthDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!fullName.trim() || !birthDate || !guardianPhone.trim()) {
      setFeedback({
        ok: false,
        text: "Lütfen sporcu adı soyadı, doğum tarihi ve iletişim telefonunu girin.",
      });
      return;
    }

    const computedGroup = calcAgeGroupFromBirthDate(birthDate) || "Minikler";

    if (under18 && !guardianName.trim()) {
      setFeedback({
        ok: false,
        text: "18 yaşından küçük sporcular için Veli Ad Soyad alanı zorunludur.",
      });
      return;
    }

    if (!kvkkAccepted) {
      setFeedback({
        ok: false,
        text: "Başvuruyu göndermek için KVKK Aydınlatma Metni onay kutusunu işaretlemelisiniz.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("membership_requests").insert({
      full_name: fullName.trim(),
      birth_date: birthDate,
      age_group: computedGroup,
      parent_phone: guardianPhone.trim(),
      guardian_name: guardianName.trim() || null,
      guardian_phone: guardianPhone.trim(),
      notes: notes.trim() || null,
      status: MEMBERSHIP_STATUS.PENDING,
      created_at: new Date().toISOString(),
    });
    setSubmitting(false);

    if (error) {
      setFeedback({
        ok: false,
        text: "Başvuru kaydedilemedi: " + error.message,
      });
      return;
    }

    setFeedback({
      ok: true,
      text: `Üyelik başvurunuz (${computedGroup}) alındı. Kulüp yönetimimiz en kısa sürede sizinle iletişime geçecektir.`,
    });
    setFullName("");
    setBirthDate("");
    setGuardianName("");
    setGuardianPhone("");
    setNotes("");
    setKvkkAccepted(false);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="k-sahne text-white py-9 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Çorum İkbal Spor Kulübü • Kayıt &amp; Altyapı
          </span>
          <h1 className="k-posta k-posta--wonk text-2xl sm:text-4xl text-white">
            Kulüp Üyelik Başvurusu
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
            Doğum tarihinizi girdiğinizde uygun yaş grubu sistem tarafından
            otomatik belirlenir.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <Vitrin>
          <form
            onSubmit={handleSubmit}
            className="k-artik p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="kayit-adsoyad"
                  className="k-koz text-[10px] block mb-1.5"
                >
                  Sporcu Ad Soyad *
                </label>
                <input
                  id="kayit-adsoyad"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Örn: Emir Kaya"
                  className="k-alan font-bold"
                />
              </div>

              <div>
                <label
                  htmlFor="kayit-dogum"
                  className="k-koz text-[10px] block mb-1.5"
                >
                  Doğum Tarihi *
                </label>
                <input
                  id="kayit-dogum"
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="k-alan font-bold"
                />
                {autoAgeGroup ? (
                  <div className="mt-2 k-etiket k-etiket--lacivert">
                    Otomatik Kategori: {autoAgeGroup}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="kayit-veli"
                  className="k-koz text-[10px] block mb-1.5"
                >
                  Veli Ad Soyad {under18 ? "*" : "(18 yaş altı zorunlu)"}
                </label>
                <input
                  id="kayit-veli"
                  type="text"
                  required={under18}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder={under18 ? "Veli adı soyadı (zorunlu)" : "Veli adı soyadı"}
                  className="k-alan font-semibold"
                />
              </div>

              <div>
                <label
                  htmlFor="kayit-telefon"
                  className="k-koz text-[10px] block mb-1.5"
                >
                  İletişim Telefonu *
                </label>
                <input
                  id="kayit-telefon"
                  type="tel"
                  required
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                  className="k-alan font-bold"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="kayit-notlar"
                className="k-koz text-[10px] block mb-1.5"
              >
                Ek Notlar
              </label>
              <textarea
                id="kayit-notlar"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Daha önce oynadığı kulüp, sağlık/lisans notları vb."
                className="k-alan"
              />
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE.yumusak }}
                  role="status"
                  aria-live="polite"
                  className={`p-3.5 rounded-2xl text-xs font-extrabold ${
                    feedback.ok
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                  }`}
                >
                  {feedback.text}
                </motion.div>
              )}
            </AnimatePresence>

            {under18 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-1 text-xs">
                <div className="font-black text-amber-700 dark:text-amber-300">
                  18 Yaş Altı Sporcu — Veli Bilgilendirmesi
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Başvuru sahibi 18 yaşından küçük olduğu için veli/yasal temsilci adının girilmesi zorunludur. Altyapı kayıt onayı, antrenman/maç bilgilendirmeleri ve KVKK kapsamındaki tüm süreçler belirtilen veli üzerinden yürütülür.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 space-y-2.5">
              <details className="text-xs text-[var(--text-secondary)] leading-relaxed">
                <summary className="cursor-pointer font-extrabold text-[var(--brand-ink)]">
                  6698 Sayılı KVKK Kapsamında Aydınlatma Metni (Okumak için tıklayın)
                </summary>
                <p className="mt-2">
                  <strong>Çorum İkbal Spor Kulübü</strong> olarak, bu form aracılığıyla paylaştığınız sporcu ad-soyad, doğum tarihi, veli/iletişim bilgileri ve ek notlar; 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca yalnızca kulüp ön kayıt değerlendirmesi, yaş kategorisi planlaması, antrenman/seçme daveti ve lisans süreçlerinin yürütülmesi amacıyla işlenmektedir. Verileriniz yetkisiz üçüncü kişilerle paylaşılmaz; yasal ve federasyon yükümlülükleri dışında kullanılmaz.
                </p>
              </details>

              <label className="flex items-start gap-2.5 text-xs font-bold text-[var(--text-primary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={kvkkAccepted}
                  onChange={(e) => setKvkkAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--brand-red)]"
                />
                <span>
                  6698 sayılı KVKK Aydınlatma Metni&apos;ni okudum; kişisel verilerin kulüp ön kayıt ve iletişim süreçleri kapsamında işlenmesini onaylıyorum. *
                </span>
              </label>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="k-buton k-buton--kirmizi !px-6 !py-3 !text-sm"
            >
              {submitting ? "Gönderiliyor..." : "Başvuruyu Gönder"}
            </motion.button>
          </form>
        </Vitrin>
      </main>
    </div>
  );
}