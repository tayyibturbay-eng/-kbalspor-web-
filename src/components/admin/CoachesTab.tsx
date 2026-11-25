"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Coach } from "@/types/club";
import { useOnay } from "@/components/ui/OnayDialog";
import { SPRING } from "@/lib/motion";

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
  const { onay } = useOnay();
  const [newCoach, setNewCoach] = useState({
    full_name: "",
    coach_code: "",
    pin: "1234",
    phone: "",
    assigned_groups: ["Tümü"] as string[],
  });
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [optimisticGroups, setOptimisticGroups] = useState<
    Record<string, string[]>
  >({});

  const visibleCoaches = coaches.filter((c) => !deletedIds.includes(c.id));

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

  // Optimistic grup güncelleme
  async function updateCoachGroups(coach: Coach, nextGroup: string) {
    const groups = nextGroup === "Tümü" ? ["Tümü"] : [nextGroup];
    setOptimisticGroups((prev) => ({ ...prev, [coach.id]: groups }));
    onFeedback(
      `${coach.full_name} grubu "${groups.join(", ")}" olarak güncellendi.`
    );

    const { error } = await supabase
      .from("coaches")
      .update({ assigned_groups: groups })
      .eq("id", coach.id);
    if (error) {
      setOptimisticGroups((prev) => {
        const copy = { ...prev };
        delete copy[coach.id];
        return copy;
      });
      onFeedback("Grup güncellenemedi: " + error.message);
      return;
    }
    await onLogActivity(
      "Antrenör / Temsilci Grubu",
      `${coach.full_name} grubu "${groups.join(", ")}" yapıldı.`
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

  // Optimistic silme + rollback
  async function deleteCoach(coach: Coach) {
    if (
      !(await onay(
        `${coach.full_name} adlı kişiyi silmek istediğinize emin misiniz?`,
        { baslik: "Kaydı Sil", olumluMetin: "Evet, Sil", tehlikeli: true }
      ))
    )
      return;

    setDeletedIds((prev) => [...prev, coach.id]);
    onFeedback(`${coach.full_name} silindi.`);

    const { error } = await supabase.from("coaches").delete().eq("id", coach.id);
    if (error) {
      setDeletedIds((prev) => prev.filter((id) => id !== coach.id));
      onFeedback("Silme hatası, geri alındı: " + error.message);
      return;
    }

    await onLogActivity("Antrenör Silme", `${coach.full_name} silindi.`);
    await onRefreshCoaches();
    setDeletedIds((prev) => prev.filter((id) => id !== coach.id));
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <form onSubmit={addCoach} className="k-artik p-5 sm:p-6 space-y-4">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">TEKNİK EKİP KAYDI</span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Yeni Antrenör / Temsilci Ekle (Önyüklü: Tüm Takım)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            placeholder="Ad Soyad"
            value={newCoach.full_name}
            onChange={(e) =>
              setNewCoach({ ...newCoach, full_name: e.target.value })
            }
            className="k-alan font-bold"
          />
          <input
            placeholder="Kod (Boşsa ANT-XXXX)"
            value={newCoach.coach_code}
            onChange={(e) =>
              setNewCoach({ ...newCoach, coach_code: e.target.value })
            }
            className="k-alan uppercase font-mono font-bold"
          />
          <input
            placeholder="Giriş Şifresi (PIN)"
            value={newCoach.pin}
            onChange={(e) => setNewCoach({ ...newCoach, pin: e.target.value })}
            className="k-alan font-bold"
          />
          <input
            placeholder="Telefon"
            value={newCoach.phone}
            onChange={(e) => setNewCoach({ ...newCoach, phone: e.target.value })}
            className="k-alan font-bold"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Tümü", ...AGE_GROUPS].map((g) => {
            const active = newCoach.assigned_groups.includes(g);
            return (
              <motion.button
                whileTap={{ scale: 0.96 }}
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                  active
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-2xs"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </motion.button>
            );
          })}
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="k-buton k-buton--lacivert !px-6 !py-2.5"
        >
          Kaydet
        </motion.button>
      </form>

      <div className="k-artik p-5 sm:p-6 divide-y divide-[var(--border-subtle)]">
        <AnimatePresence initial={false}>
          {visibleCoaches.map((c) => {
            const activeArr =
              optimisticGroups[c.id] || c.assigned_groups || [];
            const currentGroup =
              Array.isArray(activeArr) && activeArr.length > 0
                ? activeArr[0]
                : "Tümü";
            return (
              <motion.div
                layout
                key={c.id}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING.yumusak}
                className="flex flex-wrap justify-between items-center gap-3 py-3 first:pt-0 last:pb-0 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[var(--text-primary)]">
                    {c.full_name}
                  </strong>
                  <span className="k-etiket k-etiket--lacivert font-mono">
                    Kod: {c.coach_code}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">
                    PIN: {c.pin}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={currentGroup}
                    onChange={(e) => updateCoachGroups(c, e.target.value)}
                    className="k-alan !w-auto !py-1.5 text-xs font-bold"
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
                    className="px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition"
                  >
                    Sil
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}