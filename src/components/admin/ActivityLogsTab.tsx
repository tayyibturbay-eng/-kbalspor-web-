"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActivityLog } from "@/types/club";

const supabase = createClient();

interface ActivityLogsTabProps {
  logs: ActivityLog[];
  onLogsChange?: (nextLogs: ActivityLog[]) => void;
}

export function ActivityLogsTab({ logs, onLogsChange }: ActivityLogsTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (logs.length > 0 && selectedIds.length === logs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map((l) => l.id));
    }
  };

  async function handleDeleteSingle(id: string) {
    setFeedback("");
    setDeletingId(id);
    const { error } = await supabase.from("activity_logs").delete().eq("id", id);
    setDeletingId(null);

    if (error) {
      setFeedback("İşlem kaydı silinemedi: " + error.message);
      return;
    }

    const updated = logs.filter((l) => l.id !== id);
    onLogsChange?.(updated);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setFeedback("İşlem kaydı silindi.");
  }

  async function handleDeleteBatch(ids: string[], modeLabel: string) {
    if (ids.length === 0) return;
    setFeedback("");
    setBulkDeleting(true);
    const { error } = await supabase.from("activity_logs").delete().in("id", ids);
    setBulkDeleting(false);

    if (error) {
      setFeedback("Toplu silme başarısız: " + error.message);
      return;
    }

    const updated = logs.filter((l) => !ids.includes(l.id));
    onLogsChange?.(updated);
    setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
    setFeedback(`${ids.length} adet işlem kaydı silindi (${modeLabel}).`);
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs text-[var(--text-primary)] tabular-nums">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">
            Son İşlemler &amp; Denetim Kayıtları ({logs.length})
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Kayıtları tek tek silebilir, seçilenleri toplu silebilir veya tüm listeyi temizleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
            >
              {selectedIds.length === logs.length ? "Seçimi Kaldır" : "Tümünü Seç"}
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={() => void handleDeleteBatch(selectedIds, "Seçili İşlemler")}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
            >
              Seçilenleri Sil ({selectedIds.length})
            </button>
          )}

          <button
            type="button"
            disabled={bulkDeleting || logs.length === 0}
            onClick={() =>
              void handleDeleteBatch(
                logs.map((l) => l.id),
                "Tüm İşlemler"
              )
            }
            className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
          >
            {bulkDeleting ? "Siliniyor..." : "Tümünü Temizle"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-xs font-bold">
          {feedback}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
          Henüz işlem kaydı bulunmuyor.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {logs.map((log) => {
            const isSelected = selectedIds.includes(log.id);
            return (
              <div
                key={log.id}
                className="py-3 flex flex-wrap items-start justify-between gap-3 text-xs sm:text-sm"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(log.id)}
                    className="mt-1 accent-[var(--brand-red)] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-[var(--brand-ink)]">
                        {log.actor}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[11px] font-extrabold text-[var(--text-primary)]">
                        {log.action}
                      </span>
                      {log.created_at && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">
                      {log.details}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={deletingId === log.id}
                  onClick={() => void handleDeleteSingle(log.id)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {deletingId === log.id ? "Siliniyor..." : "Sil"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}