"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ActivityLog } from "@/types/club";
import { SPRING } from "@/lib/motion";

const supabase = createClient();

interface ActivityLogsTabProps {
  logs: ActivityLog[];
  onLogsChange?: (nextLogs: ActivityLog[]) => void;
}

export function ActivityLogsTab({ logs, onLogsChange }: ActivityLogsTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  // Optimistic tekil silme + rollback
  async function handleDeleteSingle(id: string) {
    setFeedback("");
    const snapshot = logs;
    const updated = logs.filter((l) => l.id !== id);
    onLogsChange?.(updated);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setFeedback("İşlem kaydı silindi.");

    const { error } = await supabase.from("activity_logs").delete().eq("id", id);

    if (error) {
      onLogsChange?.(snapshot);
      setFeedback("İşlem kaydı silinemedi, geri alındı: " + error.message);
    }
  }

  // Optimistic toplu silme + rollback
  async function handleDeleteBatch(ids: string[], modeLabel: string) {
    if (ids.length === 0) return;
    setFeedback("");
    const snapshot = logs;
    const updated = logs.filter((l) => !ids.includes(l.id));

    setBulkDeleting(true);
    onLogsChange?.(updated);
    setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
    setFeedback(`${ids.length} adet işlem kaydı silindi (${modeLabel}).`);

    const { error } = await supabase.from("activity_logs").delete().in("id", ids);
    setBulkDeleting(false);

    if (error) {
      onLogsChange?.(snapshot);
      setFeedback("Toplu silme başarısız, geri alındı: " + error.message);
    }
  }

  return (
    <div className="k-artik p-6 space-y-4 text-[var(--text-primary)] tabular-nums">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">DENETİM GÜNLÜĞÜ</span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Son İşlemler &amp; Denetim Kayıtları ({logs.length})
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Kayıtları tek tek silebilir, seçilenleri toplu silebilir veya tüm
            listeyi temizleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="k-buton k-buton--hayalet !py-1.5 !px-3 !text-xs"
            >
              {selectedIds.length === logs.length
                ? "Seçimi Kaldır"
                : "Tümünü Seç"}
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={() =>
                void handleDeleteBatch(selectedIds, "Seçili İşlemler")
              }
              className="k-buton k-buton--lacivert !py-1.5 !px-3.5 !text-xs"
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
            className="k-buton k-buton--kirmizi !py-1.5 !px-3.5 !text-xs"
          >
            {bulkDeleting ? "Siliniyor..." : "Tümünü Temizle"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-xs font-extrabold">
          {feedback}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
          Henüz işlem kaydı bulunmuyor.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              const isSelected = selectedIds.includes(log.id);
              return (
                <motion.div
                  layout
                  key={log.id}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={SPRING.yumusak}
                  className="py-3.5 flex flex-wrap items-start justify-between gap-3 text-xs sm:text-sm"
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
                        <span className="k-etiket k-etiket--lacivert">
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
                    onClick={() => void handleDeleteSingle(log.id)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition shrink-0"
                  >
                    Sil
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}