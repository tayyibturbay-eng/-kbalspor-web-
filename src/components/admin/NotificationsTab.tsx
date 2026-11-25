"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach, UserRole } from "@/types/club";
import { sendPushViaApi } from "@/lib/club-utils";
import { SPRING } from "@/lib/motion";

const supabase = createClient();
const DEFAULT_IMAGE_URL = "https://ikbalspor.com/logo.png";

interface ClubMessageRow {
  id: string;
  body?: string | null;
  message_text?: string | null;
  age_group?: string | null;
  sender_name?: string | null;
  created_at?: string | null;
}

interface NotificationsTabProps {
  role: UserRole;
  adminName: string;
  activeCoach: Coach | null;
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
}

const SOUND_OPTIONS = [
  {
    value: "default",
    label: "Varsayılan Bildirim Sesi",
    freq: 740,
    type: "sine" as OscillatorType,
  },
  {
    value: "whistle_alert",
    label: "Düdük & Tribün Sesi",
    freq: 880,
    type: "triangle" as OscillatorType,
  },
  {
    value: "chime_soft",
    label: "Yumuşak Kulüp Sinyali",
    freq: 660,
    type: "sine" as OscillatorType,
  },
  {
    value: "urgent_horn",
    label: "Acil Maç / Duyuru Uyarısı",
    freq: 520,
    type: "sawtooth" as OscillatorType,
  },
] as const;

