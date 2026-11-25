"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar } from "@/components/ikbal/Navbar";
import { Vitrin } from "@/components/ikbal/Motion";
import { EASE } from "@/lib/motion";
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

      <section className="k-sahne text-white py-8 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            Çorum İkbal Spor Kulübü • İletişim &amp; Tesisler
          </span>
          <h1 className="k-posta k-posta--wonk text-2xl sm:text-4xl text-white">
            Kulüp İletişim &amp; Saha Bilgileri
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
            Antrenman sahaları, harita konumları, maç organizasyonları ve
            veli/sporcu iletişim kanalları.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Vitrin className="lg:col-span-5 space-y-4">
          <div className="k-artik p-6 space-y-4">
            <div className="space-y-0.5">
              <span className="k-koz text-[10px] block">KONUMLAR</span>
              <h2 className="k-posta text-xl text-[var(--text-primary)]">
                Tesis &amp; Harita Bağlantıları
              </h2>
            </div>

            {FACILITIES.map((fac) => (
              <div
                key={fac.name}
                className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 space-y-2"
              >
                <div
                  className={`text-xs font-black ${
                    fac.accentRed
                      ? "text-[var(--brand-red)]"
                      : "text-[var(--brand-ink)]"
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
                  className="k-buton k-buton--lacivert !py-1.5 !px-3 !text-[11px]"
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
        </Vitrin>

        <Vitrin delay={0.08} className="lg:col-span-7">
          <form
            onSubmit={handleSendMessage}
            className="k-artik p-6 sm:p-7 space-y-4"
          >
            <div className="space-y-0.5">
              <span className="k-koz text-[10px] block">DOĞRUDAN HAT</span>
              <h2 className="k-posta text-xl text-[var(--text-primary)]">
                Kulübe Mesaj Gönder
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="k-koz text-[10px] block mb-1.5">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Adınız ve soyadınız"
                  className="k-alan"
                />
              </div>

              <div>
                <label className="k-koz text-[10px] block mb-1.5">
                  Telefon veya E-posta
                </label>
                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="05XX... veya e-posta"
                  className="k-alan"
                />
              </div>
            </div>

            <div>
              <label className="k-koz text-[10px] block mb-1.5">
                Konu / Birim
              </label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="k-alan font-bold"
              >
                <option value="Genel">Genel Bilgi</option>
                <option value="Altyapı">Altyapı &amp; Antrenman</option>
                <option value="Aidat & Malzeme">Aidat &amp; Malzeme</option>
                <option value="Maç & Organizasyon">Maç &amp; Organizasyon</option>
              </select>
            </div>

            <div>
              <label className="k-koz text-[10px] block mb-1.5">
                Mesajınız *
              </label>
              <textarea
                rows={4}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Sorunuzu veya iletmek istediğiniz notu yazın..."
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
                  className={`p-3.5 rounded-2xl text-xs font-bold ${
                    feedback.ok
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                  }`}
                >
                  {feedback.text}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={sending}
              className="k-buton k-buton--kirmizi w-full sm:w-auto !px-6 !py-3 !text-sm"
            >
              {sending ? "Gönderiliyor..." : "Mesajı Gönder"}
            </motion.button>
          </form>
        </Vitrin>
      </main>
    </div>
  );
}