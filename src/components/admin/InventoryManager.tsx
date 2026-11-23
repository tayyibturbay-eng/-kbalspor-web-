// InventoryManager.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EquipmentLog, JerseySet, StockItem } from "@/types/club";
import { JerseySetsSection } from "./inventory/JerseySetsSection";
import { StockAndGiveSection } from "./inventory/StockAndGiveSection";
import { EquipmentLogsSection } from "./inventory/EquipmentLogsSection";

const supabase = createClient();

interface MiniPlayer {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
}

export function InventoryManager({ players }: { players: MiniPlayer[] }) {
  const [subTab, setSubTab] = useState<
    "inventory_all" | "unreturned" | "missing"
  >("inventory_all");

  const [jerseySets, setJerseySets] = useState<JerseySet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [jRes, sRes, lRes] = await Promise.all([
        supabase
          .from("jersey_sets")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_stock")
          .select("*")
          .order("product_name", { ascending: true }),
        supabase
          .from("equipment_logs")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (jRes.data) setJerseySets(jRes.data as JerseySet[]);
      if (sRes.data) setStockItems(sRes.data as StockItem[]);
      if (lRes.data) setLogs(lRes.data as EquipmentLog[]);
    })();
  }, []);

  const unreturnedLogs = logs.filter((l) => l.status === "teslim_edildi");
  const missingLogs = logs.filter((l) => l.status === "kayip_eksik");

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      {statusMsg && (
        <div className="p-3 rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-xs font-bold flex justify-between items-center gap-3">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="underline ml-3 shrink-0 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          {
            k: "inventory_all",
            l: `Teslim, Stok & Takımlar (${jerseySets.length + stockItems.length})`,
          },
          { k: "unreturned", l: `Geri Verilmeyenler (${unreturnedLogs.length})` },
          { k: "missing", l: `Eksik / Kayıp (${missingLogs.length})` },
        ].map((item) => (
          <button
            key={item.k}
            type="button"
            onClick={() => setSubTab(item.k as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              subTab === item.k
                ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                : "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {item.l}
          </button>
        ))}
      </div>

      <div key={subTab} className="page-transition">
        {subTab === "inventory_all" && (
          <div className="space-y-8">
            <StockAndGiveSection
              players={players}
              jerseySets={jerseySets}
              stockItems={stockItems}
              setStockItems={setStockItems}
              logs={logs}
              setLogs={setLogs}
              onStatus={setStatusMsg}
            />
            <div className="border-t border-[var(--border-subtle)] pt-6">
              <JerseySetsSection
                jerseySets={jerseySets}
                setJerseySets={setJerseySets}
                logs={logs}
                setLogs={setLogs}
                players={players}
                onStatus={setStatusMsg}
              />
            </div>
          </div>
        )}

        {subTab === "unreturned" && (
          <EquipmentLogsSection
            mode="unreturned"
            players={players}
            logs={unreturnedLogs}
            setLogs={setLogs}
          />
        )}

        {subTab === "missing" && (
          <EquipmentLogsSection
            mode="missing"
            players={players}
            logs={missingLogs}
            setLogs={setLogs}
          />
        )}
      </div>
    </div>
  );
}