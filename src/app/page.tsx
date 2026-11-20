"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface TaskItem {
  id: string;
  title: string;
  task_type: "antrenman" | "mac" | "etkinlik";
  age_group: string;
  event_date: string;
  location: string | null;
}

export default function IkbalHomePage() {
  const [upcoming, setUpcoming] = useState<TaskItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks_assignments")
        .select("id, title, task_type, age_group, event_date, location")
        .order("event_date", { ascending: true })
        .limit(4);
      if (data) setUpcoming(data as TaskItem[]);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#02274c] via-[#04376b] to-[#a60513] text-white">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-20 grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-extrabold uppercase tracking-wider">
                Çorum İkbalspor • Profesyonelliğe Geçiş Ligi
              </span>

              <h1 className="text-3xl sm:text-5xl font-black leading-tight">
                Geleceğin Yıldızları{" "}
                <span className="text-red-300">İkbalspor</span> Çatısı Altında
                Yetişiyor
              </h1>

              <p className="text-lg text-slate-100 leading-relaxed max-w-2xl">
                U11&apos;den U19&apos;a tüm yaş kategorilerinde antrenman ve maç
                görevleri, aidat ve malzeme takibi, Cumartesi sabah namazı QR
                yoklaması ve kendi kadronu kurma heyecanı tek platformda.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/kadro-kur"
                  className="min-h-[52px] px-7 rounded-2xl bg-[#a60513] hover:bg-red-700 border-2 border-white/20 text-white font-extrabold text-base flex items-center justify-center shadow-lg transition"
                >
                  Kendi Kadronu Kur (U11–U19)
                </Link>
                <Link
                  href="/gorevler"
                  className="min-h-[52px] px-7 rounded-2xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-base flex items-center justify-center shadow-lg transition"
                >
                  Görevler & Maç Takvimi
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <h2 className="text-lg font-extrabold">Yaklaşan Etkinlikler</h2>
                  <Link href="/gorevler" className="text-xs font-bold text-red-200 hover:underline">
                    Tümünü Gör →
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate-200">
                    Henüz planlanmış antrenman veya maç yok. Yönetim panelinden
                    ekleyebilirsiniz.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl bg-white/10 border border-white/15 p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-[#a60513] text-[11px] font-extrabold mr-2">
                            {t.age_group}
                          </span>
                          <span className="font-bold text-sm">{t.title}</span>
                          <p className="text-xs text-slate-200 mt-0.5">
                            {new Date(t.event_date).toLocaleString("tr-TR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {t.location ? ` • ${t.location}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Hızlı Modüller */}
        <section className="max-w-6xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/kadro-kur"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Kendi Kadronu Kur
            </h3>
            <p className="text-sm text-slate-600">
              U11–U19 gerçek oyuncu kadrolarından kendi ilk 11&apos;ini oluştur.
            </p>
          </Link>

          <Link
            href="/gorevler"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Antrenman & Maç Görevleri
            </h3>
            <p className="text-sm text-slate-600">
              Yaş grubuna uygun antrenman faaliyetlerini ve maçları takip et.
            </p>
          </Link>

          <Link
            href="/mesajlar"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#a60513] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Mesajlaşma & Duyurular
            </h3>
            <p className="text-sm text-slate-600">
              Antrenör duyuruları, hatırlatıcılar ve hızlı iletişim alanı.
            </p>
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl bg-white border border-slate-200 border-t-4 border-t-[#02274c] p-6 shadow-sm hover:shadow-lg transition space-y-2"
          >
            <h3 className="text-lg font-extrabold text-[#02274c]">
              Aidat, Malzeme & Sabah Namazı QR
            </h3>
            <p className="text-sm text-slate-600">
              Yönetici panelinden aidat, malzeme ve Cumartesi QR yoklamasını yönet.
            </p>
          </Link>
        </section>
      </main>

      <footer className="bg-[#02274c] text-slate-200 border-t-4 border-[#a60513] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="font-extrabold text-white">
            Çorum İkbalspor • İkbalspor Kulübü
          </div>
          <div className="text-slate-300">
            © 2026 İkbalspor. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}