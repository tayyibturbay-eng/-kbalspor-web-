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

  async function approveRequest(req: MembershipRequest) {
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

    await supabase
      .from("membership_requests")
      .update({ status: "onaylandi", position: chosenPosition })
      .eq("id", req.id);

    await onLogActivity(
      "Üyelik Onayı",
      `${req.full_name} (${group} - ${chosenPosition}) onaylandı — ID: ${code}`
    );
    onFeedback(
      `${req.full_name} (${chosenPosition}) onaylandı. ID: ${code} | Şifre: ${pin}`
    );
    await onRefresh();
  }

  async function deleteRequest(req: MembershipRequest) {
    await supabase.from("membership_requests").delete().eq("id", req.id);
    await onLogActivity(
      "Üyelik Talebi Silme",
      `${req.full_name} talebi silindi.`
    );
    onFeedback("Üyelik talebi silindi.");
    await onRefresh();
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
            const isPending =
              r.status === "bekliyor" || r.status === "beklemede";
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
                    Doğum: {r.birth_date || "-"} | Telefon: {r.parent_phone}
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
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Onayla &amp; ID Aç
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteRequest(r)}
                    className="bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold px-4 py-2 rounded-lg cursor-pointer"
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