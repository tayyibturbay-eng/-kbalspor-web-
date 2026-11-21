"use client";

import { useState } from "react";
import { ActivityLog } from "@/types/club";
import { formatDateTimeTR } from "@/lib/club-utils";

interface ActivityLogsTabProps {
  logs: ActivityLog[];
}

export function ActivityLogsTab({ logs }: ActivityLogsTabProps) {
  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");
  const [onlyMembership, setOnlyMembership] = useState(false);

  const filteredLogs = logs.filter((l) => {
    const dateOk = !logDateFilter || (l.created_at || "").startsWith(logDateFilter);
    const membershipOk =
      !onlyMembership ||
      l.action.toLowerCase().includes("üyelik") ||
      l.details.toLowerCase().includes("üyelik");
    const q = logSearch.toLowerCase();
    const searchOk =
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q);
    return dateOk && membershipOk && searchOk;
  });

  return (
    <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-extrabold text-[#02274c]">
          Son İşlemler (Gün & Saat Kayıtları)
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyMembership((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              onlyMembership
                ? "bg-[#a60513] text-white border-[#a60513]"
                : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {onlyMembership ? "✓ Üyelik Talepleri" : "Üyelik Taleplerini Filtrele"}
          </button>
          <input
            type="date"
            value={logDateFilter}
            onChange={(e) => setLogDateFilter(e.target.value)}
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-1.5 text-xs font-medium"
          />
          <input
            placeholder="İşlem, kişi veya detay ara..."
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            className="border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 rounded-lg px-3 py-1.5 text-xs font-medium w-56"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-900">
          <thead className="bg-slate-100 text-[#02274c] text-xs font-extrabold">
            <tr>
              <th className="p-2.5">Tarih & Saat</th>
              <th className="p-2.5">Yapan</th>
              <th className="p-2.5">İşlem</th>
              <th className="p-2.5">Detay</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((l) => {
              const isMembership =
                l.action.toLowerCase().includes("üyelik") ||
                l.details.toLowerCase().includes("üyelik");
              return (
                <tr key={l.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-2.5 text-xs font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {formatDateTimeTR(l.created_at)}
                  </td>
                  <td className="p-2.5 text-xs font-bold text-[#02274c]">
                    {l.actor}
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isMembership
                          ? "bg-amber-100 text-amber-900"
                          : "bg-blue-50 text-blue-900"
                      }`}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="p-2.5 text-xs text-slate-800">{l.details}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}