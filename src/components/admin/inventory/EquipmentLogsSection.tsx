"use client";

import { createClient } from "@/lib/supabase/client";
import { EquipmentLog } from "@/types/club";
import { cleanWaPhone } from "@/lib/club-utils";
import { useOnay } from "@/components/ui/OnayDialog";

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
  const { bildirim } = useOnay();
  async function updateLogStatus(
    logItem: EquipmentLog,
    status: EquipmentLog["status"]
  ) {
    const { error } = await supabase
      .from("equipment_logs")
      .update({ status })
      .eq("id", logItem.id);
    if (!error) {
      setLogs((prev) =>
        prev.map((l) => (l.id === logItem.id ? { ...l, status } : l))
      );

      if (status === "iade_edildi" && logItem.category === "Malzeme") {
        const cleanProdName = logItem.item_name
          .replace(/\s*\[(Emanet|Tam Teslim)\]\s*$/i, "")
          .trim();
        const { data: stRow } = await supabase
          .from("equipment_stock")
          .select("id, stock_count")
          .ilike("product_name", cleanProdName)
          .maybeSingle();
        if (stRow) {
          await supabase
            .from("equipment_stock")
            .update({ stock_count: (Number(stRow.stock_count) || 0) + 1 })
            .eq("id", stRow.id);
        }
      }
    }
  }

  async function sendClubAlert(player: MiniPlayer | undefined, text: string) {
    if (!player) return;
    await supabase.from("club_messages").insert({
      body: `${player.full_name}: ${text}`,
      message_text: `${player.full_name}: ${text}`,
      age_group: player.age_group,
      sender_name: "Yönetim (Malzeme Takip)",
      created_at: new Date().toISOString(),
    });
    bildirim(`${player.full_name} için kulüp mesajı/bildirimi yayınlandı.`);
  }

  if (mode === "missing") {
    return (
      <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] tabular-nums">
        {logs.length === 0 ? (
          <p className="p-6 text-[var(--text-secondary)] text-sm">
            Eksik veya kayıp olarak işaretlenen malzeme yok.
          </p>
        ) : (
          logs.map((l) => {
            const pl = players.find((p) => p.id === l.player_id);
            return (
              <div
                key={l.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--status-danger-bg)]/35"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-[var(--brand-red)] text-white text-xs font-extrabold mr-2">
                    KAYIP / EKSİK
                  </span>
                  <strong className="text-[var(--text-primary)]">
                    {pl?.full_name || "Oyuncu"}
                  </strong>{" "}
                  — {l.item_name} (Beden: {l.item_size || "-"}, No:{" "}
                  {l.jersey_number_given ?? "-"})
                </div>
                <button
                  type="button"
                  onClick={() => updateLogStatus(l, "iade_edildi")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
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
    <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] tabular-nums">
      {logs.length === 0 ? (
        <p className="p-6 text-[var(--text-secondary)] text-sm">
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
                <strong className="text-[var(--text-primary)]">
                  {pl?.full_name || "Oyuncu"}
                </strong>{" "}
                — {l.item_name}
                <span className="text-xs text-[var(--text-secondary)] ml-2">
                  Beden: <strong>{l.item_size || "-"}</strong>
                  {l.jersey_number_given
                    ? ` • No: #${l.jersey_number_given}`
                    : ""}{" "}
                  - {l.given_date}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateLogStatus(l, "iade_edildi")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  İade Alındı (Boşa Çıkar)
                </button>
                <button
                  type="button"
                  onClick={() => updateLogStatus(l, "kayip_eksik")}
                  className="px-3 py-1.5 rounded-lg bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold cursor-pointer"
                >
                  Kayıp / Eksik
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendClubAlert(pl, `${l.item_name} iadesi beklenmektedir.`)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold"
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