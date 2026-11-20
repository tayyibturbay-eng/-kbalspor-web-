"use client";

import { useState } from "react";
import { ActivityLog } from "@/types/club";

interface ActivityLogsTabProps {
  logs: ActivityLog[];
}

export function ActivityLogsTab({ logs }: ActivityLogsTabProps) {
  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");

  const filteredLogs = logs.filter(
    (l) =>
      (!logDateFilter || l.created_at.startsWith(logDateFilter)) &&
      (l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.details.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.actor.toLowerCase().includes(logSearch.toLowerCase()))
  );

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-extrabold text-[#02274c]">
          Son İşlemler (Gün & Saat Kayıtları)
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={logDateFilter}
            onChange={(e) => setLogDateFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs"
          />
          <input
            placeholder="İşlem, kişi veya detay ara..."
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs w-56"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-[#02274c] text-xs">
            <tr>
              <th className="p-2.5">Tarih & Saat</th>
              <th className="p-2.5">Yapan</th>
              <th className="p-2.5">İşlem</th>
              <th className="p-2.5">Detay</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((l) => (
              <tr key={l.id} className="border-b hover:bg-slate-50">
                <td className="p-2.5 text-xs font-mono whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </td>
                <td className="p-2.5 text-xs font-bold text-[#02274c]">
                  {l.actor}
                </td>
                <td className="p-2.5">
                  <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded">
                    {l.action}
                  </span>
                </td>
                <td className="p-2.5 text-xs text-slate-700">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}