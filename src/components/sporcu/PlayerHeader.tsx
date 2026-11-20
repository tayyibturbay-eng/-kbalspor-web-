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
          label: `🏆 Altın Devamlılık (%${attendanceRate})`,
          cls: "bg-amber-400 text-slate-950",
        }
      : attendanceRate >= 65
      ? {
          label: `⭐ İstikrarlı Sporcu (%${attendanceRate})`,
          cls: "bg-emerald-500 text-white",
        }
      : attendanceRate >= 40
      ? {
          label: `💪 Gelişen Sporcu (%${attendanceRate})`,
          cls: "bg-sky-400 text-slate-950",
        }
      : {
          label: `📅 Katılım: %${attendanceRate}`,
          cls: "bg-white/20 text-white",
        };

  const tabs: Array<{
    key: SporcuTab;
    icon: string;
    label: string;
    badge?: string;
    badgeCls?: string;
  }> = [
    { key: "qr", icon: "📷", label: "QR Yoklama" },
    { key: "program", icon: "📅", label: "Program & Maçlar" },
    {
      key: "malzemeler",
      icon: "👕",
      label: "Malzemelerim",
      badge: activeEquipmentCount > 0 ? String(activeEquipmentCount) : undefined,
      badgeCls:
        tab === "malzemeler"
          ? "bg-white text-[#02274c]"
          : "bg-[#02274c] text-white",
    },
    {
      key: "aidat",
      icon: "💳",
      label: "Aidatlarım",
      badge: overdueCount > 0 ? `⚠️ ${overdueCount}` : currentUnpaid ? "!" : undefined,
      badgeCls:
        overdueCount > 0
          ? "bg-red-600 text-white"
          : tab === "aidat"
          ? "bg-white text-[#a60513]"
          : "bg-amber-400 text-slate-950",
    },
    { key: "profil", icon: "👤", label: "Profil & PIN" },
  ];

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-[#02274c] via-[#04376b] to-[#a60513] text-white rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-xs font-extrabold">
                {player.age_group}
              </span>
              {player.is_representative && (
                <span className="px-3 py-1 rounded-full bg-[#a60513] border border-white/25 text-xs font-extrabold">
                  Takım Temsilcisi
                </span>
              )}
              {attendanceBadge && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-xs ${attendanceBadge.cls}`}
                >
                  {attendanceBadge.label}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {player.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200">
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
          onClick={onLogout}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-extrabold cursor-pointer transition backdrop-blur-xs"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur-md p-2 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={`group relative flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[#02274c] to-[#a60513] text-white shadow-md scale-[1.01]"
                    : "bg-slate-50/80 text-slate-700 hover:bg-slate-100 hover:text-[#02274c]"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none ${
                      item.badgeCls || "bg-slate-200 text-slate-800"
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