"use client";

import React from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { MatchPredictionCard } from "@/components/ikbal/MatchPredictionCard";
import { Vitrin } from "@/components/ikbal/Motion";

export default function GorevlerPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <Navbar />

      <section className="k-sahne text-white py-9 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full k-cam--marka text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            Çorum İkbal Spor Kulübü • Maç Tahmin &amp; Ödül
          </span>
          <h1 className="k-posta k-posta--wonk text-2xl sm:text-4xl text-white">
            Maç Tahmin Merkezi
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
            Tüm maçlara skor ve golcü tahmini yapın; maç saati
            kilitlendikten sonra kazandığınız ödül puanını kartınıza aktarın.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Vitrin>
          <MatchPredictionCard />
        </Vitrin>
      </main>
    </div>
  );
}