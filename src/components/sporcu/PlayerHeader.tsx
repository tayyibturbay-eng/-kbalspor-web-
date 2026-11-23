// PlayerHeader.tsx
"use client";

import { Player } from "@/types/club";

export type SporcuTab = "qr" | "program" | "malzemeler" | "aidat" | "profil";

interface PlayerHeaderProps {
  player: Player;
  tab: SporcuTab;
  onTabChange: (newTab: SporcuTab) => void;
  onLogout: () => void;
  totalSessionsCount: number;
  attendanceRate: number;
  activeEquipmentCount: number;
  overdueCount: number;
  currentUnpaid: boolean;
}

export function PlayerHeader({
  player,
  tab,
  onTabChange,
  onLogout,
  totalSessionsCount,
  attendanceRate,
  activeEquipmentCount,
  overdueCount,
  currentUnpaid,
}: PlayerHeaderProps) {
  const attendanceBadge =
    totalSessionsCount === 0
      ? null
      : attendanceRate >= 85
      ? {
          label: `Altın Devamlılık (%${attendanceRate})`,
          cls: "bg-amber-400 text-slate-950",
        }
      : attendanceRate >= 65
      ? {
          label: `İstikrarlı Sporcu (%${attendanceRate})`,
          cls: "bg-emerald-500 text-white",
        }
      : attendanceRate >= 40
      ? {
          label: `Gelişen Sporcu (%${attendanceRate})`,
          cls: "bg-sky-400 text-slate-950",
        }
      : {
          label: `Katılım: %${attendanceRate}`,
          cls: "bg-white/20 text-white",
        };

  const tabs: Array<{
    key: SporcuTab;
    label: string;
    badge?: string;
    badgeCls?: string;
  }> = [
    { key: "qr", label: "QR Yoklama" },
    { key: "program", label: "Program & Maçlar" },
    {
      key: "malzemeler",
      label: "Malzemelerim",
      badge: activeEquipmentCount > 0 ? String(activeEquipmentCount) : undefined,
      badgeCls:
        tab === "malzemeler"
          ? "bg-white text-[var(--brand-navy)]"
          : "bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300",
    },
    {
      key: "aidat",
      label: "Aidatlarım",
      badge:
        overdueCount > 0 ? `${overdueCount}` : currentUnpaid ? "!" : undefined,
      badgeCls:
        overdueCount > 0
          ? "bg-[var(--status-danger-text)] text-white"
          : tab === "aidat"
          ? "bg-white text-[var(--brand-red)]"
          : "bg-amber-400 text-slate-950",
    },
    { key: "profil", label: "Profil & PIN" },
  ];

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-navy)] via-[#06396b] to-[var(--brand-red)] text-white rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => onTabChange("profil")}
            title="Fotoğraf veya Avatar Değiştir"
            className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 border-2 border-white/30 overflow-hidden flex items-center justify-center shadow-md hover:scale-105 transition cursor-pointer"
          >
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-black">
                {player.full_name.charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-xs font-extrabold">
                {player.age_group}
              </span>
              {player.is_representative && (
                <span className="px-3 py-1 rounded-full bg-[var(--brand-red)] border border-white/25 text-xs font-extrabold">
                  Takım Temsilcisi
                </span>
              )}
              {attendanceBadge && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-xs tabular-nums ${attendanceBadge.cls}`}
                >
                  {attendanceBadge.label}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">
              {player.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 tabular-nums">
              Kod: <strong className="text-white">{player.player_code}</strong> •
              Mevki:{" "}
              <strong className="text-white">
                {player.position || "Belirlenmedi"}
              </strong>{" "}
              • Forma:{" "}
              <strong className="text-white">
                {player.jersey_number ? `#${player.jersey_number}` : "-"}
              </strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-extrabold cursor-pointer transition backdrop-blur-xs shrink-0"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] p-2 rounded-3xl border border-[var(--border-subtle)] shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={`group relative flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] text-white shadow-md"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-subtle)]"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none tabular-nums ${
                      item.badgeCls ||
                      "bg-[var(--bg-canvas)] text-[var(--text-primary)]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}