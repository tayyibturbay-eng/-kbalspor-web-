"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MembershipRequest, POSITIONS } from "@/types/club";
import { calcAgeGroupFromBirthDate, defaultPinFromPhone } from "@/lib/club-utils";

const supabase = createClient();

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
  const [requestPositions, setRequestPositions] = useState<Record<string, string>>({});

  async function approveRequest(req: MembershipRequest) {
    const code = `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const pin = defaultPinFromPhone(req.parent_phone);
    const group = req.birth_date
      ? calcAgeGroupFromBirthDate(req.birth_date)
      : req.age_group;
    const chosenPosition = requestPositions[req.id] || req.position || "Orta Saha";

    const { error } = await supabase.from("players").insert({
      full_name: req.full_name,
      birth_date: req.birth_date || null,
      age_group: group,
      position: chosenPosition,
      parent_phone: req.parent_phone,
      player_code: code,
      player_pin: pin,
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
      `✅ ${req.full_name} (${chosenPosition}) onaylandı! ID: ${code} | Şifre: ${pin}`
    );
    await onRefresh();
  }

  async function deleteRequest(req: MembershipRequest) {
    await supabase.from("membership_requests").delete().eq("id", req.id);
    await onLogActivity("Üyelik Talebi Silme", `${req.full_name} talebi silindi.`);
    onFeedback("Üyelik talebi silindi.");
    await onRefresh();
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
      <h2 className="text-lg font-extrabold text-[#02274c]">Gelen Üyelik Talepleri</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">Henüz üyelik talebi yok.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const selectedPos = requestPositions[r.id] || r.position || "Orta Saha";
            return (
              <div
                key={r.id}
                className={`border rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 ${
                  r.status === "bekliyor"
                    ? "bg-amber-50 border-amber-300"
                    : "bg-slate-50"
                }`}
              >
                <div className="text-sm">
                  <div className="font-bold text-[#02274c]">
                    {r.full_name} ({r.age_group})
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white border">
                      {r.status === "bekliyor" ? "Onay Bekliyor" : "Onaylandı"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Doğum: {r.birth_date || "-"} | Telefon: {r.parent_phone}
                    {r.status !== "bekliyor" && ` | Mevki: ${r.position || "-"}`}
                  </div>
                  {r.notes && (
                    <div className="text-xs text-slate-500 mt-0.5">Not: {r.notes}</div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "bekliyor" && (
                    <>
                      <select
                        value={selectedPos}
                        onChange={(e) =>
                          setRequestPositions((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="border border-slate-300 bg-white rounded-lg px-2.5 py-2 text-xs font-bold text-[#02274c]"
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            Mevki: {pos}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => approveRequest(r)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
                      >
                        Onayla & ID Aç
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteRequest(r)}
                    className="bg-red-100 text-red-700 text-xs font-bold px-4 py-2 rounded-lg"
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