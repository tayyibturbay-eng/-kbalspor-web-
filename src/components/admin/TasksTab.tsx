"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { useOnay } from "@/components/ui/OnayDialog";
import { EASE, SPRING } from "@/lib/motion";

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
  const { onay } = useOnay();
  const azaltilmis = useReducedMotion();

  const [homeTeam, setHomeTeam] = useState("Çorum İkbal Spor");
  const [awayTeam, setAwayTeam] = useState("");
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
  const [savingTask, setSavingTask] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
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

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !deletedIds.includes(t.id)),
    [tasks, deletedIds]
  );

  const { upcomingTasks, pastTasks } = useMemo(() => {
    if (!nowMs) {
      return { upcomingTasks: visibleTasks, pastTasks: [] as TaskAssignment[] };
    }
    return {
      upcomingTasks: visibleTasks.filter((t) => isTaskUpcoming(t, nowMs)),
      pastTasks: visibleTasks.filter((t) => !isTaskUpcoming(t, nowMs)),
    };
  }, [visibleTasks, nowMs]);

  async function handleSyncCorumfit() {
    setSyncingCorumfit(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/sync-corumfit-matches", {
        method: "POST",
        headers,
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

      const insertedList = Array.isArray(data.insertedMatches)
        ? data.insertedMatches
        : [];
      let totalPushSent = 0;

      for (const m of insertedList) {
        const formattedDate = formatDisplayDate(m.event_date);
        const mapsLink = buildMapsUrl(m.location);
        const baseMsg = buildSympatheticMatchMessage({
          title: m.title,
          event_date: formattedDate,
          match_time: m.match_time || "14:00",
          location: m.location || "Nazmi Avluca Spor Tesisi",
          has_shuttle: Boolean(m.has_shuttle),
          age_group: m.age_group,
        });
        const msg = `${baseMsg}\nKonum Haritası: ${mapsLink}`;
        const taskCombined = `MAÇ / ETKİNLİK BİLGİLENDİRMESİ: ${m.title} (${m.age_group})\n${msg}`;

        await supabase.from("club_messages").insert({
          body: taskCombined,
          message_text: taskCombined,
          age_group: m.age_group || "Tümü",
          sender_name:
            role === "coach" && activeCoach
              ? `Antrenör ${activeCoach.full_name}`
              : adminName || "Yönetici",
          created_at: new Date().toISOString(),
        });

        const pushRes = await sendPushViaApi(
          ["Tümü"],
          `Yeni Maç: ${m.title}`,
          `${formattedDate} ${m.match_time || ""} • ${m.age_group} • ${m.location || "Çorum"}`
        );
        totalPushSent += pushRes.sentCount || 0;
      }

      await onLogActivity(
        "Corumfit Maç Senkronizasyonu",
        `${data.insertedCount ?? 0} yeni İkbal Spor maçı eklendi (Bulunan güncel: ${
          data.foundUpcomingMatches ?? 0
        }, Bildirim: ${totalPushSent} telefon).`
      );
      await onRefreshTasks();
      onFeedback(
        `Corumfit tarandı: ${data.foundUpcomingMatches ?? 0} güncel İkbal Spor maçı bulundu, ${
          data.insertedCount ?? 0
        } yeni maç eklendi${
          insertedList.length > 0
            ? ` ve ${totalPushSent} telefona bildirim gönderildi.`
            : "."
        }`
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
    if (savingTask) return;

    const computedTitle =
      newTask.task_type === "mac"
        ? `${homeTeam.trim()} - ${awayTeam.trim()}`.replace(/^\s*-\s*|\s*-\s*$/g, "")
        : newTask.title.trim();
    if (!computedTitle) {
      onFeedback("Lütfen maç takımlarını veya etkinlik başlığını girin.");
      return;
    }

    setSavingTask(true);
    try {
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
        title: computedTitle,
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
        title: computedTitle,
        event_date: formattedDate,
        match_time: newTask.match_time,
        location: finalLocation,
        has_shuttle: newTask.has_shuttle,
        age_group: newTask.age_group,
      });
      const msg = `${baseMsg}\nKonum Haritası: ${mapsLink}`;

      const taskCombined = `MAÇ / ETKİNLİK BİLGİLENDİRMESİ: ${computedTitle} (${newTask.age_group})\n${msg}`;
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
        `Yeni Maç / Etkinlik: ${computedTitle}`,
        `${formattedDate} ${newTask.match_time} • ${newTask.age_group} • ${finalLocation}`
      );

      await onLogActivity(
        "Maç Ekleme",
        `${computedTitle} (${newTask.age_group}) — ${formattedDate} ${finalLocation}`
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
    } finally {
      setSavingTask(false);
    }
  }

  // Optimistic silme + hata durumunda rollback
  async function deleteTask(task: TaskAssignment) {
    if (
      !(await onay(`"${task.title}" kaydını silmek istediğinize emin misiniz?`, {
        baslik: "Kaydı Sil",
        olumluMetin: "Evet, Sil",
      }))
    )
      return;

    setDeletedIds((prev) => [...prev, task.id]);
    onFeedback(`"${task.title}" silindi.`);

    const { error } = await supabase
      .from("tasks_assignments")
      .delete()
      .eq("id", task.id);

    if (error) {
      setDeletedIds((prev) => prev.filter((id) => id !== task.id));
      onFeedback("Kayıt silinemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Maç / Etkinlik Silme",
      `"${task.title}" (${task.age_group}, ${formatDisplayDate(task.event_date)}) silindi.`
    );
    await onRefreshTasks();
    setDeletedIds((prev) => prev.filter((id) => id !== task.id));
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
      {/* Corumfit Ajanı */}
      <div className="k-artik p-5 sm:p-6 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">OTOMATİK FİKSTÜR</span>
            <h2 className="k-posta text-lg text-[var(--text-primary)]">
              Corumfit Haftalık Maç Senkronizasyon Ajanı
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Güncel İkbal Spor maçlarını çeker; geçmiş maçları atlar ve çift
              kayıt oluşturmadan sisteme ekler.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            disabled={syncingCorumfit}
            onClick={handleSyncCorumfit}
            className="k-buton k-buton--lacivert shrink-0"
          >
            {syncingCorumfit ? "Taranıyor..." : "İkbal Spor Maçlarını Çek"}
          </motion.button>
        </div>

        <input
          type="url"
          value={corumfitUrl}
          onChange={(e) => setCorumfitUrl(e.target.value)}
          placeholder="https://corumfit.org/index.asp?id=hft_prg"
          className="k-alan text-xs sm:text-sm"
        />

        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-extrabold text-[var(--brand-ink)]">
            Site sunucudan doğrudan çekilemezse sayfa HTML kaynağını buraya
            yapıştır
          </summary>
          <textarea
            rows={3}
            value={corumfitHtml}
            onChange={(e) => setCorumfitHtml(e.target.value)}
            placeholder="İsteğe bağlı: Corumfit sayfasının HTML kodu..."
            className="mt-2 k-alan text-xs font-mono"
          />
        </details>
      </div>

      {/* Yeni Maç / Etkinlik Ekle */}
      <form onSubmit={addTask} className="k-artik p-5 sm:p-6 space-y-4">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">TAKVİM KAYDI</span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Yeni Maç / Etkinlik Ekle
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {newTask.task_type === "mac" ? (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <input
                  required
                  placeholder="Ev Sahibi Takım"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  className="k-alan font-bold"
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--brand-ink)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={homeTeam.trim() === "Çorum İkbal Spor"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setHomeTeam("Çorum İkbal Spor");
                        if (awayTeam.trim() === "Çorum İkbal Spor") setAwayTeam("");
                      } else if (homeTeam.trim() === "Çorum İkbal Spor") {
                        setHomeTeam("");
                      }
                    }}
                    className="accent-[var(--brand-navy)]"
                  />
                  Çorum İkbal Spor
                </label>
              </div>
              <div className="space-y-1">
                <input
                  required
                  placeholder="Deplasman Takım"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  className="k-alan font-bold"
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--brand-red)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={awayTeam.trim() === "Çorum İkbal Spor"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAwayTeam("Çorum İkbal Spor");
                        if (homeTeam.trim() === "Çorum İkbal Spor") setHomeTeam("");
                      } else if (awayTeam.trim() === "Çorum İkbal Spor") {
                        setAwayTeam("");
                      }
                    }}
                    className="accent-[var(--brand-red)]"
                  />
                  Çorum İkbal Spor
                </label>
              </div>
            </div>
          ) : (
            <input
              required
              placeholder="Etkinlik Başlığı"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="k-alan font-bold md:col-span-2"
            />
          )}
          <select
            value={newTask.task_type}
            onChange={(e) =>
              setNewTask({ ...newTask, task_type: e.target.value })
            }
            className="k-alan font-bold"
          >
            <option value="mac">Maç</option>
            <option value="etkinlik">Etkinlik</option>
          </select>
          <select
            value={newTask.age_group}
            onChange={(e) =>
              setNewTask({ ...newTask, age_group: e.target.value })
            }
            className="k-alan font-bold"
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
              className="k-alan !px-2 text-xs font-bold"
            />
            <input
              type="time"
              required
              value={newTask.match_time}
              onChange={(e) =>
                setNewTask({ ...newTask, match_time: e.target.value })
              }
              className="k-alan !px-2 text-xs font-bold text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <select
            value={newTask.field_choice}
            onChange={(e) =>
              setNewTask({ ...newTask, field_choice: e.target.value })
            }
            className="k-alan font-bold"
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
              className="k-alan font-semibold"
            />
          )}

          <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] p-2.5 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <input
              type="checkbox"
              checked={newTask.has_shuttle}
              onChange={(e) =>
                setNewTask({ ...newTask, has_shuttle: e.target.checked })
              }
              className="accent-[var(--brand-navy)]"
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
            className="k-altcizgi text-[var(--brand-ink)] font-extrabold"
          >
            Google Maps&apos;te Önizle →
          </a>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={savingTask}
          className="k-buton k-buton--kirmizi !px-6 !py-3"
        >
          {savingTask
            ? "Kaydediliyor..."
            : "Maçı / Etkinliği Kaydet & Tüm Oyunculara Bildirim Gönder"}
        </motion.button>
      </form>

      <AnimatePresence>
        {matchWaPreview && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE.yumusak }}
            className="k-artik bg-[var(--status-success-bg)]/60 border-[var(--status-success-text)]/30 p-5 space-y-3"
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-extrabold text-sm text-[var(--status-success-text)]">
                Maç / Etkinlik WhatsApp Mesajı
              </h3>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  matchWaPreview.message
                )}`}
                target="_blank"
                rel="noreferrer"
                className="k-buton !bg-emerald-600 hover:!bg-emerald-700 !text-white !py-2 !px-4 !text-xs"
              >
                WhatsApp Grubunda Paylaş
              </a>
            </div>
            <pre className="text-xs bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-subtle)] whitespace-pre-wrap text-[var(--text-primary)]">
              {matchWaPreview.message}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yaklaşan Maçlar */}
      <div className="k-artik p-5 sm:p-6 space-y-4">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">GÜNCEL PROGRAM</span>
          <h3 className="k-posta text-lg text-[var(--text-primary)]">
            Yaklaşan Maçlar &amp; Etkinlikler ({upcomingTasks.length})
          </h3>
        </div>
        {upcomingTasks.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Yaklaşan kayıt yok.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            <AnimatePresence initial={false}>
              {upcomingTasks.map((t) => (
                <motion.div
                  layout
                  key={t.id}
                  initial={azaltilmis ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={SPRING.yumusak}
                  className="py-3.5 first:pt-0 last:pb-0 text-sm flex flex-wrap justify-between items-center gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[var(--text-primary)]">
                        {t.title}
                      </strong>
                      <span className="k-etiket k-etiket--lacivert">
                        {t.age_group}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--brand-red)]">
                        {formatDisplayDate(t.event_date)}
                        {t.match_time ? ` • ${t.match_time}` : ""}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                      <span>Yer: {t.location || "Konum belirtilmedi"}</span>
                      {t.location && (
                        <a
                          href={buildMapsUrl(t.location)}
                          target="_blank"
                          rel="noreferrer"
                          className="k-altcizgi text-[var(--brand-ink)] font-extrabold"
                        >
                          Haritada Aç
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={() => sendOneDayBeforeReminder(t)}
                      className="k-buton !bg-emerald-600 hover:!bg-emerald-700 !text-white !py-1.5 !px-3 !text-xs"
                    >
                      Bildirim &amp; WP Gönder
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => deleteTask(t)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition"
                    >
                      Sil
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Geçmiş Maçlar */}
      {pastTasks.length > 0 && (
        <div className="k-artik bg-[var(--bg-subtle)] p-5 space-y-2.5">
          <h3 className="k-koz text-[10px]">
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
                <span className="font-mono font-bold">
                  {formatDisplayDate(t.event_date)}
                  {t.match_time ? ` ${t.match_time}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => deleteTask(t)}
                  className="text-[var(--brand-red)] hover:underline font-extrabold cursor-pointer"
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