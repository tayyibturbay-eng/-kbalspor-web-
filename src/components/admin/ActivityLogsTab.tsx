"use client";

import { useMemo, useState } from "react";
import { ActivityLog } from "@/types/club";
import { formatDateTimeTR } from "@/lib/club-utils";

interface ActivityLogsTabProps {
  logs: ActivityLog[];
}

function getLogCategory(log: ActivityLog): string {
  const action = (log.action || "").toLocaleLowerCase("tr-TR");
  const details = (log.details || "").toLocaleLowerCase("tr-TR");

  if (action.includes("sil") || details.includes("silindi")) {
    if (details.includes("oyuncu") || action.includes("oyuncu")) {
      return "Oyuncu Silme";
    }
    return "Silme İşlemi";
  }
  if (action.includes("üyelik") || details.includes("üyelik")) {
    return "Üyelik İşlemleri";
  }
  if (action.includes("qr") || action.includes("yoklama")) {
    return "QR Yoklama";
  }
  if (action.includes("puan") || action.includes("yetenek")) {
    return "Yetenek Puanı";
  }
  if (action.includes("bildirim")) {
    return "Bildirim Gönderimi";
  }
  return "Diğer";
}

export function ActivityLogsTab({ logs }: ActivityLogsTabProps) {
  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");

  const categories = useMemo(() => {
    const found = new Set<string>(["Tümü", "Oyuncu Silme"]);
    logs.forEach((l) => found.add(getLogCategory(l)));
    return Array.from(found);
  }, [logs]);

  const filteredLogs = logs.filter((l) => {
    const dateOk =
      !logDateFilter || (l.created_at || "").startsWith(logDateFilter);
    const categoryOk =
      selectedCategory === "Tümü" || getLogCategory(l) === selectedCategory;
    const q = logSearch.toLocaleLowerCase("tr-TR");
    const searchOk =
      !q ||
      (l.action || "").toLocaleLowerCase("tr-TR").includes(q) ||
      (l.details || "").toLocaleLowerCase("tr-TR").includes(q) ||
      (l.actor || "").toLocaleLowerCase("tr-TR").includes(q);
    return dateOk && categoryOk && searchOk;
  });

  return (
    <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-extrabold text-[#02274c]">
          Son İşlemler (Gün &amp; Saat Kayıtları)
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="İşlem kategorisi seç"
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "Tümü" ? "Kategori: Tümü" : cat}
              </option>
            ))}
          </select>

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
              <th className="p-2.5">Tarih &amp; Saat</th>
              <th className="p-2.5">Yapan</th>
              <th className="p-2.5">İşlem</th>
              <th className="p-2.5">Detay</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-4 text-center text-xs text-slate-500"
                >
                  Filtre kriterlerine uygun işlem kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => {
                const cat = getLogCategory(l);
                const badgeStyle =
                  cat === "Oyuncu Silme" || cat === "Silme İşlemi"
                    ? "bg-red-100 text-red-900"
                    : cat === "Üyelik İşlemleri"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-blue-50 text-blue-900";

                return (
                  <tr
                    key={l.id}
                    className="border-b border-slate-200 hover:bg-slate-50"
                  >
                    <td className="p-2.5 text-xs font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {formatDateTimeTR(l.created_at)}
                    </td>
                    <td className="p-2.5 text-xs font-bold text-[#02274c]">
                      {l.actor}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${badgeStyle}`}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-slate-800">
                      {l.details}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}