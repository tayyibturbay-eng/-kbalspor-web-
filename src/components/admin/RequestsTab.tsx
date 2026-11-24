// RequestsTab.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MembershipRequest, POSITIONS } from "@/types/club";
import {
  calcAgeGroupFromBirthDate,
  defaultPinFromPhone,
  formatDateTimeTR,
} from "@/lib/club-utils";
import { MEMBERSHIP_STATUS, isPendingStatus } from "@/lib/membership-status";

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
  const [requestPositions, setRequestPositions] = useState<
    Record<string, string>
  >({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

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

  async function deleteRequest(req: MembershipRequest) {
    if (busyRequestId) return;
    setBusyRequestId(req.id);
    try {
      const { error } = await supabase
        .from("membership_requests")
        .delete()
        .eq("id", req.id);

      if (error) {
        onFeedback("Silme hatası: " + error.message);
        return;
      }

      await onLogActivity(
        "Üyelik Talebi Silme",
        `${req.full_name} talebi silindi.`
      );
      onFeedback("Üyelik talebi silindi.");
      await onRefresh();
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3">
      <h2 className="text-lg font-black text-[var(--text-primary)]">
        Gelen Üyelik Talepleri
      </h2>
      {requests.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Henüz üyelik talebi yok.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const selectedPos =
              requestPositions[r.id] || r.position || "Orta Saha";
            const isPending = isPendingStatus(r.status);
            return (
              <div
                key={r.id}
                className={`border rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 ${
                  isPending
                    ? "bg-[var(--status-warning-bg)]/45 border-amber-400/50"
                    : "bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-[var(--text-primary)]">
                    <span>
                      {r.full_name} ({r.age_group})
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                      {isPending ? "Onay Bekliyor" : "Onaylandı"}
                    </span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--brand-navy)] text-white tabular-nums">
                      {formatDateTimeTR(r.created_at)}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
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
                        className="border border-[var(--border-strong)] bg-[var(--bg-surface)] rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--text-primary)]"
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            Mevki: {pos}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => approveRequest(r)}
                        disabled={busyRequestId !== null}
                        className="bg-[var(--status-success-text)] hover:opacity-90 text-white text-xs font-extrabold px-4 py-2 rounded-lg cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busyRequestId === r.id
                          ? "İşleniyor…"
                          : "Onayla & ID Aç"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteRequest(r)}
                    disabled={busyRequestId !== null}
                    className="bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold px-4 py-2 rounded-lg cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}