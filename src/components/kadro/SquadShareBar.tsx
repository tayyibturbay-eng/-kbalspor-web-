"use client";

import React, { useState } from "react";

export interface ShareSlotItem {
  label: string;
  playerName: string | null;
  jerseyNumber?: number | null;
}

export function SquadShareBar({
  categoryLabel,
  formationLabel,
  slots,
  onDownloadVisualCard,
}: {
  categoryLabel: string;
  formationLabel: string;
  slots: ShareSlotItem[];
  onDownloadVisualCard?: () => Promise<void> | void;
}) {
  const [copiedText, setCopiedText] = useState(false);
  const [sharingVisual, setSharingVisual] = useState(false);

  function buildTextSummary(): string {
    const rows = slots.map((s) => {
      const who = s.playerName
        ? `${s.playerName}${s.jerseyNumber ? ` (#${s.jerseyNumber})` : ""}`
        : "Boş";
      return `${s.label}: ${who}`;
    });
    return `Çorum İkbalspor — ${categoryLabel} (${formationLabel})\n\n${rows.join("\n")}`;
  }

  async function handleShareText() {
    const summary = buildTextSummary();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      }
    } catch {
      // panoya kopyalama başarısız olsa da paylaşım metnini hazırla
    }
    setCopiedText(true);
    window.setTimeout(() => setCopiedText(false), 2200);
  }

  async function handleShareVisual() {
    if (!onDownloadVisualCard) return;
    setSharingVisual(true);
    try {
      await onDownloadVisualCard();
    } finally {
      setSharingVisual(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2">
      <button
        type="button"
        onClick={() => void handleShareText()}
        className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white transition cursor-pointer"
      >
        {copiedText ? "Metin Kopyalandı ✓" : "1. Metin Paylaş"}
      </button>

      <button
        type="button"
        disabled={sharingVisual}
        onClick={() => void handleShareVisual()}
        className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white disabled:opacity-60 transition cursor-pointer"
      >
        {sharingVisual ? "Kart Hazırlanıyor..." : "2. Görsel Kart Paylaş"}
      </button>
    </div>
  );
}