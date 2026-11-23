"use client";

import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";

function inferAgeGroupFromBirthDate(birthDate: string): string {
  const clean = birthDate.trim();
  const year = parseInt(clean.slice(0, 4), 10);
  if (isNaN(year)) return "U15";
  if (year < 2007) return "Çorum Süper Amatör Ligi";
  if (year >= 2016) return "Minikler";
  if (year === 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  return "U19";
}

function isUnderEighteen(birthDate: string): boolean {
  const year = parseInt(birthDate.trim().slice(0, 4), 10);
  if (isNaN(year)) return true;
  return new Date().getFullYear() - year < 18;
}

export default function MembershipRequestPage() {
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    parent_phone: "",
    guardian_name: "",
    position: "Orta Saha",
    notes: "",
    kvkk_accepted: false,
    consent_accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const inferredGroup = useMemo(
    () => inferAgeGroupFromBirthDate(form.birth_date),
    [form.birth_date]
  );
  const minor = useMemo(
    () => isUnderEighteen(form.birth_date),
    [form.birth_date]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResultMsg(null);

    if (!form.full_name.trim() || !form.parent_phone.trim()) {
      setResultMsg({
        ok: false,
        text: "Lütfen sporcu adı soyadı ve telefon numarasını girin.",
      });
      return;
    }

    if (minor && !form.guardian_name.trim()) {
      setResultMsg({
        ok: false,
        text: "18 yaşından küçük sporcular için Veli / Vasi Ad Soyad zorunludur.",
      });
      return;
    }

    if (!form.kvkk_accepted || !form.consent_accepted) {
      setResultMsg({
        ok: false,
        text: "Lütfen KVKK Aydınlatma Metni ve Açık Rıza onay kutularını işaretleyin.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          birth_date: form.birth_date.trim() || null,
          age_group: inferredGroup,
          parent_phone: form.parent_phone.trim(),
          guardian_name: minor ? form.guardian_name.trim() : null,
          position: form.position,
          notes: form.notes.trim() || null,
          kvkk_accepted: form.kvkk_accepted,
          consent_accepted: form.consent_accepted,
          created_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      setSubmitting(false);

      if (!res.ok || !data?.ok) {
        setResultMsg({
          ok: false,
          text: data?.error || "Üyelik başvurusu gönderilemedi.",
        });
        return;
      }

      setResultMsg({
        ok: true,
        text: `Başvurunuz alındı (${inferredGroup}). Kulüp yönetimi onayladıktan sonra sporcu giriş bilgileriniz tanımlanacaktır.`,
      });
      setForm({
        full_name: "",
        birth_date: "",
        parent_phone: "",
        guardian_name: "",
        position: "Orta Saha",
        notes: "",
        kvkk_accepted: false,
        consent_accepted: false,
      });
    } catch {
      setSubmitting(false);
      setResultMsg({
        ok: false,
        text: "Sunucuya bağlanırken bir hata oluştu.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white py-6 px-4 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
            Çorum İkbalspor • Kayıt &amp; Başvuru
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Kulüp Üyelik Talebi
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
            Altyapı ve amatör takım kadrolarımıza katılım için başvuru formunu
            doldurun.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-extrabold text-[var(--text-secondary)]">
              Tahmini Yaş Kategorisi:{" "}
              <strong className="text-[var(--brand-navy)] dark:text-sky-300">
                {inferredGroup}
              </strong>
            </span>
            <span className="text-[11px] font-bold text-[var(--text-muted)]">
              {minor ? "18 Yaş Altı (Veli Onayı Gerekir)" : "Yetişkin Başvurusu"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Sporcu Ad Soyad *
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Örn: Emre Kaya"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Doğum Tarihi (YYYY-AA-GG)
              </label>
              <input
                type="text"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                placeholder="Örn: 2012-06-15"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          {minor && (
            <div>
              <label className="block text-xs font-bold text-[var(--status-warning-text)] mb-1">
                Veli / Vasi Ad Soyad * (18 yaş altı zorunlu)
              </label>
              <input
                type="text"
                required={minor}
                value={form.guardian_name}
                onChange={(e) =>
                  setForm({ ...form, guardian_name: e.target.value })
                }
                placeholder="Veli veya vasinin adı soyadı"
                className="w-full rounded-xl border border-amber-400 bg-[var(--status-warning-bg)]/40 px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                {minor ? "Veli Telefon (05XX...) *" : "Telefon (05XX...) *"}
              </label>
              <input
                type="tel"
                required
                value={form.parent_phone}
                onChange={(e) =>
                  setForm({ ...form, parent_phone: e.target.value })
                }
                placeholder="05XX XXX XX XX"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Tercih Edilen Mevki
              </label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              >
                <option value="Kaleci">Kaleci</option>
                <option value="Defans">Defans</option>
                <option value="Orta Saha">Orta Saha</option>
                <option value="Forvet">Forvet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Ek Notlar (Opsiyonel)
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Önceki kulüp deneyimi, lisans durumu veya notlar..."
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)] text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.kvkk_accepted}
                onChange={(e) =>
                  setForm({ ...form, kvkk_accepted: e.target.checked })
                }
                className="mt-0.5 accent-[var(--brand-navy)]"
              />
              <span className="text-[var(--text-secondary)]">
                6698 sayılı KVKK Aydınlatma Metni&apos;ni okudum ve anladım.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent_accepted}
                onChange={(e) =>
                  setForm({ ...form, consent_accepted: e.target.checked })
                }
                className="mt-0.5 accent-[var(--brand-red)]"
              />
              <span className="text-[var(--text-secondary)]">
                {minor
                  ? "Velisi/vasisi olarak sporcunun kişisel verilerinin kulüp faaliyetleri kapsamında işlenmesine Açık Rıza veriyorum."
                  : "Kişisel verilerimin kulüp faaliyetleri kapsamında işlenmesine Açık Rıza veriyorum."}
              </span>
            </label>
          </div>

          {resultMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold ${
                resultMsg.ok
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                  : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
              }`}
            >
              {resultMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-black cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Başvuru Gönderiliyor..." : "Üyelik Başvurusunu Gönder"}
          </button>
        </form>
      </main>
    </div>
  );
}