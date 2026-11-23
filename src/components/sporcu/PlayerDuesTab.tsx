// PlayerDuesTab.tsx
"use client";

import { useMemo } from "react";

export type DueDisplayItem = {
  monthLabel: string;
  amount: number;
  state: "paid" | "overdue" | "unpaid" | "upcoming";
};

interface PlayerDuesTabProps {
  dueItems: DueDisplayItem[];
  overdueCount: number;
}

export function PlayerDuesTab({ dueItems, overdueCount }: PlayerDuesTabProps) {
  const summary = useMemo(() => {
    const paidCount = dueItems.filter((x) => x.state === "paid").length;
    const unpaidCount = dueItems.filter((x) => x.state === "unpaid").length;
    return { paidCount, unpaidCount };
  }, [dueItems]);

  return (
    <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Aidat Durumum
        </h2>
        <div className="flex flex-wrap gap-2 text-xs font-extrabold tabular-nums">
          <span className="px-2.5 py-1 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
            Ödendi: {summary.paidCount}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
            Güncel: {summary.unpaidCount}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">
            Gecikmiş: {overdueCount}
          </span>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-text)]/25 text-[var(--status-danger-text)] text-xs font-extrabold">
          Geçmiş dönemden gecikmiş {overdueCount} adet aidat ödemeniz
          bulunmaktadır. Lütfen yöneticinizle iletişime geçin.
        </div>
      )}

      <div className="space-y-2.5">
        {dueItems.map((item) => (
          <div
            key={item.monthLabel}
            className={`flex items-center justify-between p-4 rounded-2xl border ${
              item.state === "overdue"
                ? "bg-[var(--status-danger-bg)]/55 border-[var(--status-danger-text)]/25"
                : item.state === "unpaid"
                ? "bg-[var(--status-warning-bg)]/55 border-[var(--status-warning-text)]/25"
                : "bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
            }`}
          >
            <div>
              <div className="font-extrabold text-[var(--text-primary)]">
                {item.monthLabel}
              </div>
              <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                {item.amount} TL
                {item.state === "overdue" && " • Ödeme süresi geçti"}
                {item.state === "unpaid" && " • Güncel dönem ödemesi"}
              </div>
            </div>

            {item.state === "paid" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
                Ödendi
              </span>
            )}
            {item.state === "unpaid" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
                Ödenmedi
              </span>
            )}
            {item.state === "overdue" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--status-danger-text)] text-white">
                Gecikti
              </span>
            )}
            {item.state === "upcoming" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--bg-canvas)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                Bekleniyor
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}