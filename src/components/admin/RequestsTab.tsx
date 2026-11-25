"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MembershipRequest, POSITIONS } from "@/types/club";
import {
  calcAgeGroupFromBirthDate,
  defaultPinFromPhone,
  formatDateTimeTR,
} from "@/lib/club-utils";
import { MEMBERSHIP_STATUS, isPendingStatus } from "@/lib/membership-status";
import { SPRING } from "@/lib/motion";

const supabase = createClient();

function generatePlayerCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const num = 1000 + (arr[0] % 9000);
  return `IKB-${num}`;
}

interface RequestsTabProps {
  requests: MembershipRequest[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function RequestsTab({
  requests,
  onFeedback,
  onLogActivity,
  onRefresh,
}: RequestsTabProps) {
  const azaltilmis = useReducedMotion();
  const [requestPositions, setRequestPositions] = useState<
    Record<string, string>
  >({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const visibleRequests = requests.filter((r) => !deletedIds.includes(r.id));

  async function approveRequest(req: MembershipRequest) {
    if (busyRequestId) return;
    setBusyRequestId(req.id);
    try {
      const code = generatePlayerCode();
      const pin = defaultPinFromPhone(req.parent_phone);
      const group = req.birth_date
        ? calcAgeGroupFromBirthDate(req.birth_date)
        : req.age_group;
      const chosenPosition =
        requestPositions[req.id] || req.position || "Orta Saha";

      const { error } = await supabase.from("players").insert({
        full_name: req.full_name,
        birth_date: req.birth_date || null,
        age_group: group,
        position: chosenPosition,
        parent_phone: req.parent_phone,
        player_code: code,
        player_pin: pin,
        skill_points: 20,
        stat_pac: 20,
        stat_sho: 20,
        stat_pas: 20,
        stat_dri: 20,
        stat_def: 20,
        stat_phy: 20,
        pin_changed: false,
      });

      if (error) {
        onFeedback("Onay hatası: " + error.message);
        return;
      }

      const { error: statusErr } = await supabase
        .from("membership_requests")
        .update({ status: MEMBERSHIP_STATUS.APPROVED, position: chosenPosition })
        .eq("id", req.id);

      if (statusErr) {
        onFeedback(
          `Sporcu kaydı oluştu (ID: ${code}) ancak talep durumu güncellenemedi: ${statusErr.message}`
        );
        await onRefresh();
        return;
      }

      await onLogActivity(
        "Üyelik Onayı",
        `${req.full_name} (${group} - ${chosenPosition}) onaylandı — ID: ${code}`
      );
      onFeedback(
        `${req.full_name} (${chosenPosition}) onaylandı. ID: ${code} | Şifre: ${pin}`
      );
      await onRefresh();
    } finally {
      setBusyRequestId(null);
    }
  }

  // Optimistic silme + hata durumunda rollback
  async function deleteRequest(req: MembershipRequest) {
    if (busyRequestId) return;
    setBusyRequestId(req.id);
    setDeletedIds((prev) => [...prev, req.id]);
    onFeedback("Üyelik talebi silindi.");

    try {
      const { error } = await supabase
        .from("membership_requests")
        .delete()
        .eq("id", req.id);

      if (error) {
        setDeletedIds((prev) => prev.filter((id) => id !== req.id));
        onFeedback("Silme hatası, geri alındı: " + error.message);
        return;
      }

      await onLogActivity(
        "Üyelik Talebi Silme",
        `${req.full_name} talebi silindi.`
      );
      await onRefresh();
      setDeletedIds((prev) => prev.filter((id) => id !== req.id));
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="k-artik p-5 sm:p-6 space-y-4 tabular-nums">
      <div className="space-y-0.5">
        <span className="k-koz text-[10px] block">ÖN KAYIT HAVUZU</span>
        <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
          Gelen Üyelik Talepleri ({visibleRequests.length})
        </h2>
      </div>

      {visibleRequests.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center text-xs font-bold text-[var(--text-secondary)]">
          Henüz üyelik talebi yok.
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {visibleRequests.map((r) => {
              const selectedPos =
                requestPositions[r.id] || r.position || "Orta Saha";
              const isPending = isPendingStatus(r.status);
              return (
                <motion.div
                  layout
                  key={r.id}
                  initial={azaltilmis ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={SPRING.yumusak}
                  className={`border rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3 ${
                    isPending
                      ? "bg-[var(--status-warning-bg)]/45 border-amber-400/50"
                      : "bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="text-sm space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-extrabold text-[var(--text-primary)]">
                      <span>
                        {r.full_name} ({r.age_group})
                      </span>
                      <span
                        className={`k-etiket ${
                          isPending ? "k-etiket--uyari" : "k-etiket--basari"
                        }`}
                      >
                        {isPending ? "Onay Bekliyor" : "Onaylandı"}
                      </span>
                      <span className="k-etiket k-etiket--lacivert font-mono">
                        {formatDateTimeTR(r.created_at)}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      Doğum: {r.birth_date || "-"} | Telefon:{" "}
                      {r.parent_phone || "Belirtilmemiş"}
                      {!isPending && ` | Mevki: ${r.position || "-"}`}
                    </div>
                    {r.notes && (
                      <div className="text-xs text-[var(--text-secondary)]">
                        Not: {r.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isPending && (
                      <>
                        <select
                          value={selectedPos}
                          onChange={(e) =>
                            setRequestPositions((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          className="k-alan !w-auto !py-1.5 text-xs font-bold"
                        >
                          {POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              Mevki: {pos}
                            </option>
                          ))}
                        </select>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => approveRequest(r)}
                          disabled={busyRequestId !== null}
                          className="k-buton !bg-emerald-600 hover:!bg-emerald-700 !text-white !py-2 !px-4 !text-xs"
                        >
                          {busyRequestId === r.id
                            ? "İşleniyor…"
                            : "Onayla & ID Aç"}
                        </motion.button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteRequest(r)}
                      disabled={busyRequestId !== null}
                      className="px-3.5 py-2 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}