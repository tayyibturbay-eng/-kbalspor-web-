"use client";

import React from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { MatchPredictionCard } from "@/components/ikbal/MatchPredictionCard";

export default function GorevlerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white py-7 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-white/25 text-[11px] font-extrabold uppercase tracking-wider">
            Çorum İkbal Spor Kulübü • Maç Tahmin &amp; Ödül
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Maç Tahmin Merkezi
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-1">
            Tüm maçlara skor ve golcü tahmini yapın, maç saati geldiğinde
            kilitlenen ekran sonrasında ödül puanınızı kartınıza aktarın.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <MatchPredictionCard />
      </main>
    </div>
  );
}