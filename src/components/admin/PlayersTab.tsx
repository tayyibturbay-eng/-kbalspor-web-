"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, POSITIONS, Player, UserRole } from "@/types/club";
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

const fieldClass =
  "border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]";

export function PlayersTab({
  role,
  players,
  setPlayers,
  onFeedback,
  onLogActivity,
  onRefreshPlayers,
}: PlayersTabProps) {
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("Tümü");
  const [pointStep, setPointStep] = useState<number>(5);
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
    const currentPts = p.skill_points ?? 20;
    const nextPts = Math.max(0, currentPts + delta);

    const { error } = await supabase
      .from("players")
      .update({ skill_points: nextPts })
      .eq("id", p.id);

    if (error) {
      onFeedback("Puan güncellenemedi: " + error.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? ({ ...x, skill_points: nextPts } as ExtendedPlayer)
          : x
      )
    );
    const label = delta >= 0 ? `+${delta}` : `${delta}`;
    await onLogActivity(
      "Yetenek Puanı Güncelleme",
      `${p.full_name} oyuncusuna ${label} puan uygulandı (Yeni puan: ${nextPts}).`
    );
    onFeedback(
      `${p.full_name} puanı ${nextPts} olarak güncellendi (${label}).`
    );
  }

  async function updatePlayerJerseyNumber(player: Player, rawVal: string) {
    const parsed = parseInt(rawVal.trim(), 10);
    const nextNum = !rawVal.trim() || isNaN(parsed) ? null : Math.max(1, Math.min(99, parsed));
    if (nextNum === (player.jersey_number ?? null)) return;

    const { error } = await supabase
      .from("players")
      .update({ jersey_number: nextNum })
      .eq("id", player.id);

    if (error) {
      onFeedback("Forma no güncellenemedi: " + error.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id ? { ...x, jersey_number: nextNum } : x
      )
    );
  }

  async function updatePlayerPosition(player: Player, newPosition: string) {
    const { error } = await supabase
      .from("players")
      .update({ position: newPosition })
      .eq("id", player.id);

    if (error) {
      onFeedback("Mevki güncellenemedi: " + error.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id ? { ...x, position: newPosition } : x
      )
    );
    await onLogActivity(
      "Mevki Güncelleme",
      `${player.full_name} mevkisi "${newPosition}" yapıldı.`
    );
    onFeedback(
      `${player.full_name} mevkisi "${newPosition}" olarak güncellendi.`
    );
  }

  async function updatePlayerSecondaryGroup(
    player: ExtendedPlayer,
    secondGroup: string
  ) {
    const cleanSecond =
      secondGroup && secondGroup !== player.age_group ? secondGroup : null;

    const { error } = await supabase
      .from("players")
      .update({ secondary_age_group: cleanSecond })
      .eq("id", player.id);

    if (error) {
      onFeedback("İkinci kategori güncellenemedi: " + error.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id
          ? ({ ...x, secondary_age_group: cleanSecond } as ExtendedPlayer)
          : x
      )
    );
    await onLogActivity(
      "İkinci Kategori Güncelleme",
      `${player.full_name} için ikinci kategori: ${cleanSecond || "Yok"}`
    );
    onFeedback(
      `${player.full_name} ikinci kategorisi güncellendi (${
        cleanSecond || "Yok"
      }).`
    );
  }

  async function updateRepresentativeGroup(
    player: ExtendedPlayer,
    repGroup: string
  ) {
    const { error } = await supabase
      .from("players")
      .update({ representative_group: repGroup || "Tümü" })
      .eq("id", player.id);

    if (error) {
      onFeedback("Temsilci grubu güncellenemedi: " + error.message);
      return;
    }

    setPlayers((prev) =>
      prev.map((x) =>
        x.id === player.id
          ? ({
              ...x,
              representative_group: repGroup || "Tümü",
            } as ExtendedPlayer)
          : x
      )
    );
    await onLogActivity(
      "Temsilci Grubu Güncelleme",
      `${player.full_name} temsilcilik kapsamı: ${repGroup || "Tümü"}`
    );
    onFeedback(`${player.full_name} temsilci grubu: ${repGroup || "Tümü"}`);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
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

    const { error } = await supabase.from("players").insert({
      full_name: newPlayer.full_name.trim(),
      birth_date: newPlayer.birth_date || null,
      age_group: ageGroup,
      secondary_age_group: secondGroup,
      representative_group: "Tümü",
      position: newPlayer.position,
      jersey_number: newPlayer.jersey_number
        ? Number(newPlayer.jersey_number)
        : null,
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
    });

    if (error) {
      onFeedback("Hata: " + error.message);
      return;
    }

    await onLogActivity(
      "Oyuncu Ekleme",
      `${newPlayer.full_name} (${ageGroup}${
        secondGroup ? ` + ${secondGroup}` : ""
      }) eklendi — ID: ${autoCode} | Ön yüklü 20 puan`
    );
    onFeedback(
      `${newPlayer.full_name} (${ageGroup}) eklendi. ID: ${autoCode} | Şifre: ${autoPin} | 20 Puan`
    );
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
    await onRefreshPlayers();
  }

  async function savePlayerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
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
    const signedDelta = editPointSign === "+" ? rawAmount : editPointSign === "-" ? -rawAmount : 0;
    const basePoints = Number(editingPlayer.skill_points ?? 20);
    const nextSkillPoints = Math.max(0, basePoints + signedDelta);

    const { error } = await supabase
      .from("players")
      .update({
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
      })
      .eq("id", editingPlayer.id);

    if (error) {
      onFeedback("Güncelleme hatası: " + error.message);
      return;
    }

    const pointLogText =
      Boolean(editPointSign && rawAmount > 0)
        ? ` (${editPointSign}${rawAmount}p -> ${nextSkillPoints}p)`
        : "";
    await onLogActivity(
      "Oyuncu Düzenleme",
      `${editingPlayer.full_name} (${updatedAgeGroup}${
        cleanSecondGroup ? ` + ${cleanSecondGroup}` : ""
      }) güncellendi${pointLogText}.`
    );
    onFeedback(
      Boolean(editPointSign && rawAmount > 0)
        ? `${editingPlayer.full_name} bilgileri güncellendi (${editPointSign}${rawAmount}p • Yeni Puan: ${nextSkillPoints}).`
        : `${editingPlayer.full_name} bilgileri güncellendi.`
    );
    setEditingPlayer(null);
    await onRefreshPlayers();
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`${name} adlı oyuncuyu silmek istediğinize emin misiniz?`))
      return;
    await supabase.from("players").delete().eq("id", id);
    await onLogActivity("Oyuncu Silme", `${name} kadrodan silindi.`);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    onFeedback(`${name} kadrodan silindi.`);
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      {role === "admin" && flaggedPlayersCount > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--status-warning-bg)]/55 border border-amber-400/50 text-[var(--text-primary)] text-sm font-medium">
          <strong>
            Kontrol Edilmesi Gereken {flaggedPlayersCount} Oyuncu Var:
          </strong>{" "}
          Doğum tarihi eksik, isim hatalı veya çift kayıtlar aşağıda
          işaretlendi.
        </div>
      )}

      {role === "admin" && (
        <form
          onSubmit={addPlayer}
          className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3"
        >
          <h2 className="font-black text-[var(--text-primary)]">
            Yeni Oyuncu Ekle (Ön Yüklü 20 Puan)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              required
              placeholder="Ad Soyad"
              value={newPlayer.full_name}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, full_name: e.target.value })
              }
              className={fieldClass}
            />
            <input
              type="date"
              required
              value={newPlayer.birth_date}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, birth_date: e.target.value })
              }
              className={fieldClass}
            />
            <select
              value={newPlayer.secondary_age_group}
              onChange={(e) =>
                setNewPlayer({
                  ...newPlayer,
                  secondary_age_group: e.target.value,
                })
              }
              className={fieldClass}
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
              className={fieldClass}
            />
            <select
              value={newPlayer.position}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, position: e.target.value })
              }
              className={fieldClass}
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
              className={fieldClass}
            />
            <input
              placeholder="Lisans No (Opsiyonel)"
              value={newPlayer.license_no}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, license_no: e.target.value })
              }
              className={fieldClass}
            />
            <input
              placeholder="Özel ID (Boşsa IKB-XXXX)"
              value={newPlayer.player_code}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, player_code: e.target.value })
              }
              className={`uppercase ${fieldClass}`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <input
              placeholder="Şifre (Boşsa Tel Son 4)"
              value={newPlayer.player_pin}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, player_pin: e.target.value })
              }
              className={fieldClass}
            />
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white font-extrabold rounded-xl px-5 py-2.5 text-sm cursor-pointer"
              >
                Oyuncu Ekle
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {["Tümü", ...AGE_GROUPS].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroupFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  selectedGroupFilter === g
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === "admin" && (
              <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-2.5 py-1.5">
                <span className="text-xs font-bold text-[var(--text-secondary)]">
                  Puan Miktarı:
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={pointStep}
                  onChange={(e) =>
                    setPointStep(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 border border-[var(--border-strong)] bg-[var(--bg-surface)] rounded px-2 py-0.5 text-xs font-bold text-[var(--text-primary)]"
                />
              </div>
            )}
            <input
              placeholder="İsim, ID veya lisans ara..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className={`w-full md:w-64 ${fieldClass}`}
            />
          </div>
        </div>

        {groupedPlayers.map(({ group, items }) => (
          <div
            key={group}
            className="border border-[var(--border-subtle)] rounded-xl overflow-hidden"
          >
            <div className="bg-[var(--brand-navy)] text-white px-4 py-2 font-bold text-sm flex justify-between">
              <span>{group} Kategorisi</span>
              <span>{items.length} Oyuncu</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-subtle)] text-[var(--brand-ink)] text-xs font-extrabold border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="p-2.5">Ad Soyad</th>
                    <th className="p-2.5">Doğum Tarihi</th>
                    <th className="p-2.5">Kategoriler</th>
                    <th className="p-2.5">Mevki / Forma</th>
                    <th className="p-2.5">Puan</th>
                    {role === "admin" && <th className="p-2.5">ID / Şifre</th>}
                    {canManageCategories && <th className="p-2.5">İşlem</th>}
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
                      <>
                        <tr
                          key={p.id}
                          className={
                            warnings.length > 0
                              ? "bg-[var(--status-warning-bg)]/35"
                              : "bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]/70"
                          }
                        >
                          <td className="p-2.5 font-bold text-[var(--text-primary)]">
                            {p.full_name}
                            {p.is_representative && (
                              <span className="ml-2 text-[11px] bg-[var(--status-info-bg)] text-[var(--status-info-text)] font-bold px-2 py-0.5 rounded-full">
                                Temsilci ({p.representative_group || "Tüm Takım"})
                              </span>
                            )}
                            {warnings.map((w) => (
                              <span
                                key={w}
                                className="inline-block ml-1 text-[11px] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] font-bold px-2 py-0.5 rounded"
                              >
                                {w}
                              </span>
                            ))}
                          </td>
                          <td className="p-2.5 text-xs font-medium text-[var(--text-secondary)]">
                            {p.birth_date || "Eksik"}
                          </td>
                          <td className="p-2.5 text-xs space-y-1">
                            <div className="font-bold text-[var(--text-primary)]">
                              Ana: {p.age_group}
                            </div>
                            <select
                              value={p.secondary_age_group || ""}
                              onChange={(e) =>
                                updatePlayerSecondaryGroup(p, e.target.value)
                              }
                              aria-label={`${p.full_name} ikinci kategori`}
                              className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
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
                                  className="border border-[var(--border-strong)] bg-[var(--status-info-bg)]/40 rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
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
                          <td className="p-2.5 text-xs text-[var(--text-primary)]">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={p.position || "Orta Saha"}
                                onChange={(e) =>
                                  updatePlayerPosition(p, e.target.value)
                                }
                                className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] rounded-lg px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
                              >
                                {POSITIONS.map((pos) => (
                                  <option key={pos} value={pos}>
                                    {pos}
                                  </option>
                                ))}
                              </select>
                              {p.jersey_number ? (
                                <span className="font-bold text-[var(--text-secondary)]">
                                  #{p.jersey_number}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-2.5 text-xs font-extrabold text-[var(--text-primary)]">
                            {p.skill_points ?? 20}p
                          </td>
                          {role === "admin" && (
                            <td className="p-2.5 font-mono text-xs font-semibold text-[var(--text-secondary)]">
                              {p.player_code} / {p.player_pin || "1234"}
                            </td>
                          )}
                          {canManageCategories && (
                            <td className="p-2.5 flex flex-wrap gap-1.5">
                              {role === "admin" && (
                                <>
                                  <button
                                    type="button"
                                    title={`+${pointStep} Puan`}
                                    onClick={() =>
                                      adjustPlayerPoints(p, pointStep)
                                    }
                                    className="w-8 h-8 rounded-full border-2 border-emerald-600/70 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-base font-black cursor-pointer transition"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    title={`-${pointStep} Puan`}
                                    onClick={() =>
                                      adjustPlayerPoints(p, -pointStep)
                                    }
                                    className="w-8 h-8 rounded-full border-2 border-red-600/70 bg-red-500/10 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-300 flex items-center justify-center text-base font-black cursor-pointer transition"
                                  >
                                    -
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => openPlayerEditor(p)}
                                className="bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                {isEditingThisRow ? "Kapat" : "Düzenle"}
                              </button>
                              {role === "admin" && (
                                <button
                                  type="button"
                                  onClick={() => deletePlayer(p.id, p.full_name)}
                                  className="bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                                >
                                  Sil
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {isEditingThisRow && editingPlayer && (
                          <tr
                            key={`${p.id}-editor`}
                            className="bg-[var(--bg-subtle)]"
                          >
                            <td colSpan={tableColSpan} className="p-4">
                              <form
                                onSubmit={savePlayerEdit}
                                className="bg-[var(--bg-surface)] p-4 rounded-2xl shadow-md border-2 border-[var(--brand-red)] space-y-4 text-[var(--text-primary)]"
                              >
                                <div className="flex justify-between items-center">
                                  <h3 className="text-base font-black text-[var(--text-primary)]">
                                    {editingPlayer.full_name} — Bilgilerini &amp;
                                    Kategorilerini Düzenle
                                  </h3>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPlayer(null)}
                                    className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                                  >
                                    Vazgeç
                                  </button>
                                </div>

                                {role === "admin" && (
                                  <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-3.5 flex flex-wrap items-center justify-between gap-4">
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
                                          onClick={() => setEditPointSign((prev) => (prev === "+" ? null : "+"))}
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
                                          onClick={() => setEditPointSign((prev) => (prev === "-" ? null : "-"))}
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
                                        className="w-20 border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-center text-sm font-black"
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    >
                                      {AGE_GROUPS.map((g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
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
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    >
                                      {POSITIONS.map((pos) => (
                                        <option key={pos} value={pos}>
                                          {pos}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                      className={`w-full ${fieldClass}`}
                                    />
                                  </div>
                                </div>

                                {role === "admin" && (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                        className={`w-full uppercase ${fieldClass}`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                        className={`w-full ${fieldClass}`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
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
                                        className={`w-full ${fieldClass} disabled:opacity-50`}
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
                                          className="border border-amber-400 bg-[var(--status-warning-bg)]/50 text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
                                        >
                                          {editingPlayer.bound_device_id
                                            ? "Cihaz Kilidini Sıfırla"
                                            : "Cihaz Bağlı Değil"}
                                        </button>
                                        <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer">
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
                                          />
                                          Temsilci Yetkisi Ver (Önyüklü: Tüm
                                          Takım)
                                        </label>
                                      </>
                                    )}
                                  </div>
                                  <button
                                    type="submit"
                                    className="bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold px-6 py-2.5 rounded-xl text-sm cursor-pointer"
                                  >
                                    Değişiklikleri Kaydet
                                  </button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                      </>
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