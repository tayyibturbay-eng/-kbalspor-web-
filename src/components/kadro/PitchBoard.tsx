"use client";

import React from "react";
import {
  FORMATIONS,
  MAX_JERSEY_NUMBER,
  MIN_JERSEY_NUMBER,
  SquadPlayer,
  checkPlayerEligibility,
} from "@/lib/squad-rules";

interface PitchBoardProps {
  selectedCategory: string;
  formation: string;
  slots: Record<string, SquadPlayer | null>;
  draggingPlayer: SquadPlayer | null;
  setDraggingPlayer: (p: SquadPlayer | null) => void;
  draggingFromSlot: string | null;
  setDraggingFromSlot: (slotKey: string | null) => void;
  onAssignToSlot: (
    targetSlotKey: string,
    player: SquadPlayer,
    fromSlotKey: string | null
  ) => void;
  onRemoveFromSlot: (slotKey: string) => void;
  getEffectiveNumber: (player: SquadPlayer) => number | "";
  onNumberChange: (playerId: string, rawVal: string) => boolean;
  usedNumbersSet: Set<number | "">;
}

export function PitchBoard({
  selectedCategory,
  formation,
  slots,
  draggingPlayer,
  setDraggingPlayer,
  draggingFromSlot,
  setDraggingFromSlot,
  onAssignToSlot,
  onRemoveFromSlot,
  getEffectiveNumber,
  onNumberChange,
  usedNumbersSet,
}: PitchBoardProps) {
  const activeFormation = FORMATIONS[formation] || Object.values(FORMATIONS)[0];
  const rows = activeFormation?.rows || [];

  const handleDropOnSlot = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    if (!draggingPlayer) return;
    onAssignToSlot(slotKey, draggingPlayer, draggingFromSlot);
    setDraggingPlayer(null);
    setDraggingFromSlot(null);
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
            Saha Dizilişi ({activeFormation?.label || formation})
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Karttaki forma numarasını ({MIN_JERSEY_NUMBER}–{MAX_JERSEY_NUMBER})
            tıklayarak değiştirebilir veya oyuncuyu sürükleyip çıkarabilirsiniz.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold tabular-nums">
          Kullanılan Numara: {usedNumbersSet.size}
        </span>
      </div>

      <div className="relative w-full min-h-[540px] sm:min-h-[600px] rounded-3xl overflow-hidden border-2 border-white/80 shadow-inner bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-900 p-3 sm:p-5 flex flex-col justify-between select-none">
        <div className="pointer-events-none absolute inset-3 border-2 border-white/45 rounded-2xl" />
        <div className="pointer-events-none absolute top-1/2 left-3 right-3 h-0.5 bg-white/45" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/45" />
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 w-48 h-20 border-b-2 border-x-2 border-white/40" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 w-48 h-20 border-t-2 border-x-2 border-white/40" />

        {rows.map((row, rIdx) => (
          <div
            key={`${row.role}-${rIdx}`}
            className="relative z-10 flex items-center justify-around gap-2 py-2"
          >
            {Array.from({ length: row.count }).map((_, cIdx) => {
              const slotKey = `${rIdx}-${cIdx}`;
              const occupant = slots[slotKey] || null;
              const elig = occupant
                ? checkPlayerEligibility(occupant, selectedCategory)
                : null;
              const effNum = occupant ? getEffectiveNumber(occupant) : "";

              return (
                <div
                  key={slotKey}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSlot(e, slotKey)}
                  className="flex flex-col items-center min-w-[78px] max-w-[116px]"
                >
                  {occupant ? (
                    <div
                      draggable
                      onDragStart={() => {
                        setDraggingPlayer(occupant);
                        setDraggingFromSlot(slotKey);
                      }}
                      className={`w-full rounded-2xl p-2 shadow-md border transition cursor-grab active:cursor-grabbing ${
                        elig?.isQuota
                          ? "bg-[var(--brand-red)] text-white border-amber-300"
                          : "bg-[var(--brand-navy)] text-white border-white/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          aria-label={`${occupant.full_name} forma numarası`}
                          value={effNum === "" ? "" : String(effNum)}
                          onChange={(e) =>
                            onNumberChange(occupant.id, e.target.value)
                          }
                          placeholder="#"
                          className="w-9 h-6 rounded-md bg-white text-[var(--brand-navy)] font-black text-xs text-center focus:outline-none focus:ring-2 focus:ring-amber-300 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveFromSlot(slotKey)}
                          aria-label={`${occupant.full_name} kadrodan çıkar`}
                          className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-white text-[11px] font-black flex items-center justify-center cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      <div className="text-[11px] font-extrabold leading-tight truncate text-center">
                        {occupant.full_name}
                      </div>
                      <div className="text-[10px] text-amber-200 font-bold text-center truncate mt-0.5">
                        {elig?.isQuota ? "Kontenjan" : row.role}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`w-full h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center px-2 text-center transition ${
                        draggingPlayer
                          ? "border-amber-300 bg-white/20 text-white"
                          : "border-white/45 bg-black/20 text-white/80"
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wide">
                        {row.role}
                      </span>
                      <span className="text-[10px] opacity-80 mt-0.5">
                        Bırak veya Seç
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}