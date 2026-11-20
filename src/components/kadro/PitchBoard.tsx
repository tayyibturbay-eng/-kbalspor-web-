"use client";

import { useState } from "react";
import {
  FORMATIONS,
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
  setDraggingFromSlot: (slot: string | null) => void;
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
  const [editingNumberFor, setEditingNumberFor] = useState<SquadPlayer | null>(
    null
  );
  const [tempNumberInput, setTempNumberInput] = useState("");

  const currentFormation = FORMATIONS[formation];

  return (
    <>
      <div
        className="relative rounded-3xl border-4 border-white shadow-xl p-4 sm:p-6 min-h-[600px] flex flex-col justify-between gap-3 overflow-hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, #15803d 0px, #15803d 48px, #166534 48px, #166534 96px)",
        }}
      >
        {/* Saha Çizgileri */}
        <div className="pointer-events-none absolute inset-4 border-2 border-white/30 rounded-2xl">
          <div className="absolute top-1/2 left-0 right-0 border-t-2 border-white/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 border-b-2 border-x-2 border-white/30 rounded-b-lg" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-16 border-t-2 border-x-2 border-white/30 rounded-t-lg" />
        </div>

        {currentFormation.rows.map((row, rowIdx) => (
          <div
            key={`${row.role}-${rowIdx}`}
            className="relative z-10 flex justify-center items-center flex-wrap sm:flex-nowrap gap-2.5 sm:gap-4"
          >
            {Array.from({ length: row.count }).map((_, colIdx) => {
              const slotKey = `${rowIdx}-${colIdx}`;
              const occupant = slots[slotKey];
              const occIsQuota =
                occupant &&
                checkPlayerEligibility(occupant, selectedCategory).isQuota;
              const effNum = occupant ? getEffectiveNumber(occupant) : "";

              return (
                <div
                  key={slotKey}
                  draggable={Boolean(occupant)}
                  onDragStart={() => {
                    if (occupant) {
                      setDraggingPlayer(occupant);
                      setDraggingFromSlot(slotKey);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingPlayer) {
                      onAssignToSlot(slotKey, draggingPlayer, draggingFromSlot);
                      setDraggingPlayer(null);
                      setDraggingFromSlot(null);
                    }
                  }}
                  onClick={() => {
                    // Mobilde seçili oyuncu varsa slota dokunarak yerleştir
                    if (!occupant && draggingPlayer) {
                      onAssignToSlot(slotKey, draggingPlayer, draggingFromSlot);
                      setDraggingPlayer(null);
                      setDraggingFromSlot(null);
                    }
                  }}
                  className={`w-24 sm:w-28 rounded-2xl transition flex flex-col items-center p-2 text-center ${
                    occupant
                      ? occIsQuota
                        ? "bg-amber-600/95 border-2 border-white text-white shadow-lg cursor-grab active:cursor-grabbing"
                        : "bg-[#02274c]/95 border-2 border-white/80 text-white shadow-lg cursor-grab active:cursor-grabbing"
                      : "min-h-[88px] justify-center bg-black/20 border-2 border-dashed border-white/40 text-white/90 hover:bg-black/30"
                  }`}
                >
                  {occupant ? (
                    <>
                      <div className="w-full flex items-center justify-between mb-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNumberFor(occupant);
                            setTempNumberInput(
                              effNum === "" ? "" : String(effNum)
                            );
                          }}
                          title="Forma numarasını değiştir"
                          className="px-2 py-0.5 rounded-full bg-[#a60513] hover:bg-red-600 text-white text-[11px] font-black shadow-xs cursor-pointer transition"
                        >
                          #{effNum === "" ? "-" : effNum}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromSlot(slotKey);
                          }}
                          className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-[10px] font-black text-white flex items-center justify-center cursor-pointer"
                          title="Sahadan Çıkar"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="w-10 h-10 rounded-full bg-white/15 border-2 border-white/60 overflow-hidden flex items-center justify-center mb-1 shadow-xs">
                        {occupant.photo_url ? (
                          <img
                            src={occupant.photo_url}
                            alt={occupant.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-black">
                            {occupant.full_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-extrabold leading-tight line-clamp-2">
                        {occupant.full_name}
                      </span>

                      {occIsQuota && (
                        <span className="mt-1 px-1.5 py-0.5 rounded bg-black/25 text-[9px] font-bold">
                          Kontenjan
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold mb-1">
                        +
                      </span>
                      <span className="text-[10px] font-extrabold leading-tight">
                        {row.role}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {editingNumberFor && (
        <div
          onClick={() => setEditingNumberFor(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-[#02274c]">
                  {editingNumberFor.full_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Bu kadro için forma numarası seçin (1–99)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNumberFor(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={tempNumberInput}
                onChange={(e) =>
                  setTempNumberInput(e.target.value.replace(/\D/g, ""))
                }
                placeholder="1 - 99"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-center text-lg font-black text-[#02274c] focus:outline-none focus:ring-2 focus:ring-[#02274c]"
              />
              <button
                type="button"
                onClick={() => {
                  const ok = onNumberChange(
                    editingNumberFor.id,
                    tempNumberInput
                  );
                  if (ok) setEditingNumberFor(null);
                }}
                className="px-5 py-3 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white text-sm font-extrabold cursor-pointer"
              >
                Kaydet
              </button>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2">
                Hızlı Seçim:
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 17, 19, 20, 23, 99].map(
                  (num) => {
                    const taken = usedNumbersSet.has(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={taken}
                        onClick={() => {
                          const ok = onNumberChange(
                            editingNumberFor.id,
                            String(num)
                          );
                          if (ok) setEditingNumberFor(null);
                        }}
                        className={`py-2 rounded-xl text-xs font-extrabold transition ${
                          taken
                            ? "bg-slate-100 text-slate-300 cursor-not-allowed line-through"
                            : "bg-slate-100 hover:bg-[#02274c] hover:text-white text-[#02274c] cursor-pointer"
                        }`}
                      >
                        #{num}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}