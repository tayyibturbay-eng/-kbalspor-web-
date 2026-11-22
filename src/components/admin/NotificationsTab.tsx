"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach, UserRole } from "@/types/club";
import { sendPushViaApi } from "@/lib/club-utils";

const supabase = createClient();

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
    fetchHistory();
  }, [fetchHistory]);

  async function handleSendCustomPush(e: React.FormEvent) {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      onFeedback("Lütfen bildirim başlığı ve mesajını yazın.");
      return;
    }
    setNotifSending(true);
    const groups = notifTargetGroups.length === 0 ? ["Tümü"] : notifTargetGroups;
    const pushRes = await sendPushViaApi(
      groups,
      notifTitle.trim(),
      notifBody.trim()
    );

    if (notifSaveAnnouncement) {
      const notifCombined = `${notifTitle.trim()}\n${notifBody.trim()}`.trim();
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
      `[${groups.join(", ")}] ${notifTitle.trim()} (${pushRes.sentCount} cihaz)`
    );
    setNotifSending(false);

    if (pushRes.error) {
      onFeedback(`⚠️ Bildirim hatası: ${pushRes.error}`);
    } else if (pushRes.sentCount === 0) {
      onFeedback(
        "ℹ️ Kayıtlı telefon token'ı bulunamadı (sporcuların mobil uygulamaya giriş yapması gerekir)." +
          (notifSaveAnnouncement ? " Duyuru siteye/uygulamaya kaydedildi." : "")
      );
    } else {
      onFeedback(`✅ ${pushRes.sentCount} cihaza anlık bildirim gönderildi!`);
      setNotifTitle("");
      setNotifBody("");
    }
  }

  async function handleDeleteMessage(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("club_messages").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      onFeedback("❌ Bildirim silinemedi: " + error.message);
      return;
    }
    setHistoryMessages((prev) => prev.filter((m) => m.id !== id));
    await onLogActivity("Bildirim Silme", `Geçmiş bildirim silindi (#${id})`);
    onFeedback("🗑️ Bildirim silindi.");
  }

  async function handleClearAllMessages() {
    if (historyMessages.length === 0) return;
    setClearingAll(true);
    const ids = historyMessages.map((m) => m.id);
    const { error } = await supabase.from("club_messages").delete().in("id", ids);
    setClearingAll(false);
    if (error) {
      onFeedback("❌ Geçmiş bildirimler temizlenemedi: " + error.message);
      return;
    }
    setHistoryMessages([]);
    await onLogActivity(
      "Bildirimleri Temizle",
      `${ids.length} geçmiş bildirim/duyuru temizlendi.`
    );
    onFeedback("🧹 Tüm geçmiş bildirimler temizlendi.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <form
        onSubmit={handleSendCustomPush}
        className="bg-white p-6 rounded-2xl shadow-sm border space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#02274c]">
              🔔 İsteğe Bağlı Anlık Bildirim Gönder
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Seçtiğiniz yaş gruplarındaki sporcuların telefonuna anında bildirim gönderin.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-extrabold text-[#02274c]">
            Hedef: {notifTargetGroups.join(", ")}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#02274c] mb-2">
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
                      const withoutAll = notifTargetGroups.filter((x) => x !== "Tümü");
                      const next = selected
                        ? withoutAll.filter((x) => x !== g)
                        : [...withoutAll, g];
                      setNotifTargetGroups(next.length === 0 ? ["Tümü"] : next);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    selected
                      ? "bg-[#02274c] text-white border-[#02274c]"
                      : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Bildirim Başlığı
          </label>
          <input
            type="text"
            required
            placeholder="Örn: Antrenman Saati Değişikliği"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Bildirim Mesajı
          </label>
          <textarea
            rows={4}
            required
            placeholder="Sporculara iletmek istediğiniz mesajı yazın..."
            value={notifBody}
            onChange={(e) => setNotifBody(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-[#02274c] cursor-pointer">
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
          className="bg-[#a60513] hover:bg-[#8a0410] text-white font-extrabold px-6 py-3 rounded-xl text-sm cursor-pointer disabled:opacity-60"
        >
          {notifSending ? "Gönderiliyor..." : "🔔 Bildirimi Gönder"}
        </button>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#02274c]">
              🗂️ Geçmiş Bildirimler &amp; Duyurular ({historyMessages.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tekil olarak silebilir veya tüm geçmiş kayıtları temizleyebilirsiniz.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {historyLoading ? "Yenileniyor..." : "Yenile"}
            </button>
            <button
              type="button"
              onClick={handleClearAllMessages}
              disabled={clearingAll || historyMessages.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-[#a60513] hover:bg-[#8a0410] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
            >
              {clearingAll ? "Temizleniyor..." : "🧹 Tamamını Temizle"}
            </button>
          </div>
        </div>

        {historyMessages.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Henüz kayıtlı geçmiş bildirim veya duyuru bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2.5">
            {historyMessages.map((msg) => {
              const text = (msg.body || msg.message_text || "").trim();
              return (
                <div
                  key={msg.id}
                  className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600 mb-1">
                      <span className="px-2 py-0.5 rounded bg-[#02274c] text-white">
                        {msg.age_group || "Tümü"}
                      </span>
                      <span>{msg.sender_name || "Yönetici"}</span>
                      {msg.created_at && (
                        <span>
                          {new Date(msg.created_at).toLocaleString("tr-TR")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 whitespace-pre-line break-words">
                      {text || "(İçerik yok)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    disabled={deletingId === msg.id}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold cursor-pointer disabled:opacity-50"
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