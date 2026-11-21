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
    task_type: "Mac",
    age_group: "U15",
    event_date: "",
    match_time: "14:00",
    field_choice: "Nazmi Avluca Spor Tesisi",
    custom_location: "",
    has_shuttle: true,
    squad_player_ids: [] as string[],
    notes: "",
  });

  const [matchWaPreview, setMatchWaPreview] = useState<{
    message: string;
    targets: Player[];
  } | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const { upcomingTasks, pastTasks } = useMemo(() => {
    return {
      upcomingTasks: tasks.filter((t) => (t.event_date || "") >= todayStr),
      pastTasks: tasks.filter((t) => (t.event_date || "") < todayStr),
    };
  }, [tasks, todayStr]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const finalLocation =
      newTask.field_choice === "Diğer"
        ? newTask.custom_location.trim() || "Özel Saha"
        : newTask.field_choice;
    const mapsLink = buildMapsUrl(finalLocation);
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
      event_date: newTask.event_date,
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

    const baseMsg = buildSympatheticMatchMessage({
      title: newTask.title,
      event_date: newTask.event_date,
      match_time: newTask.match_time,
      location: finalLocation,
      has_shuttle: newTask.has_shuttle,
      age_group: newTask.age_group,
    });
    const msg = `${baseMsg}\n📍 Konum Haritası: ${mapsLink}`;

    await supabase.from("club_messages").insert({
      title: `⚽ MAÇ BİLGİLENDİRMESİ: ${newTask.title} (${newTask.age_group})`,
      body: msg,
      target_group: newTask.age_group,
      sender_name:
        role === "coach" && activeCoach
          ? `Antrenör ${activeCoach.full_name}`
          : adminName || "Yönetici",
    });

    const pushRes = await sendPushViaApi(
      [newTask.age_group],
      `⚽ Yeni Maç: ${newTask.title}`,
      `${newTask.event_date} ${newTask.match_time} • ${finalLocation}`
    );

    await onLogActivity(
      "Maç Ekleme",
      `${newTask.title} (${newTask.age_group}) — ${newTask.event_date} ${finalLocation}`
    );
    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    onFeedback(
      `✅ Maç ve harita bağlantısı kaydedildi (${pushRes.sentCount} telefon)!`
    );
    setNewTask({
      title: "",
      task_type: "Mac",
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

  async function sendOneDayBeforeReminder(t: TaskAssignment) {
    const mapsLink = buildMapsUrl(t.location);
    const baseMsg = buildSympatheticMatchMessage({
      title: t.title,
      event_date: t.event_date,
      match_time: t.match_time || "14:00",
      location: t.location,
      has_shuttle: t.has_shuttle ?? true,
      age_group: t.age_group,
    });
    const msg = `${baseMsg}\n📍 Konum Haritası: ${mapsLink}`;
    const squadIds =
      t.squad_player_ids && t.squad_player_ids.length > 0
        ? t.squad_player_ids
        : players.filter((p) => p.age_group === t.age_group).map((p) => p.id);

    await supabase.from("club_messages").insert({
      title: `⏰ YARIN MAÇ VAR! ${t.title}`,
      body: msg,
      target_group: t.age_group,
      sender_name: "Maç Hatırlatma",
    });
    const pushRes = await sendPushViaApi(
      [t.age_group],
      `⏰ YARIN MAÇ VAR! ${t.title}`,
      `${t.event_date} ${t.match_time || "14:00"} • ${t.location}`
    );
    await onLogActivity(
      "Maç Hatırlatma",
      `${t.title} (${t.age_group}) için 1 gün öncesi hatırlatma gönderildi.`
    );

    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    onFeedback(
      `✅ 1 gün öncesi maç hatırlatma bildirimi yayınlandı (${pushRes.sentCount} telefon)!`
    );
  }

  return (
    <div className="space-y-6 text-slate-900">
      <form
        onSubmit={addTask}
        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4"
      >
        <h2 className="text-lg font-extrabold text-[#02274c]">
          Yeni Maç / Etkinlik Ekle
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            placeholder="Başlık (Örn: İkbalspor - Çorumspor)"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          />
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
          <input
            type="date"
            required
            value={newTask.event_date}
            onChange={(e) =>
              setNewTask({ ...newTask, event_date: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="time"
            required
            value={newTask.match_time}
            onChange={(e) =>
              setNewTask({ ...newTask, match_time: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          />
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
          Maçı / Etkinliği Kaydet & Bildirim Gönder
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
                  <strong>{t.title}</strong> ({t.age_group}) — {t.event_date}{" "}
                  {t.match_time || ""}
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
              <button
                type="button"
                onClick={() => sendOneDayBeforeReminder(t)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                ⏰ 1 Gün Önce Bildirim & WP Gönder
              </button>
            </div>
          ))
        )}
      </div>

      {pastTasks.length > 0 && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2.5">
          <h3 className="font-extrabold text-slate-700 text-sm">
            Geçmiş Maçlar & Etkinlikler ({pastTasks.length})
          </h3>
          {pastTasks.slice(0, 12).map((t) => (
            <div
              key={t.id}
              className="border-b border-slate-200/70 pb-2 text-xs text-slate-600 flex flex-wrap justify-between items-center gap-2"
            >
              <span>
                <strong className="text-slate-800">{t.title}</strong> (
                {t.age_group}) — {t.location || "-"}
              </span>
              <span className="font-mono">{t.event_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}