"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_GROUPS,
  Coach,
  MATCH_FIELDS,
  Player,
  TaskAssignment,
  UserRole,
} from "@/types/club";
import { buildSympatheticMatchMessage, sendPushViaApi } from "@/lib/club-utils";

const supabase = createClient();

function formatDisplayDate(raw?: string | null): string {
  if (!raw) return "";
  const clean = String(raw).trim().slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return clean;
}

function isTaskUpcoming(task: TaskAssignment): boolean {
  if (!task.event_date) return false;
  const datePart = String(task.event_date).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const timeStr = String(task.match_time || "").trim();
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(timeStr);

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const eventDt = new Date(year, month, day, hours, minutes, 59, 999);
    if (!Number.isNaN(eventDt.getTime())) {
      return eventDt.getTime() >= Date.now();
    }
  }

  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
  if (Number.isNaN(endOfDay.getTime())) return false;
  return endOfDay.getTime() >= Date.now();
}

function buildMapsUrl(location?: string | null): string {
  const q = (location || "Nazmi Avluca Spor Tesisi Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

interface TasksTabProps {
  role: UserRole;
  adminName: string;
  activeCoach: Coach | null;
  players: Player[];
  tasks: TaskAssignment[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefreshTasks: () => Promise<void>;
}

export function TasksTab({
  role,
  adminName,
  activeCoach,
  players,
  tasks,
  onFeedback,
  onLogActivity,
  onRefreshTasks,
}: TasksTabProps) {
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "mac",
    age_group: "U15",
    event_date: "",
    match_time: "14:00",
    field_choice: "Nazmi Avluca Spor Tesisi",
    custom_location: "",
    has_shuttle: true,
    squad_player_ids: [] as string[],
    notes: "",
  });

  const [corumfitUrl, setCorumfitUrl] = useState(
    "https://corumfit.org/index.asp?id=hft_prg"
  );
  const [corumfitHtml, setCorumfitHtml] = useState("");
  const [syncingCorumfit, setSyncingCorumfit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [matchWaPreview, setMatchWaPreview] = useState<{
    message: string;
    targets: Player[];
  } | null>(null);

  const { upcomingTasks, pastTasks } = useMemo(() => {
    return {
      upcomingTasks: tasks.filter((t) => isTaskUpcoming(t)),
      pastTasks: tasks.filter((t) => !isTaskUpcoming(t)),
    };
  }, [tasks]);

  async function handleSyncCorumfit() {
    setSyncingCorumfit(true);
    try {
      const res = await fetch("/api/sync-corumfit-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: corumfitUrl.trim() || "https://corumfit.org/index.asp?id=hft_prg",
          html: corumfitHtml.trim() ? corumfitHtml : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onFeedback(
          `⚠️ Corumfit senkronizasyonu başarısız: ${
            data.error || "Bilinmeyen hata"
          }`
        );
        return;
      }

      await onLogActivity(
        "Corumfit Maç Senkronizasyonu",
        `${data.insertedCount ?? 0} yeni İkbalspor maçı eklendi (Bulunan güncel: ${
          data.foundUpcomingMatches ?? 0
        }).`
      );
      await onRefreshTasks();
      onFeedback(
        `✅ Corumfit tarandı: ${data.foundUpcomingMatches ?? 0} güncel İkbalspor maçı bulundu, ${
          data.insertedCount ?? 0
        } yeni maç eklendi.`
      );
    } catch (err) {
      onFeedback(
        `⚠️ Senkronizasyon hatası: ${
          err instanceof Error ? err.message : "Bilinmeyen hata"
        }`
      );
    } finally {
      setSyncingCorumfit(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const finalLocation =
      newTask.field_choice === "Diğer"
        ? newTask.custom_location.trim() || "Özel Saha"
        : newTask.field_choice;
    const mapsLink = buildMapsUrl(finalLocation);
    const cleanDate = newTask.event_date.slice(0, 10);
    const squadIds =
      newTask.squad_player_ids.length > 0
        ? newTask.squad_player_ids
        : players
            .filter((p) => p.age_group === newTask.age_group)
            .map((p) => p.id);

    const { error } = await supabase.from("tasks_assignments").insert({
      title: newTask.title,
      task_type: newTask.task_type,
      age_group: newTask.age_group,
      event_date: cleanDate,
      match_time: newTask.match_time,
      has_shuttle: newTask.has_shuttle,
      squad_player_ids: squadIds,
      location: finalLocation,
      notes: newTask.notes || null,
    });

    if (error) {
      onFeedback("Maç eklenemedi: " + error.message);
      return;
    }

    const formattedDate = formatDisplayDate(cleanDate);
    const baseMsg = buildSympatheticMatchMessage({
      title: newTask.title,
      event_date: formattedDate,
      match_time: newTask.match_time,
      location: finalLocation,
      has_shuttle: newTask.has_shuttle,
      age_group: newTask.age_group,
    });
    const msg = `${baseMsg}\n📍 Konum Haritası: ${mapsLink}`;

    await supabase.from("club_messages").insert({
      title: `⚽ MAÇ / ETKİNLİK BİLGİLENDİRMESİ: ${newTask.title} (${newTask.age_group})`,
      body: msg,
      target_group: "Tümü",
      sender_name:
        role === "coach" && activeCoach
          ? `Antrenör ${activeCoach.full_name}`
          : adminName || "Yönetici",
    });

    // Maç ve etkinliklerde tüm oyunculara bildirim gönderilir
    const pushRes = await sendPushViaApi(
      ["Tümü"],
      `⚽ Yeni Maç / Etkinlik: ${newTask.title}`,
      `${formattedDate} ${newTask.match_time} • ${newTask.age_group} • ${finalLocation}`
    );

    await onLogActivity(
      "Maç Ekleme",
      `${newTask.title} (${newTask.age_group}) — ${formattedDate} ${finalLocation}`
    );
    setMatchWaPreview({
      message: msg,
      targets: players,
    });
    onFeedback(
      `✅ Maç ve harita bağlantısı kaydedildi, tüm oyunculara bildirim gönderildi (${pushRes.sentCount} telefon)!`
    );
    setNewTask({
      title: "",
      task_type: "mac",
      age_group: "U15",
      event_date: "",
      match_time: "14:00",
      field_choice: "Nazmi Avluca Spor Tesisi",
      custom_location: "",
      has_shuttle: true,
      squad_player_ids: [],
      notes: "",
    });
    await onRefreshTasks();
  }

  async function deleteTask(task: TaskAssignment) {
    setDeletingId(task.id);
    const { error } = await supabase
      .from("tasks_assignments")
      .delete()
      .eq("id", task.id);
    setDeletingId(null);

    if (error) {
      onFeedback("Kayıt silinemedi: " + error.message);
      return;
    }

    await onLogActivity(
      "Maç / Etkinlik Silme",
      `"${task.title}" (${task.age_group}, ${formatDisplayDate(task.event_date)}) silindi.`
    );
    onFeedback(`🗑️ "${task.title}" silindi.`);
    await onRefreshTasks();
  }

  async function sendOneDayBeforeReminder(t: TaskAssignment) {
    const mapsLink = buildMapsUrl(t.location);
    const formattedDate = formatDisplayDate(t.event_date);
    const baseMsg = buildSympatheticMatchMessage({
      title: t.title,
      event_date: formattedDate,
      match_time: t.match_time || "14:00",
      location: t.location,
      has_shuttle: t.has_shuttle ?? true,
      age_group: t.age_group,
    });
    const msg = `${baseMsg}\n📍 Konum Haritası: ${mapsLink}`;

    await supabase.from("club_messages").insert({
      title: `⏰ YARIN MAÇ VAR! ${t.title}`,
      body: msg,
      target_group: "Tümü",
      sender_name: "Maç Hatırlatma",
    });
    const pushRes = await sendPushViaApi(
      ["Tümü"],
      `⏰ YARIN MAÇ VAR! ${t.title}`,
      `${formattedDate} ${t.match_time || "14:00"} • ${t.age_group} • ${t.location}`
    );
    await onLogActivity(
      "Maç Hatırlatma",
      `${t.title} (${t.age_group}) için tüm oyunculara hatırlatma gönderildi.`
    );

    setMatchWaPreview({
      message: msg,
      targets: players,
    });
    onFeedback(
      `✅ Hatırlatma bildirimi tüm oyunculara gönderildi (${pushRes.sentCount} telefon)!`
    );
  }

  return (
    <div className="space-y-6 text-slate-900">
      {/* Corumfit Haftalık Program Senkronizasyon Ajanı */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-[#02274c]">
              🔄 Corumfit Haftalık Maç Senkronizasyon Ajanı
            </h2>
            <p className="text-xs text-slate-600">
              Verilen sayfadaki güncel İkbalspor maçlarını çeker; bozuk/geçmiş
              tarihli maçları atlar ve çift kayıt oluşturmadan sisteme ekler.
            </p>
          </div>
          <button
            type="button"
            disabled={syncingCorumfit}
            onClick={handleSyncCorumfit}
            className="bg-[#02274c] hover:bg-[#04376b] disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer shrink-0"
          >
            {syncingCorumfit ? "Taranıyor..." : "İkbalspor Maçlarını Çek"}
          </button>
        </div>

        <input
          type="url"
          value={corumfitUrl}
          onChange={(e) => setCorumfitUrl(e.target.value)}
          placeholder="https://corumfit.org/index.asp?id=hft_prg"
          className="w-full border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-xs sm:text-sm"
        />

        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-[#02274c]">
            Site sunucudan doğrudan çekilemezse sayfa HTML kaynağını buraya yapıştır
          </summary>
          <textarea
            rows={3}
            value={corumfitHtml}
            onChange={(e) => setCorumfitHtml(e.target.value)}
            placeholder="İsteğe bağlı: Corumfit sayfasının HTML kodu..."
            className="mt-2 w-full border border-slate-300 bg-white text-slate-900 rounded-lg p-2.5 text-xs font-mono"
          />
        </details>
      </div>

      <form
        onSubmit={addTask}
        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4"
      >
        <h2 className="text-lg font-extrabold text-[#02274c]">
          Yeni Maç / Etkinlik Ekle
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            required
            placeholder="Başlık (Örn: İkbalspor - Çorumspor)"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={newTask.task_type}
            onChange={(e) =>
              setNewTask({ ...newTask, task_type: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          >
            <option value="mac">Maç</option>
            <option value="etkinlik">Etkinlik</option>
          </select>
          <select
            value={newTask.age_group}
            onChange={(e) =>
              setNewTask({ ...newTask, age_group: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          >
            {AGE_GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              required
              value={newTask.event_date}
              onChange={(e) =>
                setNewTask({ ...newTask, event_date: e.target.value })
              }
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-2 py-2 text-xs"
            />
            <input
              type="time"
              required
              value={newTask.match_time}
              onChange={(e) =>
                setNewTask({ ...newTask, match_time: e.target.value })
              }
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-2 py-2 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <select
            value={newTask.field_choice}
            onChange={(e) =>
              setNewTask({ ...newTask, field_choice: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          >
            {MATCH_FIELDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>

          {newTask.field_choice === "Diğer" && (
            <input
              required
              placeholder="Konum / saha adını veya adresini yazın..."
              value={newTask.custom_location}
              onChange={(e) =>
                setNewTask({ ...newTask, custom_location: e.target.value })
              }
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
            />
          )}

          <label className="flex items-center gap-2 text-sm font-bold text-[#02274c] bg-slate-50 p-2.5 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={newTask.has_shuttle}
              onChange={(e) =>
                setNewTask({ ...newTask, has_shuttle: e.target.checked })
              }
            />
            {newTask.has_shuttle
              ? "🚌 Servis Var (2 saat önce Nazmi Avluca'da)"
              : "🚶 Servis Yok (1 saat önce maç sahasında)"}
          </label>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span>📍 Otomatik Harita Bağlantısı:</span>
          <a
            href={buildMapsUrl(
              newTask.field_choice === "Diğer"
                ? newTask.custom_location || "Çorum"
                : newTask.field_choice
            )}
            target="_blank"
            rel="noreferrer"
            className="text-[#02274c] font-bold underline"
          >
            Google Maps&apos;te Önizle
          </a>
        </div>

        <button
          type="submit"
          className="bg-[#a60513] hover:bg-[#8a0410] text-white font-bold rounded-lg px-6 py-2.5 text-sm cursor-pointer"
        >
          Maçı / Etkinliği Kaydet & Tüm Oyunculara Bildirim Gönder
        </button>
      </form>

      {matchWaPreview && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-bold text-emerald-950">
              📲 Maç / Etkinlik WhatsApp Mesajı
            </h3>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                matchWaPreview.message
              )}`}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              WhatsApp Grubunda Paylaş
            </a>
          </div>
          <pre className="text-xs bg-white p-3 rounded-lg border border-emerald-200 whitespace-pre-wrap text-slate-800">
            {matchWaPreview.message}
          </pre>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-extrabold text-[#02274c] text-base">
          Yaklaşan Maçlar & Etkinlikler ({upcomingTasks.length})
        </h3>
        {upcomingTasks.length === 0 ? (
          <p className="text-xs text-slate-500">Yaklaşan kayıt yok.</p>
        ) : (
          upcomingTasks.map((t) => (
            <div
              key={t.id}
              className="border-b border-slate-100 pb-3 text-sm flex flex-wrap justify-between items-center gap-2"
            >
              <div className="space-y-0.5">
                <div>
                  <strong>{t.title}</strong> ({t.age_group}) —{" "}
                  {formatDisplayDate(t.event_date)}{" "}
                  {t.match_time ? `• ${t.match_time}` : ""}
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                  <span>📍 {t.location || "Konum belirtilmedi"}</span>
                  {t.location && (
                    <a
                      href={buildMapsUrl(t.location)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#02274c] font-bold underline"
                    >
                      Haritada Aç
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => sendOneDayBeforeReminder(t)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  ⏰ Bildirim & WP Gönder
                </button>
                <button
                  type="button"
                  disabled={deletingId === t.id}
                  onClick={() => deleteTask(t)}
                  className="bg-red-50 hover:bg-red-100 text-[#a60513] border border-red-200 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {deletingId === t.id ? "Siliniyor..." : "Sil"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {pastTasks.length > 0 && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2.5">
          <h3 className="font-extrabold text-slate-700 text-sm">
            Geçmiş Maçlar & Etkinlikler ({pastTasks.length})
          </h3>
          {pastTasks.slice(0, 20).map((t) => (
            <div
              key={t.id}
              className="border-b border-slate-200/70 pb-2 text-xs text-slate-600 flex flex-wrap justify-between items-center gap-2"
            >
              <span>
                <strong className="text-slate-800">{t.title}</strong> (
                {t.age_group}) — {t.location || "-"}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono">
                  {formatDisplayDate(t.event_date)}
                  {t.match_time ? ` ${t.match_time}` : ""}
                </span>
                <button
                  type="button"
                  disabled={deletingId === t.id}
                  onClick={() => deleteTask(t)}
                  className="text-[#a60513] hover:underline font-bold cursor-pointer disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}