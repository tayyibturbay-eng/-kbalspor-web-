// ActivityLogsTab.tsx
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
    <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Son İşlemler (Gün &amp; Saat Kayıtları)
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="İşlem kategorisi seç"
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 text-xs font-bold"
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
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums"
          />

          <input
            placeholder="İşlem, kişi veya detay ara..."
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-lg px-3 py-1.5 text-xs font-medium w-56"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm text-left text-[var(--text-primary)]">
          <thead className="bg-[var(--bg-subtle)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold border-b border-[var(--border-subtle)]">
            <tr>
              <th className="p-2.5">Tarih &amp; Saat</th>
              <th className="p-2.5">Yapan</th>
              <th className="p-2.5">İşlem</th>
              <th className="p-2.5">Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-5 text-center text-xs text-[var(--text-secondary)]"
                >
                  Filtre kriterlerine uygun işlem kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => {
                const cat = getLogCategory(l);
                const badgeStyle =
                  cat === "Oyuncu Silme" || cat === "Silme İşlemi"
                    ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                    : cat === "Üyelik İşlemleri"
                    ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                    : "bg-[var(--status-info-bg)] text-[var(--status-info-text)]";

                return (
                  <tr
                    key={l.id}
                    className="hover:bg-[var(--bg-subtle)]/70 transition-colors"
                  >
                    <td className="p-2.5 text-xs font-mono font-semibold text-[var(--text-secondary)] whitespace-nowrap tabular-nums">
                      {formatDateTimeTR(l.created_at)}
                    </td>
                    <td className="p-2.5 text-xs font-bold text-[var(--text-primary)]">
                      {l.actor}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${badgeStyle}`}
                      >
                        {l.action}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-[var(--text-secondary)]">
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