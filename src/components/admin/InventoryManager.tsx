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
    <div className="space-y-6 text-slate-900">
      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex justify-between items-center gap-3">
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
            l: `Forma Takımları & Ürün Stoğu (${jerseySets.length + stockItems.length})`,
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
                ? "bg-[#02274c] text-white border-[#02274c]"
                : "bg-white text-[#02274c] border-slate-300 hover:bg-slate-50"
            }`}
          >
            {item.l}
          </button>
        ))}
      </div>

      {subTab === "inventory_all" && (
        <div className="space-y-8">
          <JerseySetsSection
            jerseySets={jerseySets}
            setJerseySets={setJerseySets}
            onStatus={setStatusMsg}
          />
          <div className="border-t border-slate-200 pt-6">
            <StockAndGiveSection
              players={players}
              jerseySets={jerseySets}
              stockItems={stockItems}
              setStockItems={setStockItems}
              logs={logs}
              setLogs={setLogs}
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
  );
}