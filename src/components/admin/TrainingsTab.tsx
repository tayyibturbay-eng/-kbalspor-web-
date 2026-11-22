"use client";

import { useEffect, useMemo, useState } from "react";
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

const supabase = createClient();

const MIMAR_SINAN_SAHASI = "Mimar Sinan Amatör Futbol Sahası (Mimar Sinan Mah., Merkez / Çorum)";
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
    location: NAZMI_AVLUCA,
    coach_id: defaultCoachId,
    extra_player_ids: [] as string[],
    notes: "",
  });

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

  const { activeOrUpcomingTrainings, pastDatedTrainings } = useMemo(() => {
    const past: Training[] = [];
    const current: Training[] = [];
    for (const tr of trainings) {
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
  }, [trainings, todayStr]);

  async function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    if (
      trainingForm.age_groups.length === 0 &&
      trainingForm.extra_player_ids.length === 0
    ) {
      onFeedback("En az 1 yaş grubu veya bireysel oyuncu seçmelisiniz.");
      return;
    }

    const isEdit = Boolean(trainingForm.id);
    const oldTraining = isEdit
      ? trainings.find((t) => t.id === trainingForm.id)
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
    const selectedCoachObj = coaches.find((c) => c.id === trainingForm.coach_id);
    const assignedCoachId = selectedCoachObj ? selectedCoachObj.id : null;
    const assignedCoachName = selectedCoachObj ? selectedCoachObj.full_name : null;
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
        ? "⚠️ ANTRENMAN SAAT / GÜN DEĞİŞİKLİĞİ"
        : "📢 ANTRENMAN GÜNCELLEMESİ"
      : trainingForm.training_type === "ekstra"
      ? "⚡ EKSTRA ANTRENMAN DUYURUSU"
      : "⚽ DÜZENLİ ANTRENMAN PROGRAMI";

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

    const trCombined = `${header} (${groupLabel})\n${fullMsg}`; await supabase.from("club_messages").insert({ body: trCombined, message_text: trCombined, age_group: groupLabel, sender_name: authorName, created_at: new Date().toISOString() });

    const selectedGroupsOnly = trainingForm.age_groups.filter(
      (g) => g && g !== "Tümü"
    );
    const pushRes =
      selectedGroupsOnly.length > 0
        ? await sendPushViaApi(
            selectedGroupsOnly,
            "⚽ Antrenman Programı Güncellendi",
            `${groupLabel} • ${whenText}`
          )
        : { sentCount: 0, error: undefined };

    setLastWaBroadcast({ message: fullMsg, targetPlayers });
    onFeedback(
      `✅ Antrenman kaydedildi ve yalnızca seçili gruba (${groupLabel}) bildirim gönderildi (${pushRes.sentCount} telefon).`
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
      location: NAZMI_AVLUCA,
      coach_id: defaultCoachId,
      extra_player_ids: [],
      notes: "",
    });
    await onRefreshTrainings();
  }

  function startEditTraining(tr: Training) {
    setTrainingForm({
      id: tr.id,
      title: tr.title,
      training_type: tr.training_type,
      age_groups: tr.age_groups || [],
      selected_days: tr.day_of_week ? [tr.day_of_week] : ["Çarşamba"],
      training_date: tr.training_date || "",
      start_time: tr.start_time,
      end_time: tr.end_time || "",
      location: tr.location || NAZMI_AVLUCA,
      coach_id: tr.coach_id || "",
      extra_player_ids: tr.extra_player_ids || [],
      notes: tr.notes || "",
    });
}

  async function deleteTraining(tr: Training) {
    if (!confirm(`"${tr.title}" antrenmanını silmek istediğinize emin misiniz?`))
      return;
    await supabase.from("trainings").delete().eq("id", tr.id);
    await onLogActivity("Antrenman Silme", `${tr.title} silindi.`);
    await onRefreshTrainings();
  }

  return (
    <div className="space-y-6 text-slate-900">
      <form
        onSubmit={saveTraining}
        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-[#02274c]">
            {trainingForm.id
              ? "Antrenman Düzenle"
              : "Toplu / Ekstra Antrenman Ekle"}
          </h2>
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
                  location: NAZMI_AVLUCA,
                  coach_id: defaultCoachId,
                  extra_player_ids: [],
                  notes: "",
                })
              }
              className="text-xs text-slate-500 underline cursor-pointer"
            >
              Düzenlemeyi İptal Et
            </button>
          )}
        </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#02274c]">
              Hazır Tesis / Saha Seçimi (Varsayılan: Nazmi Avluca Spor Tesisi)
            </span>
            <div className="flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map((fac) => {
                const active = trainingForm.location === fac.location;
                return (
                  <button
                    key={fac.label}
                    type="button"
                    onClick={() =>
                      setTrainingForm({
                        ...trainingForm,
                        location: fac.location,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition ${
                      active
                        ? "bg-[#02274c] text-white border-[#02274c]"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {fac.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] font-semibold text-slate-600">
            Adres Bilgisi:{" "}
            {trainingForm.location.toLowerCase().includes("mimar sinan")
              ? "Mimar Sinan Amatör Futbol Sahası — Mimar Sinan Mah., Merkez / Çorum"
              : "Nazmi Avluca Spor Tesisi — Ulukavak Mah., Çiftlik Çayırı 2. Cad., Merkez / Çorum"}
          </p>
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
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
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
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={trainingForm.coach_id}
            onChange={(e) =>
              setTrainingForm({ ...trainingForm, coach_id: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm font-bold text-[#02274c]"
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
          <input
            placeholder="Konum / Saha Adı"
            value={trainingForm.location}
            onChange={(e) =>
              setTrainingForm({ ...trainingForm, location: e.target.value })
            }
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span>📍 Konum Haritası:</span>
          <a
            href={buildMapsUrl(trainingForm.location)}
            target="_blank"
            rel="noreferrer"
            className="text-[#02274c] font-bold underline"
          >
            Google Maps&apos;te Aç
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((g) => {
            const checked = trainingForm.age_groups.includes(g);
            return (
              <button
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  checked
                    ? "bg-[#02274c] text-white border-[#02274c]"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {checked ? "✓ " : ""}
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {trainingForm.training_type === "duzenli" ? (
            <div className="md:col-span-2 flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const checked = trainingForm.selected_days.includes(d);
                return (
                  <button
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
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      checked
                        ? "bg-[#a60513] text-white border-[#a60513]"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {d}
                  </button>
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
              className="md:col-span-2 border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
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
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={trainingForm.end_time}
              onChange={(e) =>
                setTrainingForm({ ...trainingForm, end_time: e.target.value })
              }
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-[#02274c] block mb-1.5">
            Grup Dışından Bireysel Oyuncu Ekle (Seçili:{" "}
            {trainingForm.extra_player_ids.length})
          </label>
          <input
            placeholder="Oyuncu ismi ara..."
            value={extraPlayerSearch}
            onChange={(e) => setExtraPlayerSearch(e.target.value)}
            className="w-full md:w-72 border border-slate-300 rounded-lg px-3 py-1.5 text-xs mb-2 bg-white text-slate-900"
          />
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
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
                    className={`px-2.5 py-1 rounded-full text-xs border cursor-pointer ${
                      selected
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {p.full_name} ({p.age_group})
                  </button>
                );
              })}
          </div>
        </div>

        <button
          type="submit"
          className="bg-[#02274c] hover:bg-[#033669] text-white font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          Antrenmanı Kaydet &amp; Seçili Gruba Bildir
        </button>
      </form>

      {lastWaBroadcast && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              lastWaBroadcast.message
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            📲 WhatsApp Grubunda Paylaş
          </a>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-extrabold text-[#02274c] text-base">
          Aktif &amp; Yaklaşan Antrenmanlar ({activeOrUpcomingTrainings.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeOrUpcomingTrainings.map((tr) => (
            <div
              key={tr.id}
              className="border border-slate-200 rounded-xl p-4 space-y-1.5"
            >
              <div className="flex justify-between gap-2">
                <h4 className="font-bold text-[#02274c]">{tr.title}</h4>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditTraining(tr)}
                    className="bg-[#02274c] text-white text-xs px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTraining(tr)}
                    className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-600">
                {(tr.age_groups || []).join(", ")} •{" "}
                {tr.day_of_week || tr.training_date} {tr.start_time}
              </div>
              {tr.location && (
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span>📍 {tr.location}</span>
                  <a
                    href={buildMapsUrl(tr.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#02274c] font-bold underline"
                  >
                    Harita
                  </a>
                </div>
              )}
              {tr.coach_name && (
                <div className="text-xs font-bold text-[#a60513]">
                  👨‍🏫 Antrenör: {tr.coach_name}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {pastDatedTrainings.length > 0 && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
          <h3 className="font-extrabold text-slate-700 text-sm">
            Geçmiş Tarihli Ekstra Antrenmanlar ({pastDatedTrainings.length})
          </h3>
          {pastDatedTrainings.slice(0, 10).map((tr) => (
            <div
              key={tr.id}
              className="border-b border-slate-200/70 pb-2 text-xs text-slate-600 flex justify-between items-center"
            >
              <span>
                <strong className="text-slate-800">{tr.title}</strong> (
                {(tr.age_groups || []).join(", ")})
              </span>
              <span className="font-mono">
                {tr.training_date} {tr.start_time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}