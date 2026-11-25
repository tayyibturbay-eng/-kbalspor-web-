"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, POSITIONS, Player, UserRole } from "@/types/club";
import { useOnay } from "@/components/ui/OnayDialog";
import { EASE, SPRING } from "@/lib/motion";
import {
  calcAgeGroupFromBirthDate,
  defaultPinFromPhone,
  getDuplicatePlayerKeys,
  getPlayerWarnings,
} from "@/lib/club-utils";

const supabase = createClient();

type ExtendedPlayer = Player & {
  skill_points?: number | null;
  secondary_age_group?: string | null;
  representative_group?: string | null;
};

interface PlayersTabProps {
  role: UserRole;
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefreshPlayers: () => Promise<void>;
}

export function PlayersTab({
  role,
  players,
  setPlayers,
  onFeedback,
  onLogActivity,
  onRefreshPlayers,
}: PlayersTabProps) {
  const { onay } = useOnay();
  const azaltilmis = useReducedMotion();

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("Tümü");
  const [pointStep, setPointStep] = useState<number>(5);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newPlayer, setNewPlayer] = useState({
    full_name: "",
    birth_date: "",
    secondary_age_group: "",
    position: "Orta Saha",
    jersey_number: "",
    parent_phone: "",
    player_code: "",
    player_pin: "",
    license_no: "",
  });

  const [editingPlayer, setEditingPlayer] = useState<ExtendedPlayer | null>(
    null
  );
  const [editPointSign, setEditPointSign] = useState<"+" | "-" | null>(null);
  const [editPointAmount, setEditPointAmount] = useState<string>("5");

  const canManageCategories = role === "admin" || role === "coach";
  const tableColSpan =
    role === "admin" ? 7 : canManageCategories ? 6 : 5;

  const duplicateKeys = useMemo(
    () => getDuplicatePlayerKeys(players),
    [players]
  );

  const flaggedPlayersCount = useMemo(
    () =>
      players.filter((p) => getPlayerWarnings(p, duplicateKeys).length > 0)
        .length,
    [players, duplicateKeys]
  );

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.toLowerCase();
    return players.filter((rawP) => {
      const p = rawP as ExtendedPlayer;
      const groupMatch =
        selectedGroupFilter === "Tümü" ||
        p.age_group === selectedGroupFilter ||
        p.secondary_age_group === selectedGroupFilter;
      const searchMatch =
        p.full_name.toLowerCase().includes(q) ||
        (p.player_code || "").toLowerCase().includes(q) ||
        (p.license_no || "").toLowerCase().includes(q) ||
        p.age_group.toLowerCase().includes(q) ||
        (p.secondary_age_group || "").toLowerCase().includes(q);
      return groupMatch && searchMatch;
    });
  }, [players, selectedGroupFilter, playerSearch]);

  const groupedPlayers = useMemo(
    () =>
      AGE_GROUPS.map((g) => ({
        group: g,
        items: filteredPlayers.filter((rawP) => {
          const p = rawP as ExtendedPlayer;
          return p.age_group === g || p.secondary_age_group === g;
        }),
      })).filter((x) => x.items.length > 0),
    [filteredPlayers]
  );

  function openPlayerEditor(p: ExtendedPlayer) {
    if (editingPlayer?.id === p.id) {
      setEditingPlayer(null);
      return;
    }
    setEditingPlayer({ ...p });
    setEditPointSign(null);
    setEditPointAmount("5");
  }

  async function adjustPlayerPoints(p: ExtendedPlayer, delta: number) {
    const snapshot = players;
    const currentPts = p.skill_points ?? 20;
    const nextPts = Math.max(0, currentPts + delta);
    const label = delta >= 0 ? `+${delta}` : `${delta}`;

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? ({ ...x, skill_points: nextPts } as ExtendedPlayer)
          : x
      )
    );
    onFeedback(
      `${p.full_name} puanı ${nextPts} olarak güncellendi (${label}).`
    );

    const { error } = await supabase
      .from("players")
      .update({ skill_points: nextPts })
      .eq("id", p.id);

    if (error) {
      setPlayers(snapshot);
      onFeedback("Puan güncellenemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Yetenek Puanı Güncelleme",
      `${p.full_name} oyuncusuna ${label} puan uygulandı (Yeni puan: ${nextPts}).`
    );
  }

  async function updatePlayerPosition(player: Player, newPosition: string) {
    const snapshot = players;
    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id ? { ...x, position: newPosition } : x
      )
    );
    onFeedback(
      `${player.full_name} mevkisi "${newPosition}" olarak güncellendi.`
    );

    const { error } = await supabase
      .from("players")
      .update({ position: newPosition })
      .eq("id", player.id);

    if (error) {
      setPlayers(snapshot);
      onFeedback("Mevki güncellenemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Mevki Güncelleme",
      `${player.full_name} mevkisi "${newPosition}" yapıldı.`
    );
  }

  async function updatePlayerSecondaryGroup(
    player: ExtendedPlayer,
    secondGroup: string
  ) {
    const snapshot = players;
    const cleanSecond =
      secondGroup && secondGroup !== player.age_group ? secondGroup : null;

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id
          ? ({ ...x, secondary_age_group: cleanSecond } as ExtendedPlayer)
          : x
      )
    );
    onFeedback(
      `${player.full_name} ikinci kategorisi güncellendi (${
        cleanSecond || "Yok"
      }).`
    );

    const { error } = await supabase
      .from("players")
      .update({ secondary_age_group: cleanSecond })
      .eq("id", player.id);

    if (error) {
      setPlayers(snapshot);
      onFeedback("İkinci kategori güncellenemedi: " + error.message);
      return;
    }

    await onLogActivity(
      "İkinci Kategori Güncelleme",
      `${player.full_name} için ikinci kategori: ${cleanSecond || "Yok"}`
    );
  }

  async function updateRepresentativeGroup(
    player: ExtendedPlayer,
    repGroup: string
  ) {
    const snapshot = players;
    const nextRepGroup = repGroup || "Tümü";

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id
          ? ({ ...x, representative_group: nextRepGroup } as ExtendedPlayer)
          : x
      )
    );
    onFeedback(`${player.full_name} temsilci grubu: ${nextRepGroup}`);

    const { error } = await supabase
      .from("players")
      .update({ representative_group: nextRepGroup })
      .eq("id", player.id);

    if (error) {
      setPlayers(snapshot);
      onFeedback("Temsilci grubu güncellenemedi: " + error.message);
      return;
    }

    await onLogActivity(
      "Temsilci Grubu Güncelleme",
      `${player.full_name} temsilcilik kapsamı: ${nextRepGroup}`
    );
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (addingPlayer) return;

    const ageGroup = calcAgeGroupFromBirthDate(newPlayer.birth_date);
    const secondGroup =
      newPlayer.secondary_age_group &&
      newPlayer.secondary_age_group !== ageGroup
        ? newPlayer.secondary_age_group
        : null;
    const autoCode =
      newPlayer.player_code.trim().toUpperCase() ||
      `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoPin =
      newPlayer.player_pin.trim() || defaultPinFromPhone(newPlayer.parent_phone);
    const cleanLicense = newPlayer.license_no.trim() || null;
    const cleanName = newPlayer.full_name.trim();
    const jerseyNum = newPlayer.jersey_number
      ? Number(newPlayer.jersey_number)
      : null;

    const snapshot = players;
    const tempId = `temp-${Date.now()}`;
    const optimisticRow = {
      id: tempId,
      full_name: cleanName,
      birth_date: newPlayer.birth_date || null,
      age_group: ageGroup,
      secondary_age_group: secondGroup,
      representative_group: "Tümü",
      position: newPlayer.position,
      jersey_number: jerseyNum,
      parent_phone: newPlayer.parent_phone.trim() || null,
      player_code: autoCode,
      player_pin: autoPin,
      license_no: cleanLicense,
      skill_points: 20,
      stat_pac: 20,
      stat_sho: 20,
      stat_pas: 20,
      stat_dri: 20,
      stat_def: 20,
      stat_phy: 20,
      pin_changed: false,
    } as unknown as ExtendedPlayer;

    setAddingPlayer(true);
    setPlayers((prev) => [optimisticRow, ...prev]);
    setNewPlayer({
      full_name: "",
      birth_date: "",
      secondary_age_group: "",
      position: "Orta Saha",
      jersey_number: "",
      parent_phone: "",
      player_code: "",
      player_pin: "",
      license_no: "",
    });
    onFeedback(
      `${cleanName} (${ageGroup}) eklendi. ID: ${autoCode} | Şifre: ${autoPin} | 20 Puan`
    );

    const { error } = await supabase.from("players").insert({
      full_name: cleanName,
      birth_date: optimisticRow.birth_date,
      age_group: ageGroup,
      secondary_age_group: secondGroup,
      representative_group: "Tümü",
      position: optimisticRow.position,
      jersey_number: jerseyNum,
      parent_phone: optimisticRow.parent_phone,
      player_code: autoCode,
      player_pin: autoPin,
      license_no: cleanLicense,
      skill_points: 20,
      stat_pac: 20,
      stat_sho: 20,
      stat_pas: 20,
      stat_dri: 20,
      stat_def: 20,
      stat_phy: 20,
      pin_changed: false,
    });

    setAddingPlayer(false);

    if (error) {
      setPlayers(snapshot);
      onFeedback("Oyuncu eklenemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Oyuncu Ekleme",
      `${cleanName} (${ageGroup}${
        secondGroup ? ` + ${secondGroup}` : ""
      }) eklendi — ID: ${autoCode} | Ön yüklü 20 puan`
    );
    await onRefreshPlayers();
  }

  async function savePlayerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer || savingEdit) return;

    const snapshot = players;
    const updatedAgeGroup =
      editingPlayer.age_group ||
      (editingPlayer.birth_date
        ? calcAgeGroupFromBirthDate(editingPlayer.birth_date)
        : "U15");
    const cleanSecondGroup =
      editingPlayer.secondary_age_group &&
      editingPlayer.secondary_age_group !== updatedAgeGroup
        ? editingPlayer.secondary_age_group
        : null;
    const isRep = Boolean(editingPlayer.is_representative);
    const repGroup = isRep ? editingPlayer.representative_group || "Tümü" : "Tümü";
    const cleanLicense = editingPlayer.license_no?.trim() || null;

    const rawAmount = Math.max(
      1,
      Math.min(99, parseInt(editPointAmount, 10) || 0)
    );
    const signedDelta =
      editPointSign === "+"
        ? rawAmount
        : editPointSign === "-"
        ? -rawAmount
        : 0;
    const basePoints = Number(editingPlayer.skill_points ?? 20);
    const nextSkillPoints = Math.max(0, basePoints + signedDelta);

    const updatedRecord: ExtendedPlayer = {
      ...editingPlayer,
      full_name: editingPlayer.full_name.trim(),
      birth_date: editingPlayer.birth_date || null,
      age_group: updatedAgeGroup,
      secondary_age_group: cleanSecondGroup,
      representative_group: repGroup,
      position: editingPlayer.position,
      jersey_number: editingPlayer.jersey_number
        ? Number(editingPlayer.jersey_number)
        : null,
      parent_phone: editingPlayer.parent_phone?.trim() || null,
      player_code: editingPlayer.player_code?.trim().toUpperCase() || null,
      player_pin: editingPlayer.player_pin?.trim() || "1234",
      is_representative: isRep,
      license_no: cleanLicense,
      bound_device_id: editingPlayer.bound_device_id,
      skill_points: nextSkillPoints,
    };

    setSavingEdit(true);
    setPlayers((prev) =>
      prev.map((x) => (x.id === updatedRecord.id ? updatedRecord : x))
    );
    setEditingPlayer(null);

    const pointLogText =
      Boolean(editPointSign && rawAmount > 0)
        ? ` (${editPointSign}${rawAmount}p -> ${nextSkillPoints}p)`
        : "";
    onFeedback(
      Boolean(editPointSign && rawAmount > 0)
        ? `${updatedRecord.full_name} bilgileri güncellendi (${editPointSign}${rawAmount}p • Yeni Puan: ${nextSkillPoints}).`
        : `${updatedRecord.full_name} bilgileri güncellendi.`
    );

    const { error } = await supabase
      .from("players")
      .update({
        full_name: updatedRecord.full_name,
        birth_date: updatedRecord.birth_date,
        age_group: updatedAgeGroup,
        secondary_age_group: cleanSecondGroup,
        representative_group: repGroup,
        position: updatedRecord.position,
        jersey_number: updatedRecord.jersey_number,
        parent_phone: updatedRecord.parent_phone,
        player_code: updatedRecord.player_code,
        player_pin: updatedRecord.player_pin,
        is_representative: isRep,
        license_no: cleanLicense,
        bound_device_id: updatedRecord.bound_device_id,
        skill_points: nextSkillPoints,
      })
      .eq("id", updatedRecord.id);

    setSavingEdit(false);

    if (error) {
      setPlayers(snapshot);
      onFeedback("Güncelleme hatası, geri alındı: " + error.message);
      return;
    }

    await onLogActivity(
      "Oyuncu Düzenleme",
      `${updatedRecord.full_name} (${updatedAgeGroup}${
        cleanSecondGroup ? ` + ${cleanSecondGroup}` : ""
      }) güncellendi${pointLogText}.`
    );
    await onRefreshPlayers();
  }

  async function deletePlayer(id: string, name: string) {
    if (
      !(await onay(`${name} adlı oyuncuyu silmek istediğinize emin misiniz?`, {
        baslik: "Oyuncuyu Sil",
        olumluMetin: "Evet, Sil",
      }))
    )
      return;

    const snapshot = players;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    if (editingPlayer?.id === id) setEditingPlayer(null);
    onFeedback(`${name} kadrodan silindi.`);

    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      setPlayers(snapshot);
      onFeedback("Oyuncu silinemedi, geri alındı: " + error.message);
      return;
    }

    await onLogActivity("Oyuncu Silme", `${name} kadrodan silindi.`);
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums min-w-0">
      <AnimatePresence>
        {role === "admin" && flaggedPlayersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE.yumusak }}
            className="k-artik p-4 bg-[var(--status-warning-bg)]/55 border-amber-400/50 text-xs sm:text-sm font-medium flex items-center gap-3"
          >
            <span className="k-etiket k-etiket--uyari shrink-0">
              {flaggedPlayersCount} Uyarı
            </span>
            <span>
              <strong>Kontrol Edilmesi Gereken Sporcular:</strong> Doğum tarihi
              eksik, isim hatalı veya mükerrer kayıtlar aşağıda işaretlendi.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {role === "admin" && (
        <form onSubmit={addPlayer} className="k-artik p-4 sm:p-6 space-y-4 min-w-0">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">KADRO KAYDI</span>
            <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
              Yeni Oyuncu Ekle (Ön Yüklü 20 Puan)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <input
              required
              placeholder="Ad Soyad"
              value={newPlayer.full_name}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, full_name: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            />

            <input
              type="text"
              inputMode="numeric"
              required
              aria-label="Doğum Tarihi (gg.aa.yyy)"
              placeholder="gg.aa.yyy"
              value={
                newPlayer.birth_date
                  ? newPlayer.birth_date.split("-").reverse().join(".")
                  : ""
              }
              onFocus={(e) => {
                e.currentTarget.type = "date";
              }}
              onBlur={(e) => {
                if (!e.currentTarget.value) {
                  e.currentTarget.type = "text";
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  setNewPlayer({ ...newPlayer, birth_date: val });
                  return;
                }
                const digits = val.replace(/\D/g, "").slice(0, 8);
                let formatted = digits;
                if (digits.length > 4) {
                  formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
                } else if (digits.length > 2) {
                  formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
                }
                const parts = formatted.split(".");
                if (parts.length === 3 && parts[2].length === 4) {
                  const isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                  setNewPlayer({ ...newPlayer, birth_date: isoDate });
                } else if (!formatted) {
                  setNewPlayer({ ...newPlayer, birth_date: "" });
                }
              }}
              className="k-alan font-semibold min-h-[42px]"
            />

            <select
              value={newPlayer.secondary_age_group}
              onChange={(e) =>
                setNewPlayer({
                  ...newPlayer,
                  secondary_age_group: e.target.value,
                })
              }
              className="k-alan font-semibold min-h-[42px]"
            >
              <option value="">İkinci Kategori (Opsiyonel)</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  + {g} Bildirimi
                </option>
              ))}
            </select>
            <input
              placeholder="Veli Telefon (05xx...)"
              value={newPlayer.parent_phone}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, parent_phone: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            />
            <select
              value={newPlayer.position}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, position: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Forma No"
              value={newPlayer.jersey_number}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, jersey_number: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            />
            <input
              placeholder="Lisans No (Opsiyonel)"
              value={newPlayer.license_no}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, license_no: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            />
            <input
              placeholder="Özel ID (Boşsa IKB-XXXX)"
              value={newPlayer.player_code}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, player_code: e.target.value })
              }
              className="k-alan uppercase font-mono font-bold min-h-[42px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <input
              placeholder="Şifre (Boşsa Tel Son 4)"
              value={newPlayer.player_pin}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, player_pin: e.target.value })
              }
              className="k-alan font-semibold min-h-[42px]"
            />
            <div className="md:col-span-3 flex justify-end">
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={addingPlayer}
                className="k-buton k-buton--kirmizi w-full sm:w-auto min-h-[42px] !px-6 !py-2.5"
              >
                {addingPlayer ? "Ekleniyor..." : "+ Oyuncu Ekle"}
              </motion.button>
            </div>
          </div>
        </form>
      )}

      <div className="k-artik p-4 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {["Tümü", ...AGE_GROUPS].map((g) => {
              const active = selectedGroupFilter === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroupFilter(g)}
                  className={`relative min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    active
                      ? "text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {active && !azaltilmis && (
                    <motion.span
                      layoutId="players-grup-pil"
                      transition={SPRING.yumusak}
                      className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]"
                    />
                  )}
                  {active && azaltilmis && (
                    <span className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]" />
                  )}
                  <span className="relative z-10">
                    {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {role === "admin" && (
              <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 min-h-[38px]">
                <span className="k-koz text-[10px]">Puan Adımı:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={pointStep}
                  onChange={(e) =>
                    setPointStep(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 border border-[var(--border-strong)] bg-[var(--bg-surface)] rounded-lg px-2 py-0.5 text-xs font-black text-[var(--text-primary)] text-center"
                />
              </div>
            )}
            <input
              placeholder="İsim, ID veya lisans ara..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="k-alan flex-1 md:w-64 min-h-[38px] !py-2"
            />
          </div>
        </div>

        {groupedPlayers.map(({ group, items }) => (
          <div
            key={group}
            className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xs"
          >
            <div className="k-sahne text-white px-4 py-2.5 font-extrabold text-xs sm:text-sm flex justify-between items-center">
              <span className="k-posta text-base font-medium">
                {group} Kategorisi
              </span>
              <span className="px-2.5 py-0.5 rounded-full k-cam--marka text-[11px] font-black">
                {items.length} Oyuncu
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-subtle)] text-[var(--brand-ink)] text-[11px] uppercase tracking-wider font-extrabold border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="p-3">Ad Soyad</th>
                    <th className="p-3">Doğum Tarihi</th>
                    <th className="p-3">Kategoriler</th>
                    <th className="p-3">Mevki / Forma</th>
                    <th className="p-3">Puan</th>
                    {role === "admin" && <th className="p-3">ID / Şifre</th>}
                    {canManageCategories && <th className="p-3">İşlem</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {items.map((rawP) => {
                    const p = rawP as ExtendedPlayer;
                    const warnings =
                      role === "admin"
                        ? getPlayerWarnings(p, duplicateKeys)
                        : [];
                    const isEditingThisRow =
                      canManageCategories && editingPlayer?.id === p.id;

                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className={
                            warnings.length > 0
                              ? "bg-[var(--status-warning-bg)]/35 transition-colors"
                              : "bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]/70 transition-colors"
                          }
                        >
                          <td className="p-3 font-extrabold text-[var(--text-primary)]">
                            {p.full_name}
                            {p.is_representative && (
                              <span className="ml-2 k-etiket k-etiket--bilgi">
                                Temsilci ({p.representative_group || "Tüm Takım"})
                              </span>
                            )}
                            {warnings.map((w) => (
                              <span
                                key={w}
                                className="ml-1.5 k-etiket k-etiket--tehlike"
                              >
                                {w}
                              </span>
                            ))}
                          </td>
                          <td className="p-3 text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                            {p.birth_date
                              ? p.birth_date.split("-").reverse().join(".")
                              : "Eksik"}
                          </td>
                          <td className="p-3 text-xs space-y-1.5">
                            <div className="font-extrabold text-[var(--text-primary)]">
                              Ana: {p.age_group}
                            </div>
                            <select
                              value={p.secondary_age_group || ""}
                              onChange={(e) =>
                                updatePlayerSecondaryGroup(p, e.target.value)
                              }
                              aria-label={`${p.full_name} ikinci kategori`}
                              className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] min-h-[34px]"
                            >
                              <option value="">+ 2. Kategori Yok</option>
                              {AGE_GROUPS.filter((g) => g !== p.age_group).map(
                                (g) => (
                                  <option key={g} value={g}>
                                    + {g}
                                  </option>
                                )
                              )}
                            </select>
                            {p.is_representative && role === "admin" && (
                              <div>
                                <select
                                  value={p.representative_group || "Tümü"}
                                  onChange={(e) =>
                                    updateRepresentativeGroup(p, e.target.value)
                                  }
                                  className="border border-[var(--border-strong)] bg-[var(--status-info-bg)]/40 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] min-h-[34px]"
                                >
                                  <option value="Tümü">Temsil: Tüm Takım</option>
                                  {AGE_GROUPS.map((g) => (
                                    <option key={g} value={g}>
                                      Temsil: {g}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs text-[var(--text-primary)]">
                            <div className="flex items-center gap-2">
                              <select
                                value={p.position || "Orta Saha"}
                                onChange={(e) =>
                                  updatePlayerPosition(p, e.target.value)
                                }
                                className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] min-h-[34px]"
                              >
                                {POSITIONS.map((pos) => (
                                  <option key={pos} value={pos}>
                                    {pos}
                                  </option>
                                ))}
                              </select>
                              {p.jersey_number ? (
                                <span className="k-etiket k-etiket--lacivert shrink-0">
                                  #{p.jersey_number}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3 text-xs font-black text-[var(--brand-ink)] whitespace-nowrap">
                            {p.skill_points ?? 20}p
                          </td>
                          {role === "admin" && (
                            <td className="p-3 font-mono text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                              {p.player_code} / {p.player_pin || "1234"}
                            </td>
                          )}
                          {canManageCategories && (
                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-[140px]">
                                {role === "admin" && (
                                  <>
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      type="button"
                                      title={`+${pointStep} Puan`}
                                      onClick={() =>
                                        adjustPlayerPoints(p, pointStep)
                                      }
                                      className="w-9 h-9 rounded-full border-2 border-emerald-600/70 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-black cursor-pointer transition shrink-0"
                                    >
                                      +
                                    </motion.button>
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      type="button"
                                      title={`-${pointStep} Puan`}
                                      onClick={() =>
                                        adjustPlayerPoints(p, -pointStep)
                                      }
                                      className="w-9 h-9 rounded-full border-2 border-red-600/70 bg-red-500/10 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-300 flex items-center justify-center text-base font-black cursor-pointer transition shrink-0"
                                    >
                                      -
                                    </motion.button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openPlayerEditor(p)}
                                  className="k-buton k-buton--lacivert min-h-[36px] !py-1.5 !px-3 !text-xs shrink-0"
                                >
                                  {isEditingThisRow ? "Kapat" : "Düzenle"}
                                </button>
                                {role === "admin" && (
                                  <button
                                    type="button"
                                    onClick={() => deletePlayer(p.id, p.full_name)}
                                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition shrink-0"
                                  >
                                    Sil
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>

                        {isEditingThisRow && editingPlayer && (
                          <tr className="bg-[var(--bg-subtle)]">
                            <td colSpan={tableColSpan} className="p-4">
                              <motion.form
                                initial={azaltilmis ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={SPRING.yumusak}
                                onSubmit={savePlayerEdit}
                                className="k-artik p-5 border-2 border-[var(--brand-red)] space-y-4 text-[var(--text-primary)]"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="k-koz text-[10px] block">
                                      SPORCU KARTI DÜZENLEME
                                    </span>
                                    <h3 className="k-posta text-lg text-[var(--text-primary)]">
                                      {editingPlayer.full_name}
                                    </h3>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPlayer(null)}
                                    className="k-buton k-buton--hayalet !py-1.5 !px-3 !text-xs"
                                  >
                                    Vazgeç
                                  </button>
                                </div>

                                {role === "admin" && (
                                  <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                      <div className="text-xs font-black text-[var(--text-primary)]">
                                        Oyuncu Puan Düzenle (Mevcut:{" "}
                                        {editingPlayer.skill_points ?? 20}p)
                                      </div>
                                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                        + veya - işaretini seçin ve 1–99 arası
                                        puan girin (Varsayılan: +5)
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditPointSign((prev) =>
                                              prev === "+" ? null : "+"
                                            )
                                          }
                                          aria-label="Puan Ekle (+)"
                                          className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-black transition cursor-pointer ${
                                            editPointSign === "+"
                                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-400 scale-105"
                                              : "border-emerald-600/60 bg-[var(--bg-surface)] text-emerald-500 opacity-75 hover:opacity-100"
                                          }`}
                                        >
                                          +
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditPointSign((prev) =>
                                              prev === "-" ? null : "-"
                                            )
                                          }
                                          aria-label="Puan Düş (-)"
                                          className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-2xl font-black transition cursor-pointer ${
                                            editPointSign === "-"
                                              ? "border-red-500 bg-red-500/20 text-red-400 ring-2 ring-red-400 scale-105"
                                              : "border-red-600/60 bg-[var(--bg-surface)] text-red-500 opacity-75 hover:opacity-100"
                                          }`}
                                        >
                                          -
                                        </button>
                                      </div>

                                      <input
                                        type="number"
                                        min={1}
                                        max={99}
                                        disabled={editPointSign === null}
                                        value={editPointAmount}
                                        onChange={(e) => {
                                          const digits = e.target.value.replace(
                                            /[^0-9]/g,
                                            ""
                                          );
                                          if (!digits) {
                                            setEditPointAmount("");
                                            return;
                                          }
                                          const n = Math.min(
                                            99,
                                            parseInt(digits, 10)
                                          );
                                          setEditPointAmount(String(n));
                                        }}
                                        aria-label="Puan Miktarı"
                                        className="w-20 k-alan text-center font-black"
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Ad Soyad
                                    </label>
                                    <input
                                      required
                                      disabled={role !== "admin"}
                                      value={editingPlayer.full_name}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          full_name: e.target.value,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Doğum Tarihi (Kadro Yaş Kuralı)
                                    </label>
                                    <input
                                      type="date"
                                      disabled={role !== "admin"}
                                      value={editingPlayer.birth_date || ""}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          birth_date: e.target.value,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Ana Kategori
                                    </label>
                                    <select
                                      value={editingPlayer.age_group}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          age_group: e.target.value,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    >
                                      {AGE_GROUPS.map((g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      İkinci Kategori (Bildirim İçin)
                                    </label>
                                    <select
                                      value={
                                        editingPlayer.secondary_age_group || ""
                                      }
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          secondary_age_group:
                                            e.target.value || null,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    >
                                      <option value="">Yok (Tek Kategori)</option>
                                      {AGE_GROUPS.filter(
                                        (g) => g !== editingPlayer.age_group
                                      ).map((g) => (
                                        <option key={g} value={g}>
                                          + {g}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Telefon
                                    </label>
                                    <input
                                      disabled={role !== "admin"}
                                      value={editingPlayer.parent_phone || ""}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          parent_phone: e.target.value,
                                        })
                                      }
                                      placeholder="Telefon"
                                      className="k-alan font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Mevki
                                    </label>
                                    <select
                                      value={editingPlayer.position || "Orta Saha"}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          position: e.target.value,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    >
                                      {POSITIONS.map((pos) => (
                                        <option key={pos} value={pos}>
                                          {pos}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Forma No
                                    </label>
                                    <input
                                      type="number"
                                      disabled={role !== "admin"}
                                      placeholder="Forma No"
                                      value={editingPlayer.jersey_number ?? ""}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          jersey_number: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                        })
                                      }
                                      className="k-alan font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="k-koz text-[10px] block mb-1">
                                      Lisans No
                                    </label>
                                    <input
                                      disabled={role !== "admin"}
                                      value={editingPlayer.license_no || ""}
                                      onChange={(e) =>
                                        setEditingPlayer({
                                          ...editingPlayer,
                                          license_no: e.target.value,
                                        })
                                      }
                                      placeholder="Lisans Numarası"
                                      className="k-alan font-bold"
                                    />
                                  </div>
                                </div>

                                {role === "admin" && (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="k-koz text-[10px] block mb-1">
                                        Oyuncu ID
                                      </label>
                                      <input
                                        value={editingPlayer.player_code || ""}
                                        onChange={(e) =>
                                          setEditingPlayer({
                                            ...editingPlayer,
                                            player_code: e.target.value,
                                          })
                                        }
                                        placeholder="Oyuncu ID"
                                        className="k-alan uppercase font-mono font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="k-koz text-[10px] block mb-1">
                                        Şifre
                                      </label>
                                      <input
                                        value={editingPlayer.player_pin || ""}
                                        onChange={(e) =>
                                          setEditingPlayer({
                                            ...editingPlayer,
                                            player_pin: e.target.value,
                                          })
                                        }
                                        placeholder="Şifre"
                                        className="k-alan font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="k-koz text-[10px] block mb-1">
                                        Temsilci Grubu (Varsayılan: Tüm Takım)
                                      </label>
                                      <select
                                        disabled={!editingPlayer.is_representative}
                                        value={
                                          editingPlayer.representative_group ||
                                          "Tümü"
                                        }
                                        onChange={(e) =>
                                          setEditingPlayer({
                                            ...editingPlayer,
                                            representative_group:
                                              e.target.value,
                                          })
                                        }
                                        className="k-alan font-bold disabled:opacity-50"
                                      >
                                        <option value="Tümü">Tüm Takım</option>
                                        {AGE_GROUPS.map((g) => (
                                          <option key={g} value={g}>
                                            {g} Temsilcisi
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                  <div className="flex flex-wrap items-center gap-4">
                                    {role === "admin" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingPlayer({
                                              ...editingPlayer,
                                              bound_device_id: null,
                                            })
                                          }
                                          className="k-buton k-buton--hayalet !py-2 !px-3 !text-xs"
                                        >
                                          {editingPlayer.bound_device_id
                                            ? "Cihaz Kilidini Sıfırla"
                                            : "Cihaz Bağlı Değil"}
                                        </button>
                                        <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--text-primary)] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(
                                              editingPlayer.is_representative
                                            )}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setEditingPlayer({
                                                ...editingPlayer,
                                                is_representative: checked,
                                                representative_group: checked
                                                  ? editingPlayer.representative_group ||
                                                    "Tümü"
                                                  : "Tümü",
                                              });
                                            }}
                                            className="accent-[var(--brand-red)]"
                                          />
                                          Temsilci Yetkisi Ver (Önyüklü: Tüm
                                          Takım)
                                        </label>
                                      </>
                                    )}
                                  </div>
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    type="submit"
                                    disabled={savingEdit}
                                    className="k-buton k-buton--lacivert !px-6 !py-2.5"
                                  >
                                    Değişiklikleri Kaydet
                                  </motion.button>
                                </div>
                              </motion.form>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}