"use client";

import { createClient } from "@/lib/supabase/client";
import { EquipmentLog } from "@/types/club";
import { cleanWaPhone } from "@/lib/club-utils";

const supabase = createClient();

type MiniPlayer = {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
};

interface EquipmentLogsSectionProps {
  mode: "unreturned" | "missing";
  players: MiniPlayer[];
  logs: EquipmentLog[];
  setLogs: React.Dispatch<React.SetStateAction<EquipmentLog[]>>;
}

export function EquipmentLogsSection({
  mode,
  players,
  logs,
  setLogs,
}: EquipmentLogsSectionProps) {
  async function updateLogStatus(id: string, status: EquipmentLog["status"]) {
    const { error } = await supabase
      .from("equipment_logs")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setLogs((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l))
      );
    }
  }

  async function sendClubAlert(player: MiniPlayer | undefined, text: string) {
    if (!player) return;
    await supabase.from("club_messages").insert({
      title: "⚠️ Malzeme İade Hatırlatması",
      body: `${player.full_name}: ${text}`,
      target_group: player.age_group,
      sender_name: "Yönetim (Malzeme Takip)",
    });
    alert(`${player.full_name} için kulüp mesajı/bildirimi yayınlandı.`);
  }

  if (mode === "missing") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
        {logs.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm">
            Eksik veya kayıp olarak işaretlenen malzeme yok.
          </p>
        ) : (
          logs.map((l) => {
            const pl = players.find((p) => p.id === l.player_id);
            return (
              <div
                key={l.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 bg-red-50/50"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-extrabold mr-2">
                    KAYIP / EKSİK
                  </span>
                  <strong className="text-[#02274c]">
                    {pl?.full_name || "Oyuncu"}
                  </strong>{" "}
                  — {l.item_name} (Beden: {l.item_size || "-"}, No:{" "}
                  {l.jersey_number_given ?? "-"})
                </div>
                <button
                  type="button"
                  onClick={() => updateLogStatus(l.id, "iade_edildi")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                >
                  Bulundu / İade Alındı
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
      {logs.length === 0 ? (
        <p className="p-6 text-slate-500 text-sm">
          Geri beklenen forma veya malzeme yok.
        </p>
      ) : (
        logs.map((l) => {
          const pl = players.find((p) => p.id === l.player_id);
          const waPhone = cleanWaPhone(pl?.parent_phone);
          const waText = `Sayın Veli, ${pl?.full_name || ""} üzerinde bulunan ${
            l.item_name
          } (Beden: ${l.item_size || "-"}, No: ${
            l.jersey_number_given ?? "-"
          }) iadesi beklenmektedir.`;
          return (
            <div
              key={l.id}
              className="p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <strong className="text-[#02274c]">
                  {pl?.full_name || "Oyuncu"}
                </strong>{" "}
                — {l.item_name}
                <span className="text-xs text-slate-600 ml-2">
                  Beden: <strong>{l.item_size || "-"}</strong>
                  {l.jersey_number_given
                    ? ` • No: #${l.jersey_number_given}`
                    : ""}{" "}
                  • {l.given_date}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateLogStatus(l.id, "iade_edildi")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                >
                  İade Alındı
                </button>
                <button
                  type="button"
                  onClick={() => updateLogStatus(l.id, "kayip_eksik")}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-extrabold"
                >
                  Kayıp / Eksik
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendClubAlert(pl, `${l.item_name} iadesi beklenmektedir.`)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold"
                >
                  Bildirim Gönder
                </button>
                {waPhone && (
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                      waText
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}