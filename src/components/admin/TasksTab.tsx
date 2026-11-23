// TasksTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

function isTaskUpcoming(task: TaskAssignment, nowMs: number): boolean {
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
      return eventDt.getTime() >= nowMs;
    }
  }

  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
  if (Number.isNaN(endOfDay.getTime())) return false;
  return endOfDay.getTime() >= nowMs;
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
    age_group: "Minikler",
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
  const [nowMs, setNowMs] = useState<number>(0);

  const [matchWaPreview, setMatchWaPreview] = useState<{
    message: string;
    targets: Player[];
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const { upcomingTasks, pastTasks } = useMemo(() => {
    if (!nowMs) {
      return { upcomingTasks: tasks, pastTasks: [] as TaskAssignment[] };
    }
    return {
      upcomingTasks: tasks.filter((t) => isTaskUpcoming(t, nowMs)),
      pastTasks: tasks.filter((t) => !isTaskUpcoming(t, nowMs)),
    };
  }, [tasks, nowMs]);

  async function handleSyncCorumfit() {
    setSyncingCorumfit(true);
    try {
      const res = await fetch("/api/sync-corumfit-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:
            corumfitUrl.trim() || "https://corumfit.org/index.asp?id=hft_prg",
          html: corumfitHtml.trim() ? corumfitHtml : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onFeedback(
          `Corumfit senkronizasyonu başarısız: ${
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
        `Corumfit tarandı: ${data.foundUpcomingMatches ?? 0} güncel İkbalspor maçı bulundu, ${
          data.insertedCount ?? 0
        } yeni maç eklendi.`
      );
    } catch (err) {
      onFeedback(
        `Senkronizasyon hatası: ${
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
    const msg = `${baseMsg}\nKonum Haritası: ${mapsLink}`;

    const taskCombined = `MAÇ / ETKİNLİK BİLGİLENDİRMESİ: ${newTask.title} (${newTask.age_group})\n${msg}`;
    await supabase.from("club_messages").insert({
      body: taskCombined,
      message_text: taskCombined,
      age_group: newTask.age_group || "Tümü",
      sender_name:
        role === "coach" && activeCoach
          ? `Antrenör ${activeCoach.full_name}`
          : adminName || "Yönetici",
      created_at: new Date().toISOString(),
    });

    const pushRes = await sendPushViaApi(
      ["Tümü"],
      `Yeni Maç / Etkinlik: ${newTask.title}`,
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
      `Maç ve harita bağlantısı kaydedildi, tüm oyunculara bildirim gönderildi (${pushRes.sentCount} telefon).`
    );
    setNewTask({
      title: "",
      task_type: "mac",
      age_group: "Minikler",
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
    if (!confirm(`"${task.title}" kaydını silmek istediğinize emin misiniz?`))
      return;
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
    onFeedback(`"${task.title}" silindi.`);
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
    const msg = `${baseMsg}\nKonum Haritası: ${mapsLink}`;

    const remCombined = `YARIN MAÇ VAR: ${t.title}\n${msg}`;
    await supabase.from("club_messages").insert({
      body: remCombined,
      message_text: remCombined,
      age_group: t.age_group || "Tümü",
      sender_name: "Maç Hatırlatma",
      created_at: new Date().toISOString(),
    });
    const pushRes = await sendPushViaApi(
      ["Tümü"],
      `YARIN MAÇ VAR: ${t.title}`,
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
      `Hatırlatma bildirimi tüm oyunculara gönderildi (${pushRes.sentCount} telefon).`
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-[var(--text-primary)]">
              Corumfit Haftalık Maç Senkronizasyon Ajanı
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Verilen sayfadaki güncel İkbalspor maçlarını çeker; bozuk/geçmiş
              tarihli maçları atlar ve çift kayıt oluşturmadan sisteme ekler.
            </p>
          </div>
          <button
            type="button"
            disabled={syncingCorumfit}
            onClick={handleSyncCorumfit}
            className="bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] disabled:opacity-50 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer shrink-0 transition"
          >
            {syncingCorumfit ? "Taranıyor..." : "İkbalspor Maçlarını Çek"}
          </button>
        </div>

        <input
          type="url"
          value={corumfitUrl}
          onChange={(e) => setCorumfitUrl(e.target.value)}
          placeholder="https://corumfit.org/index.asp?id=hft_prg"
          className="w-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs sm:text-sm"
        />

        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-semibold text-[var(--brand-navy)] dark:text-sky-300">
            Site sunucudan doğrudan çekilemezse sayfa HTML kaynağını buraya
            yapıştır
          </summary>
          <textarea
            rows={3}
            value={corumfitHtml}
            onChange={(e) => setCorumfitHtml(e.target.value)}
            placeholder="İsteğe bağlı: Corumfit sayfasının HTML kodu..."
            className="mt-2 w-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl p-2.5 text-xs font-mono"
          />
        </details>
      </div>

      <form
        onSubmit={addTask}
        className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4"
      >
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Yeni Maç / Etkinlik Ekle
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            required
            placeholder="Başlık (Örn: İkbalspor - Çorumspor)"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={newTask.task_type}
            onChange={(e) =>
              setNewTask({ ...newTask, task_type: e.target.value })
            }
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm"
          >
            <option value="mac">Maç</option>
            <option value="etkinlik">Etkinlik</option>
          </select>
          <select
            value={newTask.age_group}
            onChange={(e) =>
              setNewTask({ ...newTask, age_group: e.target.value })
            }
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm"
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
              className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-2 py-2 text-xs"
            />
            <input
              type="time"
              required
              value={newTask.match_time}
              onChange={(e) =>
                setNewTask({ ...newTask, match_time: e.target.value })
              }
              className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-2 py-2 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <select
            value={newTask.field_choice}
            onChange={(e) =>
              setNewTask({ ...newTask, field_choice: e.target.value })
            }
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm"
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
              className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm"
            />
          )}

          <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] p-2.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <input
              type="checkbox"
              checked={newTask.has_shuttle}
              onChange={(e) =>
                setNewTask({ ...newTask, has_shuttle: e.target.checked })
              }
            />
            {newTask.has_shuttle
              ? "Servis Var (2 saat önce Nazmi Avluca'da)"
              : "Servis Yok (1 saat önce maç sahasında)"}
          </label>
        </div>

        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <span>Otomatik Harita Bağlantısı:</span>
          <a
            href={buildMapsUrl(
              newTask.field_choice === "Diğer"
                ? newTask.custom_location || "Çorum"
                : newTask.field_choice
            )}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--brand-navy)] dark:text-sky-300 font-bold underline"
          >
            Google Maps&apos;te Önizle
          </a>
        </div>

        <button
          type="submit"
          className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white font-extrabold rounded-xl px-6 py-2.5 text-sm cursor-pointer transition"
        >
          Maçı / Etkinliği Kaydet &amp; Tüm Oyunculara Bildirim Gönder
        </button>
      </form>

      {matchWaPreview && (
        <div className="bg-[var(--status-success-bg)]/60 border border-[var(--status-success-text)]/30 p-4 rounded-2xl space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-bold text-[var(--status-success-text)]">
              Maç / Etkinlik WhatsApp Mesajı
            </h3>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                matchWaPreview.message
              )}`}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-600 text-white text-xs font-extrabold px-4 py-2 rounded-xl"
            >
              WhatsApp Grubunda Paylaş
            </a>
          </div>
          <pre className="text-xs bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-subtle)] whitespace-pre-wrap text-[var(--text-primary)]">
            {matchWaPreview.message}
          </pre>
        </div>
      )}

      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3">
        <h3 className="font-black text-[var(--text-primary)] text-base">
          Yaklaşan Maçlar &amp; Etkinlikler ({upcomingTasks.length})
        </h3>
        {upcomingTasks.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Yaklaşan kayıt yok.
          </p>
        ) : (
          upcomingTasks.map((t) => (
            <div
              key={t.id}
              className="border-b border-[var(--border-subtle)] last:border-b-0 pb-3 last:pb-0 text-sm flex flex-wrap justify-between items-center gap-2"
            >
              <div className="space-y-0.5">
                <div>
                  <strong>{t.title}</strong> ({t.age_group}) —{" "}
                  {formatDisplayDate(t.event_date)}{" "}
                  {t.match_time ? `• ${t.match_time}` : ""}
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                  <span>Yer: {t.location || "Konum belirtilmedi"}</span>
                  {t.location && (
                    <a
                      href={buildMapsUrl(t.location)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--brand-navy)] dark:text-sky-300 font-bold underline"
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
                  Bildirim &amp; WP Gönder
                </button>
                <button
                  type="button"
                  disabled={deletingId === t.id}
                  onClick={() => deleteTask(t)}
                  className="bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--brand-red)] text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {deletingId === t.id ? "Siliniyor..." : "Sil"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {pastTasks.length > 0 && (
        <div className="bg-[var(--bg-subtle)] p-5 rounded-2xl border border-[var(--border-subtle)] space-y-2.5">
          <h3 className="font-extrabold text-[var(--text-secondary)] text-sm">
            Geçmiş Maçlar &amp; Etkinlikler ({pastTasks.length})
          </h3>
          {pastTasks.slice(0, 20).map((t) => (
            <div
              key={t.id}
              className="border-b border-[var(--border-subtle)] last:border-b-0 pb-2 last:pb-0 text-xs text-[var(--text-secondary)] flex flex-wrap justify-between items-center gap-2"
            >
              <span>
                <strong className="text-[var(--text-primary)]">
                  {t.title}
                </strong>{" "}
                ({t.age_group}) — {t.location || "-"}
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
                  className="text-[var(--brand-red)] hover:underline font-bold cursor-pointer disabled:opacity-50"
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