"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach, UserRole } from "@/types/club";
import { sendPushViaApi } from "@/lib/club-utils";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
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

      onFeedback("Medya yüklenemedi: Lütfen Supabase Storage 'avatars' bucket izinlerini kontrol edin veya doğrudan https:// görsel bağlantısı girin.");
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

  async function handleDeleteMessage(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("club_messages").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      onFeedback("Bildirim silinemedi: " + error.message);
      return;
    }
    setHistoryMessages((prev) => prev.filter((m) => m.id !== id));
    await onLogActivity("Bildirim Silme", `Geçmiş bildirim silindi (#${id})`);
    onFeedback("Bildirim silindi.");
  }

  async function handleClearAllMessages() {
    if (historyMessages.length === 0) return;
    setClearingAll(true);
    const ids = historyMessages.map((m) => m.id);
    const { error } = await supabase.from("club_messages").delete().in("id", ids);
    setClearingAll(false);
    if (error) {
      onFeedback("Geçmiş bildirimler temizlenemedi: " + error.message);
      return;
    }
    setHistoryMessages([]);
    await onLogActivity(
      "Bildirimleri Temizle",
      `${ids.length} geçmiş bildirim/duyuru temizlendi.`
    );
    onFeedback("Tüm geçmiş bildirimler temizlendi.");
  }

  const activeSoundLabel =
    SOUND_OPTIONS.find((s) => s.value === notifSound)?.label || notifSound;
  const previewImgSrc = notifImageUrl.trim() || DEFAULT_IMAGE_URL;

  return (
    <div className="space-y-6 max-w-5xl text-[var(--text-primary)] tabular-nums">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSendCustomPush}
          className="lg:col-span-7 bg-[var(--bg-surface)] p-6 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-[var(--text-primary)]">
                İsteğe Bağlı Anlık Bildirim Gönder
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Varsayılan kulüp logosu ve bildirim sesi ile gönderilir;
                isterseniz görsel/ses yükleyip link oluşturabilirsiniz.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-[11px] font-extrabold">
              Hedef: {notifTargetGroups.join(", ")}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2">
              Hedef Kitle:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["Tümü", ...AGE_GROUPS].map((g) => {
                const selected = notifTargetGroups.includes(g);
                return (
                  <button
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                    }`}
                  >
                    {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Bildirim Başlığı *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Antrenman Saati Değişikliği"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="w-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Bildirim Mesajı *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Sporculara iletmek istediğiniz mesajı yazın..."
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="w-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          {/* Görsel Yükle & Bağlantı */}
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                Bildirim Görseli (Varsayılan: Kulüp Logosu)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotifImageUrl(DEFAULT_IMAGE_URL)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-extrabold cursor-pointer"
                >
                  Varsayılan Logo
                </button>
                <label className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-[11px] font-extrabold cursor-pointer">
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
              className="w-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs font-semibold"
            />
          </div>

          {/* Ses Seçimi, Ses Yükleme & Bağlantı */}
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                Bildirim Sesi (Varsayılan: Telefon Bildirim Sesi)
              </label>
              <label className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-[11px] font-extrabold cursor-pointer">
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
                className="flex-1 border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs font-bold"
              >
                {SOUND_OPTIONS.map((snd) => (
                  <option key={snd.value} value={snd.value}>
                    {snd.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePreviewSound}
                className="px-4 py-2 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-extrabold cursor-pointer shrink-0"
              >
                Sesi Dinle
              </button>
            </div>

            <input
              type="text"
              value={customAudioUrl}
              onChange={(e) => setCustomAudioUrl(e.target.value)}
              placeholder="İsteğe bağlı özel ses dosyası linki (yükleyince otomatik oluşur)"
              className="w-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs font-semibold"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={notifSaveAnnouncement}
              onChange={(e) => setNotifSaveAnnouncement(e.target.checked)}
            />
            Uygulama ve web sitesindeki Duyurular bölümüne de kaydet
          </label>

          <button
            type="submit"
            disabled={notifSending}
            className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white font-extrabold px-6 py-3 rounded-xl text-sm cursor-pointer disabled:opacity-60 transition"
          >
            {notifSending ? "Gönderiliyor..." : "Bildirimi Gönder"}
          </button>
        </form>

        <aside className="lg:col-span-5 bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--brand-red)]">
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

      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-[var(--text-primary)]">
              Geçmiş Bildirimler, Duyurular &amp; Gelen Mesajlar (
              {historyMessages.length})
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Kulübe gönderilen iletişim mesajları ve geçmiş bildirimleri yönetin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
            >
              {historyLoading ? "Yenileniyor..." : "Yenile"}
            </button>
            <button
              type="button"
              onClick={handleClearAllMessages}
              disabled={clearingAll || historyMessages.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
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
            {historyMessages.map((msg) => {
              const text = (msg.body || msg.message_text || "").trim();
              const isContactMsg =
                msg.age_group === "Admin" ||
                text.startsWith("İletişim Mesajı");
              return (
                <div
                  key={msg.id}
                  className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border ${
                    isContactMsg
                      ? "border-amber-400/60 bg-[var(--status-warning-bg)]/30"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-white ${
                          isContactMsg
                            ? "bg-[var(--brand-red)]"
                            : "bg-[var(--brand-navy)]"
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
                    disabled={deletingId === msg.id}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === msg.id ? "Siliniyor..." : "Sil"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}