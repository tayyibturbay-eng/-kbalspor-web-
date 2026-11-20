"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface TaskRow {
  id: string;
  title: string;
  task_type: "antrenman" | "mac" | "etkinlik";
  age_group: string;
  event_date: string;
  location: string | null;
  description: string | null;
}

const AGE_FILTERS = ["Tümü", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19"];

const TYPE_BADGE: Record<string, { label: string; style: string }> = {
  antrenman: { label: "Antrenman", style: "bg-sky-100 text-sky-800" },
  mac: { label: "Maç", style: "bg-red-100 text-[#a60513]" },
  etkinlik: { label: "Etkinlik", style: "bg-emerald-100 text-emerald-800" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [ageFilter, setAgeFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks_assignments")
        .select("id, title, task_type, age_group, event_date, location, description")
        .order("event_date", { ascending: true });
      setTasks((data as TaskRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered =
    ageFilter === "Tümü"
      ? tasks
      : tasks.filter((t) => t.age_group === ageFilter || t.age_group === "Tümü");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-3">
          <h1 className="text-3xl font-black">Görev Atamaları, Antrenmanlar ve Maçlar</h1>
          <p className="text-slate-100">
            Yaş grubunu seçerek sana uygun düzenli antrenmanları ve maç
            görevlerini gör.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {AGE_FILTERS.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setAgeFilter(age)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-extrabold transition ${
                  ageFilter === age
                    ? "bg-white text-[#02274c]"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-4">
        {loading ? (
          <p className="text-slate-500">Görevler yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Bu yaş grubu için henüz görev veya maç kaydı bulunmuyor.
          </div>
        ) : (
          filtered.map((t) => {
            const badge = TYPE_BADGE[t.task_type] || TYPE_BADGE.antrenman;
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-[#02274c] p-6 shadow-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#02274c] text-white text-xs font-extrabold">
                      {t.age_group}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-extrabold ${badge.style}`}>
                      {badge.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-600">
                    {new Date(t.event_date).toLocaleString("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-[#02274c]">{t.title}</h2>
                {t.location && (
                  <p className="text-sm font-semibold text-[#a60513]">
                    Yer: {t.location}
                  </p>
                )}
                {t.description && <p className="text-slate-600 text-sm">{t.description}</p>}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}