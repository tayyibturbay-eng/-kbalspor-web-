"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { sendPushViaApi } from "@/lib/club-utils";

const supabase = createClient();

interface ClubSettingItem {
  key: string;
  value: string;
}

const FACILITIES = [
  {
    name: "Nazmi Avluca Spor Tesisi",
    address: "Ulukavak Mah., Çiftlik Çayırı 2. Cad., Merkez / Çorum",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Nazmi+Avluca+Spor+Tesisi+Corum",
    accentRed: false,
  },
  {
    name: "Mimar Sinan Amatör Futbol Sahası",
    address: "Mimar Sinan Mah., Merkez / Çorum",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Mimar+Sinan+Futbol+Sahasi+Corum",
    accentRed: true,
  },
];

export default function ContactPage() {
  const [clubPhone, setClubPhone] = useState<string>("");
  const [clubEmail, setClubEmail] = useState<string>("");
  const [senderName, setSenderName] = useState<string>("");
  const [senderContact, setSenderContact] = useState<string>("");
  const [targetGroup, setTargetGroup] = useState<string>("Genel");
  const [messageText, setMessageText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const loadClubContactSettings = useCallback(async () => {
    const { data } = await supabase
      .from("club_settings")
      .select("key, value")
      .in("key", ["club_phone", "club_email", "contact_phone", "contact_email"]);

    const rows = (data as ClubSettingItem[] | null) || [];
    for (const r of rows) {
      if (r.key === "club_phone" || r.key === "contact_phone") {
        if (r.value) setClubPhone(r.value);
      }
      if (r.key === "club_email" || r.key === "contact_email") {
        if (r.value) setClubEmail(r.value);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClubContactSettings();
    }, 0);

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadClubContactSettings();
      },
      "web-contact-live"
    );

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [loadClubContactSettings]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!senderName.trim() || !messageText.trim()) {
      setFeedback({
        ok: false,
        text: "Lütfen adınızı ve iletmek istediğiniz mesajı yazın.",
      });
      return;
    }

    setSending(true);
    const cleanName = senderName.trim();
    const cleanContact = senderContact.trim();
    const cleanBody = messageText.trim();
    const composedBody = `İletişim Mesajı [${targetGroup}] — ${cleanName}${
      cleanContact ? ` (${cleanContact})` : ""
    }: ${cleanBody}`;

    const { error } = await supabase.from("club_messages").insert({
      body: composedBody,
      message_text: composedBody,
      age_group: "Admin",
      sender_name: cleanName,
      created_at: new Date().toISOString(),
    });

    if (error) {
      setSending(false);
      setFeedback({
        ok: false,
        text: "Mesaj gönderilemedi: " + error.message,
      });
      return;
    }

    try {
      await supabase.from("activity_logs").insert({
        actor: cleanName,
        action: "Kulübe İletişim Mesajı",
        details: `[${targetGroup}] ${cleanBody}`,
      });
    } catch {
      // log kaydı başarısız olsa da mesaj kaydedildi
    }

    try {
      await sendPushViaApi(
        ["Admin"],
        `Yeni Kulüp Mesajı (${targetGroup})`,
        `${cleanName}: ${cleanBody}`,
        { sound: "default" }
      );
    } catch {
      // bildirim servisi yanıt vermezse sessiz geç
    }

    setSending(false);
    setFeedback({
      ok: true,
      text: "Mesajınız kulüp yönetimine ve admin paneline iletildi.",
    });
    setSenderName("");
    setSenderContact("");
    setMessageText("");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white py-6 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
            Çorum İkbalspor • İletişim &amp; Tesisler
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Kulüp İletişim &amp; Saha Bilgileri
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
            Antrenman sahaları, harita konumları, maç organizasyonları ve
            veli/sporcu iletişim kanalları.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-[var(--text-primary)]">
              Tesis &amp; Harita Bağlantıları
            </h2>

            {FACILITIES.map((fac) => (
              <div
                key={fac.name}
                className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-2"
              >
                <div
                  className={`text-xs font-black ${
                    fac.accentRed
                      ? "text-[var(--brand-red)]"
                      : "text-[var(--brand-navy)] dark:text-sky-300"
                  }`}
                >
                  {fac.name}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {fac.address}
                </p>
                <a
                  href={fac.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand-navy)] hover:opacity-90 text-white text-[11px] font-extrabold transition"
                >
                  Haritada Aç →
                </a>
              </div>
            ))}

            {(clubPhone || clubEmail) && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5 text-xs">
                {clubPhone && (
                  <div>
                    <span className="font-bold text-[var(--text-muted)]">
                      Telefon:{" "}
                    </span>
                    <span className="font-extrabold text-[var(--text-primary)]">
                      {clubPhone}
                    </span>
                  </div>
                )}
                {clubEmail && (
                  <div>
                    <span className="font-bold text-[var(--text-muted)]">
                      E-posta:{" "}
                    </span>
                    <span className="font-extrabold text-[var(--text-primary)]">
                      {clubEmail}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSendMessage}
          className="lg:col-span-7 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-4"
        >
          <h2 className="text-base font-black text-[var(--text-primary)]">
            Kulübe Mesaj Gönder
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Ad Soyad *
              </label>
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Adınız ve soyadınız"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Telefon veya E-posta
              </label>
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="05XX... veya e-posta"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Konu / Birim
            </label>
            <select
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
            >
              <option value="Genel">Genel Bilgi</option>
              <option value="Altyapı">Altyapı &amp; Antrenman</option>
              <option value="Aidat & Malzeme">Aidat &amp; Malzeme</option>
              <option value="Maç & Organizasyon">Maç &amp; Organizasyon</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Mesajınız *
            </label>
            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Sorunuzu veya iletmek istediğiniz notu yazın..."
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
            />
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold ${
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
            disabled={sending}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-black cursor-pointer disabled:opacity-50"
          >
            {sending ? "Gönderiliyor..." : "Mesajı Gönder"}
          </button>
        </form>
      </main>
    </div>
  );
}