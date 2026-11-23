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

function formatLocalTodayStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
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

function isTaskUpcoming(task: TaskAssignment, nowMs: number | null): boolean {
  if (!task.event_date || nowMs === null) return true;
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
  const q = (location || NAZMI_AVLUCA || "Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

function TrainingsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="h-36 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-3"
        >
          <div className="flex justify-between">
            <div className="h-5 w-24 rounded-lg bg-[var(--bg-subtle)]" />
            <div className="h-5 w-20 rounded bg-[var(--bg-subtle)]" />
          </div>
          <div className="h-4 w-40 rounded bg-[var(--bg-subtle)]" />
          <div className="h-3 w-28 rounded bg-[var(--bg-subtle)]" />
        </div>
      ))}
    </div>
  );
}

export default function GorevlerPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("Tümü");
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState("");
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      const now = new Date();
      setTodayStr(formatLocalTodayStr(now));
      setNowMs(now.getTime());
    });

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

    const upcoming = byGroup.filter((t) => isTaskUpcoming(t, nowMs));
    const past =
      nowMs === null
        ? []
        : byGroup
            .filter((t) => !isTaskUpcoming(t, nowMs))
            .sort((a, b) =>
              String(b.event_date || "").localeCompare(String(a.event_date || ""))
            );

    return { upcomingTasks: upcoming, pastTasks: past };
  }, [tasks, selectedGroup, nowMs]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8 page-transition">
        <div className="bg-gradient-to-r from-[var(--brand-navy)] via-[#04376b] to-[var(--brand-red)] text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
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
            className="shrink-0 px-5 py-3 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] border border-white/20 text-white text-sm font-extrabold text-center transition shadow"
          >
            Üyelik Başvurusu
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {["Tümü", ...AGE_GROUPS].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGroup(g)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                selectedGroup === g
                  ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
            </button>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[var(--text-primary)] tabular-nums">
            Haftalık Antrenman Saatleri ({filteredTrainings.length})
          </h2>

          {loading ? (
            <TrainingsSkeleton />
          ) : filteredTrainings.length === 0 ? (
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center space-y-1">
              <p className="text-sm font-extrabold text-[var(--text-primary)]">
                Bu yaş grubu için henüz yayınlanmış antrenman saati bulunmuyor.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Farklı bir yaş grubu seçebilir veya yeni program eklendiğinde
                buradan takip edebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrainings.map((tr) => (
                <div
                  key={tr.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2 tabular-nums">
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-xs font-extrabold">
                      {tr.day_of_week ||
                        formatDisplayDate(tr.training_date) ||
                        "Program"}
                    </span>
                    <span className="text-sm font-black text-[var(--brand-red)]">
                      {tr.start_time}
                      {tr.end_time ? ` - ${tr.end_time}` : ""}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-[var(--text-primary)]">
                    {tr.title}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {(tr.age_groups || []).map((ag) => (
                      <span
                        key={ag}
                        className="px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-bold"
                      >
                        {ag}
                      </span>
                    ))}
                  </div>
                  {tr.coach_name && (
                    <p className="text-xs font-bold text-[var(--brand-navy)] dark:text-sky-300">
                      Antrenör: {tr.coach_name}
                    </p>
                  )}
                  {tr.location && (
                    <div className="text-xs text-[var(--text-secondary)] pt-1 flex flex-wrap items-center justify-between gap-2">
                      <span>Saha: {tr.location}</span>
                      <a
                        href={buildMapsUrl(tr.location)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--brand-navy)] dark:text-sky-300 font-extrabold underline"
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
          <h2 className="text-xl font-black text-[var(--brand-red)] tabular-nums">
            Yaklaşan Maçlar &amp; Etkinlikler ({upcomingTasks.length})
          </h2>

          {loading ? (
            <TrainingsSkeleton />
          ) : upcomingTasks.length === 0 ? (
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center space-y-1">
              <p className="text-sm font-extrabold text-[var(--text-primary)]">
                Yaklaşan planlanmış maç veya etkinlik bulunmuyor.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Yeni maç veya kulüp etkinliği planlandığında burada görüntülenecek.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5 flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1.5 min-w-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--brand-red-soft)] text-[var(--brand-red)] text-xs font-extrabold">
                      {task.age_group}
                    </span>
                    <h3 className="font-extrabold text-[var(--text-primary)] truncate">
                      {task.title}
                    </h3>
                    <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                      <span>Yer: {task.location || "Belirtilmedi"}</span>
                      {task.location && (
                        <a
                          href={buildMapsUrl(task.location)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--brand-navy)] dark:text-sky-300 font-extrabold underline"
                        >
                          Haritada Aç
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="text-sm font-black text-[var(--text-primary)]">
                      {formatDisplayDate(task.event_date)}
                    </div>
                    {task.match_time && (
                      <div className="text-xs font-bold text-[var(--text-muted)]">
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
            <h3 className="text-base font-extrabold text-[var(--text-secondary)] tabular-nums">
              Geçmiş Etkinlikler, Antrenmanlar &amp; Maçlar (
              {pastTasks.length + pastTrainings.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {pastTasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[var(--text-muted)]">
                      {task.age_group} • Maç/Etkinlik
                    </span>
                    <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                      {task.title}
                    </div>
                    {task.location && (
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">
                        Yer: {task.location}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--text-muted)] shrink-0 tabular-nums">
                    {formatDisplayDate(task.event_date)}
                  </span>
                </div>
              ))}
              {pastTrainings.slice(0, 10).map((tr) => (
                <div
                  key={tr.id}
                  className="bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-subtle)] p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[var(--text-muted)]">
                      {(tr.age_groups || []).join(", ")} • Antrenman
                    </span>
                    <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                      {tr.title}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-muted)] shrink-0 tabular-nums">
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