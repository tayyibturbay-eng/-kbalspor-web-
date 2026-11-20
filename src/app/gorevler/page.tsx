"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_GROUPS,
  DAYS_OF_WEEK,
  TaskAssignment,
  Training,
} from "@/types/club";

const supabase = createClient();

export default function GorevlerPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
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
      if (trRes.data) setTrainings(trRes.data as Training[]);
      if (taskRes.data) setTasks(taskRes.data as TaskAssignment[]);
      setLoading(false);
    })();
  }, []);

  const filteredTrainings = useMemo(() => {
    const list =
      selectedGroup === "Tümü"
        ? trainings
        : trainings.filter((t) =>
            (t.age_groups || []).includes(selectedGroup)
          );

    return [...list].sort((a, b) => {
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
  }, [trainings, selectedGroup]);

  const { upcomingTasks, pastTasks } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const byGroup =
      selectedGroup === "Tümü"
        ? tasks
        : tasks.filter(
            (t) => t.age_group === selectedGroup || t.age_group === "Tümü"
          );

    return {
      upcomingTasks: byGroup.filter((t) => t.event_date >= todayStr),
      pastTasks: byGroup
        .filter((t) => t.event_date < todayStr)
        .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    };
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
              Antrenman Saatleri & Maç Takvimi
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
                      {tr.day_of_week || tr.training_date || "Program"}
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
                    <p className="text-xs text-slate-500 pt-1">
                      📍 {tr.location}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-[#a60513]">
            Yaklaşan Maçlar & Etkinlikler ({upcomingTasks.length})
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
                  <div className="space-y-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-50 text-[#a60513] text-xs font-extrabold">
                      {task.age_group}
                    </span>
                    <h3 className="font-extrabold text-slate-900">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      📍 {task.location || "Belirtilmedi"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-[#02274c]">
                      {task.event_date}
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

        {pastTasks.length > 0 && (
          <section className="space-y-3 opacity-80">
            <h3 className="text-base font-extrabold text-slate-600">
              Tamamlanan Maçlar & Etkinlikler ({pastTasks.length})
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {pastTasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-100/80 rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {task.age_group}
                    </span>
                    <div className="font-bold text-sm text-slate-800">
                      {task.title}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {task.event_date}
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