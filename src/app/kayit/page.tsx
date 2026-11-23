"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS } from "@/types/club";

const supabase = createClient();

export default function MembershipRequestPage() {
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [ageGroup, setAgeGroup] = useState<string>(AGE_GROUPS[0] || "U11");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!fullName.trim() || !guardianPhone.trim()) {
      setFeedback({
        ok: false,
        text: "Lütfen sporcu adı soyadı ve veli/iletişim telefonunu girin.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("membership_requests").insert({
      full_name: fullName.trim(),
      birth_date: birthDate || null,
      age_group: ageGroup,
      guardian_name: guardianName.trim() || null,
      guardian_phone: guardianPhone.trim(),
      notes: notes.trim() || null,
      status: "Beklemede",
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
      text: "Üyelik başvurunuz alındı. Kulüp yönetimimiz en kısa sürede sizinle iletişime geçecektir.",
    });
    setFullName("");
    setBirthDate("");
    setGuardianName("");
    setGuardianPhone("");
    setNotes("");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white py-7 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
            Çorum İkbalspor • Kayıt &amp; Altyapı
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Kulüp Üyelik Başvurusu
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-1">
            Yaş grubu seçerek altyapı ve kulüp üyelik başvurunuzu kolayca
            iletebilirsiniz.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 sm:p-8 shadow-xs space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Sporcu Ad Soyad *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Örn: Emir Kaya"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Doğum Tarihi
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Yaş Grubu *
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              >
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Veli Ad Soyad
              </label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Veli adı soyadı"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                İletişim Telefonu *
              </label>
              <input
                type="tel"
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Ek Notlar
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Daha önce oynadığı kulüp, sağlık/lisans notları vb."
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
            />
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-extrabold ${
                feedback.ok
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                  : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-black cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Başvuru Gönderiliyor..." : "Başvuruyu Gönder"}
          </button>
        </form>
      </main>
    </div>
  );
}