export function NotificationsTab({
  role,
  adminName,
  activeCoach,
  onFeedback,
  onLogActivity,
}: NotificationsTabProps) {
  const [notifTargetGroups, setNotifTargetGroups] = useState<string[]>(["Tümü"]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifImageUrl, setNotifImageUrl] = useState(DEFAULT_IMAGE_URL);
  const [notifSound, setNotifSound] = useState<string>("default");
  const [customAudioUrl, setCustomAudioUrl] = useState<string>("");
  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);
  const [notifSaveAnnouncement, setNotifSaveAnnouncement] = useState(true);
  const [notifSending, setNotifSending] = useState(false);

  const [historyMessages, setHistoryMessages] = useState<ClubMessageRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("club_messages")
      .select("id, body, message_text, age_group, sender_name, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistoryLoading(false);
    if (!error && data) {
      setHistoryMessages(data as ClubMessageRow[]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadHistoryAsync = async () => {
      const { data, error } = await supabase
        .from("club_messages")
        .select("id, body, message_text, age_group, sender_name, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (!error && data) {
        setHistoryMessages(data as ClubMessageRow[]);
      }
    };

    void loadHistoryAsync();

    return () => {
      active = false;
    };
  }, []);

  function playTonePreview(soundKey: string) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const selected =
        SOUND_OPTIONS.find((s) => s.value === soundKey) || SOUND_OPTIONS[0];
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = selected.type;
      osc.frequency.value = selected.freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // sessiz geç
    }
  }

  function handlePreviewSound() {
    if (customAudioUrl.trim()) {
      try {
        const audio = new Audio(customAudioUrl.trim());
        void audio.play().catch(() => {
          playTonePreview(notifSound);
        });
        return;
      } catch {
        // fallback
      }
    }
    playTonePreview(notifSound);
  }

  async function uploadOrCreateLink(file: File, folder: "images" | "sounds") {
    setUploadingMedia(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `notifications/${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      for (const bucket of ["club-media", "avatars"]) {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            upsert: true,
            contentType: file.type || undefined,
          });
        if (!error) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          if (data?.publicUrl) {
            if (folder === "images") {
              setNotifImageUrl(data.publicUrl);
              onFeedback("Görsel yüklendi ve genel HTTPS bağlantısı oluşturuldu.");
            } else {
              setCustomAudioUrl(data.publicUrl);
              onFeedback("Ses dosyası yüklendi ve genel HTTPS bağlantısı oluşturuldu.");
            }
            return;
          }
        }
      }

      onFeedback(
        "Medya yüklenemedi: Lütfen Supabase Storage bucket izinlerini kontrol edin veya doğrudan https:// görsel bağlantısı girin."
      );
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleSendCustomPush(e: React.FormEvent) {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      onFeedback("Lütfen bildirim başlığı ve mesajını yazın.");
      return;
    }
    setNotifSending(true);
    const groups = notifTargetGroups.length === 0 ? ["Tümü"] : notifTargetGroups;
    const rawImg = notifImageUrl.trim() || DEFAULT_IMAGE_URL;
    const resolvedImage = rawImg.startsWith("/")
      ? `https://ikbalspor.com${rawImg}`
      : rawImg;
    const activeSoundValue = notifSound || "default";

    const pushRes = await sendPushViaApi(
      groups,
      notifTitle.trim(),
      notifBody.trim(),
      {
        imageUrl: resolvedImage,
        sound: activeSoundValue,
      }
    );

    if (notifSaveAnnouncement) {
      const notifCombined = `${notifTitle.trim()}\n${notifBody.trim()}\nGörsel: ${resolvedImage}\nSes: ${activeSoundValue}${
        customAudioUrl.trim() ? ` (${customAudioUrl.trim()})` : ""
      }`.trim();

      await supabase.from("club_messages").insert({
        body: notifCombined,
        message_text: notifCombined,
        age_group: groups.join(", "),
        sender_name:
          role === "coach" && activeCoach
            ? activeCoach.full_name
            : adminName || "Yönetici",
        created_at: new Date().toISOString(),
      });
      await fetchHistory();
    }

    await onLogActivity(
      "Bildirim Gönderimi",
      `[${groups.join(", ")}] ${notifTitle.trim()} • Ses: ${activeSoundValue} • Görsel: ${resolvedImage} (${pushRes.sentCount} cihaz)`
    );
    setNotifSending(false);

    if (pushRes.error) {
      onFeedback(`Bildirim hatası: ${pushRes.error}`);
    } else if (pushRes.sentCount === 0) {
      onFeedback(
        "Kayıtlı telefon token'ı bulunamadı (sporcuların mobil uygulamaya giriş yapması gerekir)." +
          (notifSaveAnnouncement ? " Duyuru kaydedildi." : "")
      );
    } else {
      onFeedback(
        `${pushRes.sentCount} cihaza bildirim gönderildi (Varsayılan/Seçili Görsel ve Ses ile).`
      );
      setNotifTitle("");
      setNotifBody("");
    }
  }

  // Optimistic tekil silme + rollback
  async function handleDeleteMessage(id: string) {
    const snapshot = historyMessages;
    setHistoryMessages((prev) => prev.filter((m) => m.id !== id));
    onFeedback("Bildirim silindi.");

    const { error } = await supabase.from("club_messages").delete().eq("id", id);
    if (error) {
      setHistoryMessages(snapshot);
      onFeedback("Bildirim silinemedi, geri alındı: " + error.message);
      return;
    }
    await onLogActivity("Bildirim Silme", `Geçmiş bildirim silindi (#${id})`);
  }

  // Optimistic toplu temizleme + rollback
  async function handleClearAllMessages() {
    if (historyMessages.length === 0) return;
    const snapshot = historyMessages;
    const ids = historyMessages.map((m) => m.id);

    setClearingAll(true);
    setHistoryMessages([]);
    onFeedback("Tüm geçmiş bildirimler temizlendi.");

    const { error } = await supabase.from("club_messages").delete().in("id", ids);
    setClearingAll(false);

    if (error) {
      setHistoryMessages(snapshot);
      onFeedback("Geçmiş bildirimler temizlenemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Bildirimleri Temizle",
      `${ids.length} geçmiş bildirim/duyuru temizlendi.`
    );
  }

  const activeSoundLabel =
    SOUND_OPTIONS.find((s) => s.value === notifSound)?.label || notifSound;
  const previewImgSrc = notifImageUrl.trim() || DEFAULT_IMAGE_URL;

  return (
    <div className="space-y-6 max-w-5xl text-[var(--text-primary)] tabular-nums">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSendCustomPush}
          className="lg:col-span-7 k-artik p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="k-koz text-[10px] block">ANLIK İLETİŞİM</span>
              <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
                İsteğe Bağlı Anlık Bildirim Gönder
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Varsayılan kulüp logosu ve bildirim sesi ile gönderilir;
                isterseniz görsel/ses yükleyebilirsiniz.
              </p>
            </div>
            <span className="k-etiket k-etiket--lacivert">
              Hedef: {notifTargetGroups.join(", ")}
            </span>
          </div>

          <div>
            <label className="k-koz text-[10px] block mb-2">Hedef Kitle:</label>
            <div className="flex flex-wrap gap-1.5">
              {["Tümü", ...AGE_GROUPS].map((g) => {
                const selected = notifTargetGroups.includes(g);
                return (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    key={g}
                    onClick={() => {
                      if (g === "Tümü") {
                        setNotifTargetGroups(["Tümü"]);
                      } else {
                        const withoutAll = notifTargetGroups.filter(
                          (x) => x !== "Tümü"
                        );
                        const next = selected
                          ? withoutAll.filter((x) => x !== g)
                          : [...withoutAll, g];
                        setNotifTargetGroups(next.length === 0 ? ["Tümü"] : next);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-2xs"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="k-koz text-[10px] block mb-1.5">
              Bildirim Başlığı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Antrenman Saati Değişikliği"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="k-alan font-bold"
            />
          </div>

          <div>
            <label className="k-koz text-[10px] block mb-1.5">
              Bildirim Mesajı *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Sporculara iletmek istediğiniz mesajı yazın..."
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="k-alan"
            />
          </div>

          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="k-koz text-[10px]">
                Bildirim Görseli (Varsayılan: Kulüp Logosu)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotifImageUrl(DEFAULT_IMAGE_URL)}
                  className="k-buton k-buton--hayalet !py-1 !px-2.5 !text-[11px]"
                >
                  Varsayılan Logo
                </button>
                <label className="k-buton k-buton--lacivert !py-1 !px-2.5 !text-[11px]">
                  {uploadingMedia ? "Yükleniyor..." : "Görsel Yükle & Link Al"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadOrCreateLink(f, "images");
                    }}
                  />
                </label>
              </div>
            </div>
            <input
              type="text"
              value={notifImageUrl}
              onChange={(e) => setNotifImageUrl(e.target.value)}
              placeholder="https://ikbalspor.com/logo.png"
              className="k-alan !py-2 text-xs font-semibold"
            />
          </div>

          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="k-koz text-[10px]">
                Bildirim Sesi (Varsayılan: Telefon Bildirim Sesi)
              </label>
              <label className="k-buton k-buton--lacivert !py-1 !px-2.5 !text-[11px]">
                {uploadingMedia ? "Yükleniyor..." : "Ses Yükle & Link Al"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadOrCreateLink(f, "sounds");
                  }}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <select
                value={notifSound}
                onChange={(e) => setNotifSound(e.target.value)}
                className="flex-1 k-alan !py-2 text-xs font-bold"
              >
                {SOUND_OPTIONS.map((snd) => (
                  <option key={snd.value} value={snd.value}>
                    {snd.label}
                  </option>
                ))}
              </select>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handlePreviewSound}
                className="k-buton k-buton--lacivert !py-2 !px-4 !text-xs shrink-0"
              >
                Sesi Dinle
              </motion.button>
            </div>

            <input
              type="text"
              value={customAudioUrl}
              onChange={(e) => setCustomAudioUrl(e.target.value)}
              placeholder="İsteğe bağlı özel ses dosyası linki (yükleyince otomatik oluşur)"
              className="k-alan !py-2 text-xs font-semibold"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={notifSaveAnnouncement}
              onChange={(e) => setNotifSaveAnnouncement(e.target.checked)}
              className="accent-[var(--brand-red)]"
            />
            Uygulama ve web sitesindeki Duyurular bölümüne de kaydet
          </label>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={notifSending}
            className="k-buton k-buton--kirmizi !px-6 !py-3 !text-sm"
          >
            {notifSending ? "Gönderiliyor..." : "Bildirimi Gönder"}
          </motion.button>
        </form>

        <aside className="lg:col-span-5 k-artik p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="k-koz text-[10px] text-[var(--brand-red)]">
              Canlı Bildirim Önizleme
            </span>
            <span className="text-[11px] font-bold text-[var(--text-muted)]">
              {activeSoundLabel}
            </span>
          </div>

          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <img
                src={previewImgSrc}
                alt="Bildirim görseli önizleme"
                className="w-12 h-12 rounded-xl object-cover bg-white border border-[var(--border-subtle)] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold text-[var(--text-muted)]">
                  <span>ÇORUM İKBAL SPOR KULÜBÜ</span>
                  <span>Şimdi</span>
                </div>
                <div className="text-sm font-black text-[var(--text-primary)] mt-0.5 break-words">
                  {notifTitle.trim() || "Bildirim Başlığı Burada Görünür"}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-line break-words">
                  {notifBody.trim() ||
                    "Sporculara ve velilere gidecek bildirim metni burada önizlenir."}
                </p>
              </div>
            </div>

            <img
              src={previewImgSrc}
              alt="Seçilen bildirim banner görseli"
              className="w-full h-32 rounded-xl object-cover border border-[var(--border-subtle)] bg-white"
            />

            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
              <span>Hedef: {notifTargetGroups.join(", ")}</span>
              <span>Ses: {notifSound}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="k-artik p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="k-koz text-[10px] block">KAYIT ARŞİVİ</span>
            <h3 className="k-posta text-lg text-[var(--text-primary)]">
              Geçmiş Bildirimler, Duyurular &amp; Gelen Mesajlar (
              {historyMessages.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="k-buton k-buton--hayalet !py-1.5 !px-3 !text-xs"
            >
              {historyLoading ? "Yenileniyor..." : "Yenile"}
            </button>
            <button
              type="button"
              onClick={handleClearAllMessages}
              disabled={clearingAll || historyMessages.length === 0}
              className="k-buton k-buton--kirmizi !py-1.5 !px-3.5 !text-xs"
            >
              {clearingAll ? "Temizleniyor..." : "Tamamını Temizle"}
            </button>
          </div>
        </div>

        {historyMessages.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
            Henüz kayıtlı geçmiş bildirim veya duyuru bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {historyMessages.map((msg) => {
                const text = (msg.body || msg.message_text || "").trim();
                const isContactMsg =
                  msg.age_group === "Admin" ||
                  text.startsWith("İletişim Mesajı");
                return (
                  <motion.div
                    layout
                    key={msg.id}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={SPRING.yumusak}
                    className={`flex items-start justify-between gap-3 p-4 rounded-2xl border ${
                      isContactMsg
                        ? "border-amber-400/60 bg-[var(--status-warning-bg)]/30"
                        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--text-muted)] mb-1">
                        <span
                          className={`k-etiket ${
                            isContactMsg
                              ? "k-etiket--tehlike"
                              : "k-etiket--lacivert"
                          }`}
                        >
                          {isContactMsg
                            ? "Gelen Mesaj"
                            : msg.age_group || "Tümü"}
                        </span>
                        <span>{msg.sender_name || "Yönetici"}</span>
                        {msg.created_at && (
                          <span>
                            {new Date(msg.created_at).toLocaleString("tr-TR")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[var(--text-primary)] whitespace-pre-line break-words">
                        {text || "(İçerik yok)"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition"
                    >
                      Sil
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}