"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Coach } from "@/types/club";

const supabase = createClient();

interface CoachesTabProps {
  coaches: Coach[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefreshCoaches: () => Promise<void>;
}

export function CoachesTab({
  coaches,
  onFeedback,
  onLogActivity,
  onRefreshCoaches,
}: CoachesTabProps) {
  const [newCoach, setNewCoach] = useState({
    full_name: "",
    coach_code: "",
    pin: "1234",
    phone: "",
    assigned_groups: ["U13", "U14", "U15"] as string[],
  });

  async function addCoach(e: React.FormEvent) {
    e.preventDefault();
    const code =
      newCoach.coach_code.trim().toUpperCase() ||
      `ANT-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from("coaches").insert({
      full_name: newCoach.full_name.trim(),
      coach_code: code,
      pin: newCoach.pin.trim() || "1234",
      phone: newCoach.phone.trim() || null,
      assigned_groups: newCoach.assigned_groups,
      is_active: true,
    });
    if (error) {
      onFeedback("Antrenör eklenemedi: " + error.message);
      return;
    }
    await onLogActivity("Antrenör Ekleme", `${newCoach.full_name} (${code}) eklendi.`);
    onFeedback(
      `✅ Antrenör ${newCoach.full_name} eklendi (Kod: ${code}, Şifre: ${newCoach.pin}).`
    );
    setNewCoach({
      full_name: "",
      coach_code: "",
      pin: "1234",
      phone: "",
      assigned_groups: ["U13", "U14", "U15"],
    });
    await onRefreshCoaches();
  }

  async function deleteCoach(coach: Coach) {
    if (!confirm(`${coach.full_name} adlı antrenörü silmek istediğinize emin misiniz?`))
      return;
    await supabase.from("coaches").delete().eq("id", coach.id);
    await onLogActivity("Antrenör Silme", `${coach.full_name} silindi.`);
    await onRefreshCoaches();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={addCoach}
        className="bg-white p-5 rounded-2xl shadow-sm border space-y-3"
      >
        <h2 className="font-bold text-[#02274c]">Yeni Antrenör Ekle</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            placeholder="Antrenör Ad Soyad"
            value={newCoach.full_name}
            onChange={(e) =>
              setNewCoach({ ...newCoach, full_name: e.target.value })
            }
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Antrenör Kodu (Boşsa ANT-XXXX)"
            value={newCoach.coach_code}
            onChange={(e) =>
              setNewCoach({ ...newCoach, coach_code: e.target.value })
            }
            className="border rounded-lg px-3 py-2 text-sm uppercase"
          />
          <input
            placeholder="Giriş Şifresi (PIN)"
            value={newCoach.pin}
            onChange={(e) => setNewCoach({ ...newCoach, pin: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Telefon"
            value={newCoach.phone}
            onChange={(e) => setNewCoach({ ...newCoach, phone: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-[#02274c] text-white font-bold px-5 py-2 rounded-lg text-sm"
        >
          Antrenörü Kaydet
        </button>
      </form>

      <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
        {coaches.map((c) => (
          <div
            key={c.id}
            className="flex justify-between items-center border-b pb-2 text-sm"
          >
            <div>
              <strong>{c.full_name}</strong> — Kod:{" "}
              <span className="font-mono">{c.coach_code}</span> | Şifre:{" "}
              <span className="font-mono">{c.pin}</span>
            </div>
            <button
              onClick={() => deleteCoach(c)}
              className="text-xs text-red-700 font-bold"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}