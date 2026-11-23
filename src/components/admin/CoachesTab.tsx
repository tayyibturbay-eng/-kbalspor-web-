// CoachesTab.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach } from "@/types/club";

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
    assigned_groups: ["Tümü"] as string[],
  });

  function toggleGroup(group: string) {
    setNewCoach((prev) => {
      if (group === "Tümü") {
        return { ...prev, assigned_groups: ["Tümü"] };
      }
      const withoutAll = prev.assigned_groups.filter((g) => g !== "Tümü");
      const exists = withoutAll.includes(group);
      const next = exists
        ? withoutAll.filter((g) => g !== group)
        : [...withoutAll, group];
      return {
        ...prev,
        assigned_groups: next.length > 0 ? next : ["Tümü"],
      };
    });
  }

  async function updateCoachGroups(coach: Coach, nextGroup: string) {
    const groups = nextGroup === "Tümü" ? ["Tümü"] : [nextGroup];
    const { error } = await supabase
      .from("coaches")
      .update({ assigned_groups: groups })
      .eq("id", coach.id);
    if (error) {
      onFeedback("Grup güncellenemedi: " + error.message);
      return;
    }
    await onLogActivity(
      "Antrenör / Temsilci Grubu",
      `${coach.full_name} grubu "${groups.join(", ")}" yapıldı.`
    );
    onFeedback(
      `${coach.full_name} grubu "${groups.join(", ")}" olarak güncellendi.`
    );
    await onRefreshCoaches();
  }

  async function addCoach(e: React.FormEvent) {
    e.preventDefault();
    const code =
      newCoach.coach_code.trim().toUpperCase() ||
      `ANT-${Math.floor(1000 + Math.random() * 9000)}`;
    const groupsToSave =
      newCoach.assigned_groups.length > 0 ? newCoach.assigned_groups : ["Tümü"];

    const { error } = await supabase.from("coaches").insert({
      full_name: newCoach.full_name.trim(),
      coach_code: code,
      pin: newCoach.pin.trim() || "1234",
      phone: newCoach.phone.trim() || null,
      assigned_groups: groupsToSave,
      is_active: true,
    });
    if (error) {
      onFeedback("Antrenör eklenemedi: " + error.message);
      return;
    }
    await onLogActivity(
      "Antrenör Ekleme",
      `${newCoach.full_name} (${code}) — Kapsam: ${groupsToSave.join(", ")}`
    );
    onFeedback(
      `${newCoach.full_name} eklendi (Kod: ${code}, Kapsam: ${groupsToSave.join(
        ", "
      )}).`
    );
    setNewCoach({
      full_name: "",
      coach_code: "",
      pin: "1234",
      phone: "",
      assigned_groups: ["Tümü"],
    });
    await onRefreshCoaches();
  }

  async function deleteCoach(coach: Coach) {
    if (
      !confirm(`${coach.full_name} adlı kişiyi silmek istediğinize emin misiniz?`)
    )
      return;
    await supabase.from("coaches").delete().eq("id", coach.id);
    await onLogActivity("Antrenör Silme", `${coach.full_name} silindi.`);
    await onRefreshCoaches();
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)]">
      <form
        onSubmit={addCoach}
        className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3"
      >
        <h2 className="font-black text-[var(--text-primary)]">
          Yeni Antrenör / Temsilci Ekle (Önyüklü: Tüm Takım)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            placeholder="Ad Soyad"
            value={newCoach.full_name}
            onChange={(e) =>
              setNewCoach({ ...newCoach, full_name: e.target.value })
            }
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2 text-sm"
          />
          <input
            placeholder="Kod (Boşsa ANT-XXXX)"
            value={newCoach.coach_code}
            onChange={(e) =>
              setNewCoach({ ...newCoach, coach_code: e.target.value })
            }
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2 text-sm uppercase"
          />
          <input
            placeholder="Giriş Şifresi (PIN)"
            value={newCoach.pin}
            onChange={(e) => setNewCoach({ ...newCoach, pin: e.target.value })}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2 text-sm"
          />
          <input
            placeholder="Telefon"
            value={newCoach.phone}
            onChange={(e) => setNewCoach({ ...newCoach, phone: e.target.value })}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3.5 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Tümü", ...AGE_GROUPS].map((g) => {
            const active = newCoach.assigned_groups.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer transition ${
                  active
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </button>
            );
          })}
        </div>

        <button
          type="submit"
          className="bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold px-5 py-2.5 rounded-xl text-sm cursor-pointer transition"
        >
          Kaydet
        </button>
      </form>

      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-2.5">
        {coaches.map((c) => {
          const currentGroup =
            Array.isArray(c.assigned_groups) && c.assigned_groups.length > 0
              ? c.assigned_groups[0]
              : "Tümü";
          return (
            <div
              key={c.id}
              className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--border-subtle)] last:border-b-0 pb-2.5 last:pb-0 text-sm"
            >
              <div>
                <strong className="text-[var(--text-primary)]">
                  {c.full_name}
                </strong>{" "}
                — Kod:{" "}
                <span className="font-mono text-[var(--text-secondary)]">
                  {c.coach_code}
                </span>{" "}
                | Şifre:{" "}
                <span className="font-mono text-[var(--text-secondary)]">
                  {c.pin}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentGroup}
                  onChange={(e) => updateCoachGroups(c, e.target.value)}
                  className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] rounded-lg px-2.5 py-1 text-xs font-bold text-[var(--text-primary)]"
                >
                  <option value="Tümü">Tüm Takım</option>
                  {AGE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deleteCoach(c)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer"
                >
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}