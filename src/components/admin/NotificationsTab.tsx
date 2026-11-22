"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach, UserRole } from "@/types/club";
import { sendPushViaApi } from "@/lib/club-utils";

const supabase = createClient();

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
      await supabase.from("club_messages").insert({
        title: notifTitle.trim(),
        body: notifBody.trim(),
        target_group: groups.join(", "),
        sender_name:
          role === "coach" && activeCoach
            ? activeCoach.full_name
            : adminName || "Yönetici",
      });
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

  return (
    <form
      onSubmit={handleSendCustomPush}
      className="bg-white p-6 rounded-2xl shadow-sm border space-y-4 max-w-2xl"
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
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
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
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
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
  );
}