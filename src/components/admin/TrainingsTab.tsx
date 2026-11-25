"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_GROUPS,
  Coach,
  DAYS_OF_WEEK,
  NAZMI_AVLUCA,
  Player,
  Training,
  UserRole,
} from "@/types/club";
import { sendPushViaApi } from "@/lib/club-utils";
import { useOnay } from "@/components/ui/OnayDialog";
import { EASE, SPRING } from "@/lib/motion";

const supabase = createClient();

const MIMAR_SINAN_SAHASI =
  "Mimar Sinan Amatör Futbol Sahası (Mimar Sinan Mah., Merkez / Çorum)";

const FACILITY_OPTIONS = [
  {
    label: "Nazmi Avluca Spor Tesisi (Varsayılan)",
    location: NAZMI_AVLUCA,
    address: "Ulukavak Mah., Çiftlik Çayırı 2. Cad., Merkez / Çorum",
  },
  {
    label: "Mimar Sinan Amatör Futbol Sahası",
    location: MIMAR_SINAN_SAHASI,
    address: "Mimar Sinan Mah., Çorum Merkez",
  },
];

function buildMapsUrl(location?: string | null): string {
  const q = (location || NAZMI_AVLUCA || "Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

interface TrainingsTabProps {
  role: UserRole;
  adminName: string;
  activeCoach: Coach | null;
  players: Player[];
  coaches: Coach[];
  trainings: Training[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefreshTrainings: () => Promise<void>;
}

export function TrainingsTab({
  role,
  adminName,
  activeCoach,
  players,
  coaches,
  trainings,
  onFeedback,
  onLogActivity,
  onRefreshTrainings,
}: TrainingsTabProps) {
  const { onay } = useOnay();
  const azaltilmis = useReducedMotion();
  const defaultCoachId = role === "coach" && activeCoach ? activeCoach.id : "";

  const [trainingForm, setTrainingForm] = useState({
    id: "",
    title: "",
    training_type: "duzenli" as "duzenli" | "ekstra",
    age_groups: ["Minikler"] as string[],
    selected_days: ["Çarşamba"] as string[],
    training_date: "",
    start_time: "17:00",
    end_time: "18:30",
    location: FACILITY_OPTIONS[0].location,
    coach_id: defaultCoachId,
    extra_player_ids: [] as string[],
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [extraPlayerSearch, setExtraPlayerSearch] = useState("");
  const [lastWaBroadcast, setLastWaBroadcast] = useState<{
    message: string;
    targetPlayers: Player[];
  } | null>(null);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setTodayStr(new Date().toISOString().slice(0, 10));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const visibleTrainings = useMemo(
    () => trainings.filter((t) => !deletedIds.includes(t.id)),
    [trainings, deletedIds]
  );

  const { activeOrUpcomingTrainings, pastDatedTrainings } = useMemo(() => {
    const past: Training[] = [];
    const current: Training[] = [];
    for (const tr of visibleTrainings) {
      if (
        tr.training_type === "ekstra" &&
        tr.training_date &&
        todayStr &&
        tr.training_date < todayStr
      ) {
        past.push(tr);
      } else {
        current.push(tr);
      }
    }
    return { activeOrUpcomingTrainings: current, pastDatedTrainings: past };
  }, [visibleTrainings, todayStr]);

  async function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (
      trainingForm.age_groups.length === 0 &&
      trainingForm.extra_player_ids.length === 0
    ) {
      onFeedback("En az 1 yaş grubu veya bireysel oyuncu seçmelisiniz.");
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(trainingForm.id);
      const oldTraining = isEdit
        ? visibleTrainings.find((t) => t.id === trainingForm.id)
        : null;

      const daysToSave = isEdit
        ? [trainingForm.selected_days[0] || "Çarşamba"]
        : trainingForm.training_type === "ekstra"
        ? ["Ekstra"]
        : trainingForm.selected_days.length > 0
        ? trainingForm.selected_days
        : ["Çarşamba"];

      const authorName =
        role === "coach" && activeCoach
          ? `Antrenör ${activeCoach.full_name}`
          : adminName || "Yönetici";
      const selectedCoachObj = coaches.find(
        (c) => c.id === trainingForm.coach_id
      );
      const assignedCoachId = selectedCoachObj ? selectedCoachObj.id : null;
      const assignedCoachName = selectedCoachObj
        ? selectedCoachObj.full_name
        : null;
      const mapsLink = buildMapsUrl(trainingForm.location);

      const groupLabel =
        trainingForm.age_groups.length > 0
          ? trainingForm.age_groups.join(", ")
          : "Özel Grup";

      if (isEdit) {
        const { error } = await supabase
          .from("trainings")
          .update({
            title:
              trainingForm.title ||
              `${trainingForm.age_groups.join("-")} Antrenmanı`,
            training_type: trainingForm.training_type,
            age_groups: trainingForm.age_groups,
            day_of_week:
              trainingForm.training_type === "duzenli" ? daysToSave[0] : null,
            training_date: trainingForm.training_date || null,
            start_time: trainingForm.start_time,
            end_time: trainingForm.end_time || null,
            location: trainingForm.location,
            coach_id: assignedCoachId,
            coach_name: assignedCoachName,
            extra_player_ids: trainingForm.extra_player_ids,
            notes: trainingForm.notes || null,
          })
          .eq("id", trainingForm.id);

        if (error) {
          onFeedback("Antrenman güncellenemedi: " + error.message);
          return;
        }

        await onLogActivity(
          "Antrenman Güncelleme",
          `${groupLabel} — ${daysToSave[0]} ${trainingForm.start_time}${
            assignedCoachName ? ` (Antrenör: ${assignedCoachName})` : ""
          }`
        );
      } else {
        const rows = daysToSave.map((day) => ({
          title:
            trainingForm.title.trim() ||
            `${trainingForm.age_groups.join("-")} ${
              trainingForm.training_type === "ekstra" ? "Ekstra" : day
            } Antrenmanı`,
          training_type: trainingForm.training_type,
          age_groups: trainingForm.age_groups,
          day_of_week: trainingForm.training_type === "duzenli" ? day : null,
          training_date: trainingForm.training_date || null,
          start_time: trainingForm.start_time,
          end_time: trainingForm.end_time || null,
          location: trainingForm.location,
          coach_id: assignedCoachId,
          coach_name: assignedCoachName,
          extra_player_ids: trainingForm.extra_player_ids,
          notes: trainingForm.notes || null,
          created_by: authorName,
        }));

        const { error } = await supabase.from("trainings").insert(rows);
        if (error) {
          onFeedback("Antrenman eklenemedi: " + error.message);
          return;
        }

        await onLogActivity(
          "Antrenman Ekleme",
          `${groupLabel} — ${daysToSave.join(", ")} ${trainingForm.start_time}${
            assignedCoachName ? ` (Antrenör: ${assignedCoachName})` : ""
          }`
        );
      }

      const targetPlayers = players.filter(
        (p) =>
          trainingForm.age_groups.includes(p.age_group) ||
          trainingForm.extra_player_ids.includes(p.id)
      );
      const extraNames = players
        .filter(
          (p) =>
            trainingForm.extra_player_ids.includes(p.id) &&
            !trainingForm.age_groups.includes(p.age_group)
        )
        .map((p) => p.full_name);

      const timeChanged =
        oldTraining &&
        (oldTraining.start_time !== trainingForm.start_time ||
          oldTraining.day_of_week !== daysToSave[0] ||
          oldTraining.training_date !== (trainingForm.training_date || null));

      const header = isEdit
        ? timeChanged
          ? "ANTRENMAN SAAT / GÜN DEĞİŞİKLİĞİ"
          : "ANTRENMAN GÜNCELLEMESİ"
        : trainingForm.training_type === "ekstra"
        ? "EKSTRA ANTRENMAN DUYURUSU"
        : "DÜZENLİ ANTRENMAN PROGRAMI";

      const whenText =
        trainingForm.training_type === "ekstra" && trainingForm.training_date
          ? `${trainingForm.training_date} Saat ${trainingForm.start_time}`
          : `${daysToSave.join(", ")} Saat ${trainingForm.start_time}${
              trainingForm.end_time ? `-${trainingForm.end_time}` : ""
            }`;

      const fullMsg = `${header}\nGruplar: ${
        trainingForm.age_groups.join(", ") || "-"
      }${assignedCoachName ? `\nAntrenör: ${assignedCoachName}` : ""}${
        extraNames.length > 0
          ? `\nÖzel Çağrılan Oyuncular: ${extraNames.join(", ")}`
          : ""
      }\nZaman: ${whenText}\nYer: ${trainingForm.location}\nHarita: ${mapsLink}${
        trainingForm.notes ? `\nNot: ${trainingForm.notes}` : ""
      }`;

      const trCombined = `${header} (${groupLabel})\n${fullMsg}`;
      await supabase.from("club_messages").insert({
        body: trCombined,
        message_text: trCombined,
        age_group: groupLabel,
        sender_name: authorName,
        created_at: new Date().toISOString(),
      });

      const selectedGroupsOnly = trainingForm.age_groups.filter(
        (g) => g && g !== "Tümü"
      );
      const pushRes =
        selectedGroupsOnly.length > 0
          ? await sendPushViaApi(
              selectedGroupsOnly,
              "Antrenman Programı Güncellendi",
              `${groupLabel} • ${whenText}`
            )
          : { sentCount: 0, error: undefined };

      setLastWaBroadcast({ message: fullMsg, targetPlayers });
      onFeedback(
        `Antrenman kaydedildi ve yalnızca seçili gruba (${groupLabel}) bildirim gönderildi (${pushRes.sentCount} telefon).`
      );
      setTrainingForm({
        id: "",
        title: "",
        training_type: "duzenli",
        age_groups: ["Minikler"],
        selected_days: ["Çarşamba"],
        training_date: "",
        start_time: "17:00",
        end_time: "18:30",
        location: FACILITY_OPTIONS[0].location,
        coach_id: defaultCoachId,
        extra_player_ids: [],
        notes: "",
      });
      await onRefreshTrainings();
    } finally {
      setSaving(false);
    }
  }

  function startEditTraining(tr: Training) {
    const matchedFacility = FACILITY_OPTIONS.find(
      (f) => f.location === tr.location || f.label === tr.location
    );
    setTrainingForm({
      id: tr.id,
      title: tr.title,
      training_type: tr.training_type,
      age_groups: tr.age_groups || [],
      selected_days: tr.day_of_week ? [tr.day_of_week] : ["Çarşamba"],
      training_date: tr.training_date || "",
      start_time: tr.start_time,
      end_time: tr.end_time || "",
      location: matchedFacility ? matchedFacility.location : tr.location || FACILITY_OPTIONS[0].location,
      coach_id: tr.coach_id || "",
      extra_player_ids: tr.extra_player_ids || [],
      notes: tr.notes || "",
    });
  }

  async function deleteTraining(tr: Training) {
    if (
      !(await onay(
        `"${tr.title}" antrenmanını silmek istediğinize emin misiniz?`,
        { baslik: "Antrenmanı Sil", olumluMetin: "Evet, Sil" }
      ))
    )
      return;

    setDeletedIds((prev) => [...prev, tr.id]);
    onFeedback(`"${tr.title}" antrenmanı silindi.`);

    const { error } = await supabase.from("trainings").delete().eq("id", tr.id);
    if (error) {
      setDeletedIds((prev) => prev.filter((id) => id !== tr.id));
      onFeedback("Antrenman silinemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity("Antrenman Silme", `${tr.title} silindi.`);
    await onRefreshTrainings();
    setDeletedIds((prev) => prev.filter((id) => id !== tr.id));
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <form
        onSubmit={saveTraining}
        className="k-artik p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">İDMAN PLANLAMA</span>
            <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
              {trainingForm.id
                ? "Antrenman Düzenle"
                : "Toplu / Ekstra Antrenman Ekle"}
            </h2>
          </div>
          {trainingForm.id && (
            <button
              type="button"
              onClick={() =>
                setTrainingForm({
                  id: "",
                  title: "",
                  training_type: "duzenli",
                  age_groups: ["Minikler"],
                  selected_days: ["Çarşamba"],
                  training_date: "",
                  start_time: "17:00",
                  end_time: "18:30",
                  location: FACILITY_OPTIONS[0].location,
                  coach_id: defaultCoachId,
                  extra_player_ids: [],
                  notes: "",
                })
              }
              className="k-buton k-buton--hayalet !py-1.5 !px-3 !text-xs"
            >
              Düzenlemeyi İptal Et
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={trainingForm.training_type}
            onChange={(e) =>
              setTrainingForm({
                ...trainingForm,
                training_type: e.target.value as "duzenli" | "ekstra",
              })
            }
            className="k-alan font-bold"
          >
            <option value="duzenli">Düzenli Haftalık Antrenman</option>
            <option value="ekstra">Ekstra Antrenman / Özel Çalışma</option>
          </select>
          <input
            placeholder="Başlık (Örn: Minikler Taktik İdman)"
            value={trainingForm.title}
            onChange={(e) =>
              setTrainingForm({ ...trainingForm, title: e.target.value })
            }
            className="k-alan font-semibold"
          />
          <select
            value={trainingForm.coach_id}
            onChange={(e) =>
              setTrainingForm({ ...trainingForm, coach_id: e.target.value })
            }
            className="k-alan font-bold"
          >
            <option value="">-- Çalıştıracak Antrenörü Seç --</option>
            {coaches
              .filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Antrenör: {c.full_name}
                </option>
              ))}
          </select>
          <select
            value={trainingForm.location}
            onChange={(e) =>
              setTrainingForm({
                ...trainingForm,
                location: e.target.value,
              })
            }
            aria-label="Antrenman Adresini Seçin"
            className="k-alan font-bold"
          >
            {FACILITY_OPTIONS.map((fac) => (
              <option key={fac.label} value={fac.location}>
                Adres: {fac.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <span>Konum Haritası:</span>
          <a
            href={buildMapsUrl(trainingForm.location)}
            target="_blank"
            rel="noreferrer"
            className="k-altcizgi text-[var(--brand-ink)] font-extrabold"
          >
            Google Maps&apos;te Aç →
          </a>
        </div>

        <div className="space-y-1.5">
          <span className="k-koz text-[10px] block">HEDEF YAŞ GRUPLARI</span>
          <div className="flex flex-wrap gap-1.5">
            {AGE_GROUPS.map((g) => {
              const checked = trainingForm.age_groups.includes(g);
              return (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  key={g}
                  onClick={() =>
                    setTrainingForm({
                      ...trainingForm,
                      age_groups: checked
                        ? trainingForm.age_groups.filter((x) => x !== g)
                        : [...trainingForm.age_groups, g],
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                    checked
                      ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-2xs"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {trainingForm.training_type === "duzenli" ? (
            <div className="md:col-span-2 flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const checked = trainingForm.selected_days.includes(d);
                return (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    key={d}
                    onClick={() =>
                      setTrainingForm({
                        ...trainingForm,
                        selected_days: trainingForm.id
                          ? [d]
                          : checked
                          ? trainingForm.selected_days.filter((x) => x !== d)
                          : [...trainingForm.selected_days, d],
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                      checked
                        ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)] shadow-2xs"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {d}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <input
              type="date"
              required
              value={trainingForm.training_date}
              onChange={(e) =>
                setTrainingForm({
                  ...trainingForm,
                  training_date: e.target.value,
                })
              }
              className="md:col-span-2 k-alan font-bold"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              required
              value={trainingForm.start_time}
              onChange={(e) =>
                setTrainingForm({ ...trainingForm, start_time: e.target.value })
              }
              className="k-alan font-bold text-center"
            />
            <input
              type="time"
              value={trainingForm.end_time}
              onChange={(e) =>
                setTrainingForm({ ...trainingForm, end_time: e.target.value })
              }
              className="k-alan font-bold text-center"
            />
          </div>
        </div>

        <div className="bg-[var(--bg-subtle)] p-4 rounded-2xl border border-[var(--border-subtle)] space-y-2.5">
          <label className="k-koz text-[10px] block">
            Grup Dışından Bireysel Oyuncu Ekle (Seçili:{" "}
            {trainingForm.extra_player_ids.length})
          </label>
          <input
            placeholder="Oyuncu ismi ara..."
            value={extraPlayerSearch}
            onChange={(e) => setExtraPlayerSearch(e.target.value)}
            className="k-alan w-full md:w-72 !py-1.5 text-xs"
          />
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
            {players
              .filter((p) =>
                p.full_name
                  .toLowerCase()
                  .includes(extraPlayerSearch.toLowerCase())
              )
              .slice(0, 30)
              .map((p) => {
                const selected = trainingForm.extra_player_ids.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setTrainingForm({
                        ...trainingForm,
                        extra_player_ids: selected
                          ? trainingForm.extra_player_ids.filter(
                              (id) => id !== p.id
                            )
                          : [...trainingForm.extra_player_ids, p.id],
                      })
                    }
                    className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition ${
                      selected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand-navy)]"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {p.full_name} ({p.age_group})
                  </button>
                );
              })}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={saving}
          className="k-buton k-buton--lacivert !px-6 !py-3"
        >
          {saving
            ? "Kaydediliyor..."
            : "Antrenmanı Kaydet & Seçili Gruba Bildir"}
        </motion.button>
      </form>

      <AnimatePresence>
        {lastWaBroadcast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE.yumusak }}
            className="k-artik bg-[var(--status-success-bg)]/60 border-[var(--status-success-text)]/30 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-xs font-extrabold text-[var(--status-success-text)]">
              Program duyurusu hazır — WhatsApp grubunda hemen paylaşabilirsiniz.
            </span>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                lastWaBroadcast.message
              )}`}
              target="_blank"
              rel="noreferrer"
              className="k-buton !bg-emerald-600 hover:!bg-emerald-700 !text-white !py-2 !px-4 !text-xs"
            >
              WhatsApp Grubunda Paylaş
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="k-artik p-5 sm:p-6 space-y-4">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">HAFTALIK PROGRAM</span>
          <h3 className="k-posta text-lg text-[var(--text-primary)]">
            Aktif &amp; Yaklaşan Antrenmanlar ({activeOrUpcomingTrainings.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <AnimatePresence initial={false}>
            {activeOrUpcomingTrainings.map((tr) => (
              <motion.div
                layout
                key={tr.id}
                initial={azaltilmis ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING.yumusak}
                className="k-kart border border-[var(--border-subtle)] bg-[var(--bg-subtle)] rounded-2xl p-4 space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-extrabold text-sm text-[var(--text-primary)]">
                    {tr.title}
                  </h4>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditTraining(tr)}
                      className="k-buton k-buton--lacivert !py-1 !px-2.5 !text-xs"
                    >
                      Değiştir
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTraining(tr)}
                      className="px-2.5 py-1 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer hover:opacity-85 transition"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                <div className="text-xs font-semibold text-[var(--text-secondary)]">
                  {(tr.age_groups || []).join(", ")} •{" "}
                  {tr.day_of_week || tr.training_date} {tr.start_time}
                </div>
                {tr.location && (
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="truncate">Saha: {tr.location}</span>
                    <a
                      href={buildMapsUrl(tr.location)}
                      target="_blank"
                      rel="noreferrer"
                      className="k-altcizgi text-[var(--brand-ink)] font-extrabold shrink-0"
                    >
                      Harita
                    </a>
                  </div>
                )}
                {tr.coach_name && (
                  <div>
                    <span className="k-etiket k-etiket--tehlike">
                      Antrenör: {tr.coach_name}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {pastDatedTrainings.length > 0 && (
        <div className="k-artik bg-[var(--bg-subtle)] p-5 space-y-2.5">
          <h3 className="k-koz text-[10px]">
            Geçmiş Tarihli Ekstra Antrenmanlar ({pastDatedTrainings.length})
          </h3>
          {pastDatedTrainings.slice(0, 10).map((tr) => (
            <div
              key={tr.id}
              className="border-b border-[var(--border-subtle)] last:border-b-0 pb-2 last:pb-0 text-xs text-[var(--text-secondary)] flex justify-between items-center"
            >
              <span>
                <strong className="text-[var(--text-primary)]">
                  {tr.title}
                </strong>{" "}
                ({(tr.age_groups || []).join(", ")})
              </span>
              <span className="font-mono font-bold">
                {tr.training_date} {tr.start_time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}