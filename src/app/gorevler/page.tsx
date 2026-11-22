"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_GROUPS,
  DAYS_OF_WEEK,
  NAZMI_AVLUCA,
  TaskAssignment,
  Training,
} from "@/types/club";

const supabase = createClient();

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  const q = (location || NAZMI_AVLUCA || "Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

export default function GorevlerPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("Tümü");
  const [loading, setLoading] = useState(true);
  const todayStr = getLocalTodayStr();

  useEffect(() => {
    let active = true;
    (async () => {
      const [trRes, taskRes] = await Promise.all([
        supabase
          .from("trainings")
          .select("*")
          .order("start_time", { ascending: true }),
        supabase
          .from("tasks_assignments")
          .select("*")
          .order("event_date", { ascending: true }),
      ]);
      if (!active) return;
      if (trRes.data) setTrainings(trRes.data as Training[]);
      if (taskRes.data) setTasks(taskRes.data as TaskAssignment[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { filteredTrainings, pastTrainings } = useMemo(() => {
    const list =
      selectedGroup === "Tümü"
        ? trainings
        : trainings.filter((t) =>
            (t.age_groups || []).includes(selectedGroup)
          );

    const activeList: Training[] = [];
    const pastList: Training[] = [];

    for (const tr of list) {
      const trDateClean = String(tr.training_date || "").slice(0, 10);
      if (
        tr.training_type === "ekstra" &&
        trDateClean &&
        todayStr &&
        trDateClean < todayStr
      ) {
        pastList.push(tr);
      } else {
        activeList.push(tr);
      }
    }

    activeList.sort((a, b) => {
      const da = a.day_of_week
        ? DAYS_OF_WEEK.indexOf(
            a.day_of_week as (typeof DAYS_OF_WEEK)[number]
          )
        : 99;
      const db = b.day_of_week
        ? DAYS_OF_WEEK.indexOf(
            b.day_of_week as (typeof DAYS_OF_WEEK)[number]
          )
        : 99;
      if (da !== db) return da - db;
      return (a.start_time || "").localeCompare(b.start_time || "");
    });

    pastList.sort((a, b) =>
      String(b.training_date || "").localeCompare(String(a.training_date || ""))
    );

    return { filteredTrainings: activeList, pastTrainings: pastList };
  }, [trainings, selectedGroup, todayStr]);

  const { upcomingTasks, pastTasks } = useMemo(() => {
    const byGroup =
      selectedGroup === "Tümü"
        ? tasks
        : tasks.filter(
            (t) => t.age_group === selectedGroup || t.age_group === "Tümü"
          );

    const upcoming = byGroup.filter((t) => isTaskUpcoming(t));
    const past = byGroup
      .filter((t) => !isTaskUpcoming(t))
      .sort((a, b) =>
        String(b.event_date || "").localeCompare(String(a.event_date || ""))
      );

    return { upcomingTasks: upcoming, pastTasks: past };
  }, [tasks, selectedGroup]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="bg-gradient-to-r from-[#02274c] to-[#04376b] text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-extrabold uppercase tracking-wider">
              Kulüp Programı
            </span>
            <h1 className="text-2xl sm:text-3xl font-black">
              Antrenman Saatleri &amp; Maç Takvimi
            </h1>
            <p className="text-sm text-slate-200 max-w-2xl">
              Kulübümüze yeni katılmak isteyen sporcular ve veliler, yaş
              gruplarına göre haftalık antrenman gün ve saatlerini buradan
              inceleyebilir.
            </p>
          </div>
          <Link
            href="/kayit"
            className="shrink-0 px-5 py-3 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white text-sm font-extrabold text-center transition shadow"
          >
            Üyelik Başvurusu
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {["Tümü", ...AGE_GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                selectedGroup === g
                  ? "bg-[#02274c] text-white border-[#02274c]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
            </button>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#02274c]">
            Haftalık Antrenman Saatleri ({filteredTrainings.length})
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">Program yükleniyor...</p>
          ) : filteredTrainings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
              Bu yaş grubu için henüz yayınlanmış antrenman saati bulunmuyor.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrainings.map((tr) => (
                <div
                  key={tr.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#02274c] text-white text-xs font-extrabold">
                      {tr.day_of_week ||
                        formatDisplayDate(tr.training_date) ||
                        "Program"}
                    </span>
                    <span className="text-sm font-black text-[#a60513]">
                      {tr.start_time}
                      {tr.end_time ? ` - ${tr.end_time}` : ""}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-900">{tr.title}</h3>
                  <div className="flex flex-wrap gap-1">
                    {(tr.age_groups || []).map((ag) => (
                      <span
                        key={ag}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold"
                      >
                        {ag}
                      </span>
                    ))}
                  </div>
                  {tr.coach_name && (
                    <p className="text-xs font-bold text-[#02274c]">
                      👨‍🏫 Antrenör: {tr.coach_name}
                    </p>
                  )}
                  {tr.location && (
                    <div className="text-xs text-slate-600 pt-1 flex flex-wrap items-center justify-between gap-2">
                      <span>📍 {tr.location}</span>
                      <a
                        href={buildMapsUrl(tr.location)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#02274c] font-extrabold underline"
                      >
                        Haritada Aç
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#a60513]">
            Yaklaşan Maçlar &amp; Etkinlikler ({upcomingTasks.length})
          </h2>

          {upcomingTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
              Yaklaşan planlanmış maç veya etkinlik bulunmuyor.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-50 text-[#a60513] text-xs font-extrabold">
                      {task.age_group}
                    </span>
                    <h3 className="font-extrabold text-slate-900">
                      {task.title}
                    </h3>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                      <span>📍 {task.location || "Belirtilmedi"}</span>
                      {task.location && (
                        <a
                          href={buildMapsUrl(task.location)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#02274c] font-extrabold underline"
                        >
                          Haritada Aç
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-[#02274c]">
                      {formatDisplayDate(task.event_date)}
                    </div>
                    {task.match_time && (
                      <div className="text-xs font-bold text-slate-500">
                        {task.match_time}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {(pastTasks.length > 0 || pastTrainings.length > 0) && (
          <section className="space-y-3 opacity-85">
            <h3 className="text-base font-extrabold text-slate-700">
              Geçmiş Etkinlikler, Antrenmanlar &amp; Maçlar (
              {pastTasks.length + pastTrainings.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {pastTasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {task.age_group} • Maç/Etkinlik
                    </span>
                    <div className="font-bold text-sm text-slate-800">
                      {task.title}
                    </div>
                    {task.location && (
                      <div className="text-[11px] text-slate-500">
                        📍 {task.location}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {formatDisplayDate(task.event_date)}
                  </span>
                </div>
              ))}
              {pastTrainings.slice(0, 10).map((tr) => (
                <div
                  key={tr.id}
                  className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {(tr.age_groups || []).join(", ")} • Antrenman
                    </span>
                    <div className="font-bold text-sm text-slate-800">
                      {tr.title}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {formatDisplayDate(tr.training_date)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}