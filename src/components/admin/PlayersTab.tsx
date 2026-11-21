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
  "border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#02274c] focus:border-[#02274c]";

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
    position: "Orta Saha",
    jersey_number: "",
    parent_phone: "",
    player_code: "",
    player_pin: "",
    license_no: "",
  });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const duplicateKeys = useMemo(() => getDuplicatePlayerKeys(players), [players]);

  const flaggedPlayersCount = useMemo(
    () => players.filter((p) => getPlayerWarnings(p, duplicateKeys).length > 0).length,
    [players, duplicateKeys]
  );

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.toLowerCase();
    return players.filter(
      (p) =>
        (selectedGroupFilter === "Tümü" || p.age_group === selectedGroupFilter) &&
        (p.full_name.toLowerCase().includes(q) ||
          (p.player_code || "").toLowerCase().includes(q) ||
          (p.license_no || "").toLowerCase().includes(q) ||
          p.age_group.toLowerCase().includes(q))
    );
  }, [players, selectedGroupFilter, playerSearch]);

  const groupedPlayers = useMemo(
    () =>
      AGE_GROUPS.map((g) => ({
        group: g,
        items: filteredPlayers.filter((p) => p.age_group === g),
      })).filter((x) => x.items.length > 0),
    [filteredPlayers]
  );

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
        x.id === p.id ? ({ ...x, skill_points: nextPts } as ExtendedPlayer) : x
      )
    );
    const label = delta >= 0 ? `+${delta}` : `${delta}`;
    await onLogActivity(
      "Yetenek Puanı Güncelleme",
      `${p.full_name} oyuncusuna ${label} puan uygulandı (Yeni puan: ${nextPts}).`
    );
    onFeedback(`✅ ${p.full_name} puanı ${nextPts} olarak güncellendi (${label}).`);
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
      prev.map((x) => (x.id === player.id ? { ...x, position: newPosition } : x))
    );
    await onLogActivity(
      "Mevki Güncelleme",
      `${player.full_name} mevkisi "${newPosition}" yapıldı.`
    );
    onFeedback(`✅ ${player.full_name} mevkisi "${newPosition}" olarak güncellendi.`);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const ageGroup = calcAgeGroupFromBirthDate(newPlayer.birth_date);
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
      position: newPlayer.position,
      jersey_number: newPlayer.jersey_number ? Number(newPlayer.jersey_number) : null,
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
      `${newPlayer.full_name} (${ageGroup}) eklendi — ID: ${autoCode} | Ön yüklü 20 puan${
        cleanLicense ? ` | Lisans: ${cleanLicense}` : ""
      }`
    );
    onFeedback(
      `✅ ${newPlayer.full_name} (${ageGroup}) eklendi. ID: ${autoCode} | Şifre: ${autoPin} | 20 Puan`
    );
    setNewPlayer({
      full_name: "",
      birth_date: "",
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
    const updatedAgeGroup = editingPlayer.birth_date
      ? calcAgeGroupFromBirthDate(editingPlayer.birth_date)
      : editingPlayer.age_group;
    const cleanLicense = editingPlayer.license_no?.trim() || null;

    const { error } = await supabase
      .from("players")
      .update({
        full_name: editingPlayer.full_name.trim(),
        birth_date: editingPlayer.birth_date || null,
        age_group: updatedAgeGroup,
        position: editingPlayer.position,
        jersey_number: editingPlayer.jersey_number
          ? Number(editingPlayer.jersey_number)
          : null,
        parent_phone: editingPlayer.parent_phone?.trim() || null,
        player_code: editingPlayer.player_code?.trim().toUpperCase() || null,
        player_pin: editingPlayer.player_pin?.trim() || "1234",
        is_representative: Boolean(editingPlayer.is_representative),
        license_no: cleanLicense,
        bound_device_id: editingPlayer.bound_device_id,
      })
      .eq("id", editingPlayer.id);

    if (error) {
      onFeedback("Güncelleme hatası: " + error.message);
      return;
    }

    await onLogActivity(
      "Oyuncu Düzenleme",
      `${editingPlayer.full_name} (${updatedAgeGroup}) bilgileri güncellendi.${
        cleanLicense ? ` Lisans No: ${cleanLicense}` : ""
      }`
    );
    onFeedback(`✅ ${editingPlayer.full_name} bilgileri güncellendi (${updatedAgeGroup}).`);
    setEditingPlayer(null);
    await onRefreshPlayers();
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`${name} adlı oyuncuyu silmek istediğinize emin misiniz?`)) return;
    await supabase.from("players").delete().eq("id", id);
    await onLogActivity("Oyuncu Silme", `${name} kadrodan silindi.`);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    onFeedback(`🗑️ ${name} kadrodan silindi.`);
  }

  return (
    <div className="space-y-6 text-slate-900">
      {role === "admin" && flaggedPlayersCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-sm font-medium">
          <strong>⚠️ Kontrol Edilmesi Gereken {flaggedPlayersCount} Oyuncu Var:</strong> Doğum
          tarihi eksik, isim hatalı veya çift kayıtlar aşağıda işaretlendi.
        </div>
      )}

      {role === "admin" && editingPlayer && (
        <form
          onSubmit={savePlayerEdit}
          className="bg-white p-5 rounded-2xl shadow-md border-2 border-[#a60513] space-y-4 text-slate-900"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-extrabold text-[#02274c]">
              Oyuncu Bilgilerini Düzenle
            </h2>
            <button
              type="button"
              onClick={() => setEditingPlayer(null)}
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 underline"
            >
              Vazgeç
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Ad Soyad</label>
              <input
                required
                value={editingPlayer.full_name}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, full_name: e.target.value })
                }
                className={`w-full ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Doğum Tarihi</label>
              <input
                type="date"
                value={editingPlayer.birth_date || ""}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, birth_date: e.target.value })
                }
                className={`w-full ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Telefon</label>
              <input
                value={editingPlayer.parent_phone || ""}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, parent_phone: e.target.value })
                }
                placeholder="Telefon"
                className={`w-full ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Mevki</label>
              <select
                value={editingPlayer.position || "Orta Saha"}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, position: e.target.value })
                }
                className={`w-full ${fieldClass}`}
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos} className="bg-white text-slate-900">
                    {pos}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Forma No</label>
              <input
                type="number"
                placeholder="Forma No"
                value={editingPlayer.jersey_number ?? ""}
                onChange={(e) =>
                  setEditingPlayer({
                    ...editingPlayer,
                    jersey_number: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={`w-full ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Lisans No</label>
              <input
                value={editingPlayer.license_no || ""}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, license_no: e.target.value })
                }
                placeholder="Lisans Numarası"
                className={`w-full ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Oyuncu ID</label>
              <input
                value={editingPlayer.player_code || ""}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, player_code: e.target.value })
                }
                placeholder="Oyuncu ID"
                className={`w-full uppercase ${fieldClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Şifre</label>
              <input
                value={editingPlayer.player_pin || ""}
                onChange={(e) =>
                  setEditingPlayer({ ...editingPlayer, player_pin: e.target.value })
                }
                placeholder="Şifre"
                className={`w-full ${fieldClass}`}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setEditingPlayer({ ...editingPlayer, bound_device_id: null })
                }
                className="border border-amber-400 bg-amber-50 text-amber-950 rounded-lg px-3 py-2 text-xs font-bold"
              >
                {editingPlayer.bound_device_id
                  ? "📱 Cihaz Kilidini Sıfırla"
                  : "📱 Cihaz Bağlı Değil"}
              </button>
              <label className="flex items-center gap-2 text-sm font-bold text-[#02274c]">
                <input
                  type="checkbox"
                  checked={Boolean(editingPlayer.is_representative)}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      is_representative: e.target.checked,
                    })
                  }
                />
                Temsilci Yetkisi Ver
              </label>
            </div>
            <button
              type="submit"
              className="bg-[#02274c] hover:bg-[#033669] text-white font-bold px-6 py-2 rounded-lg text-sm"
            >
              Değişiklikleri Kaydet
            </button>
          </div>
        </form>
      )}

      {role === "admin" && (
        <form
          onSubmit={addPlayer}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3 text-slate-900"
        >
          <h2 className="font-bold text-[#02274c]">Yeni Oyuncu Ekle (Ön Yüklü 20 Puan)</h2>
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
                <option key={pos} value={pos} className="bg-white text-slate-900">
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
            <input
              placeholder="Şifre (Boşsa Tel Son 4)"
              value={newPlayer.player_pin}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, player_pin: e.target.value })
              }
              className={fieldClass}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#a60513] hover:bg-red-700 text-white font-bold rounded-lg px-5 py-2 text-sm"
            >
              Oyuncu Ekle
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 text-slate-900">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {["Tümü", ...AGE_GROUPS].map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroupFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  selectedGroupFilter === g
                    ? "bg-[#02274c] text-white border-[#02274c]"
                    : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === "admin" && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-bold text-slate-700">Puan Miktarı:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={pointStep}
                  onChange={(e) => setPointStep(Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 border border-slate-300 bg-white rounded px-2 py-0.5 text-xs font-bold text-slate-900"
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
          <div key={group} className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-[#02274c] text-white px-4 py-2 font-bold text-sm flex justify-between">
              <span>{group} Kategorisi</span>
              <span>{items.length} Oyuncu</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-900">
                <thead className="bg-slate-100 text-[#02274c] text-xs font-extrabold">
                  <tr>
                    <th className="p-2.5">Ad Soyad</th>
                    <th className="p-2.5">Doğum Tarihi</th>
                    <th className="p-2.5">Mevki / Forma</th>
                    <th className="p-2.5">Lisans No</th>
                    <th className="p-2.5">Puan</th>
                    {role === "admin" && <th className="p-2.5">ID / Şifre</th>}
                    {role === "admin" && <th className="p-2.5">İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((rawP) => {
                    const p = rawP as ExtendedPlayer;
                    const warnings =
                      role === "admin" ? getPlayerWarnings(p, duplicateKeys) : [];
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-200 ${
                          warnings.length > 0 ? "bg-amber-50/70" : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-2.5 font-bold text-[#02274c]">
                          {p.full_name}
                          {p.is_representative && (
                            <span className="ml-2 text-[11px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                              Temsilci
                            </span>
                          )}
                          {warnings.map((w) => (
                            <span
                              key={w}
                              className="inline-block ml-1 text-[11px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded"
                            >
                              ⚠️ {w}
                            </span>
                          ))}
                        </td>
                        <td className="p-2.5 text-xs font-medium text-slate-800">
                          {p.birth_date || "Eksik"}
                        </td>
                        <td className="p-2.5 text-xs text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={p.position || "Orta Saha"}
                              onChange={(e) =>
                                updatePlayerPosition(p, e.target.value)
                              }
                              className="border border-slate-300 bg-white rounded-lg px-2 py-1 text-xs font-bold text-[#02274c]"
                            >
                              {POSITIONS.map((pos) => (
                                <option key={pos} value={pos} className="bg-white text-slate-900">
                                  {pos}
                                </option>
                              ))}
                            </select>
                            {p.jersey_number ? (
                              <span className="font-bold text-slate-800">
                                #{p.jersey_number}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2.5 text-xs font-semibold text-slate-900">
                          {p.license_no || "-"}
                        </td>
                        <td className="p-2.5 text-xs font-extrabold text-[#02274c]">
                          {p.skill_points ?? 20}p
                        </td>
                        {role === "admin" && (
                          <td className="p-2.5 font-mono text-xs font-semibold text-slate-900">
                            {p.player_code} / {p.player_pin || "1234"}
                          </td>
                        )}
                        {role === "admin" && (
                          <td className="p-2.5 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => adjustPlayerPoints(p, pointStep)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              +{pointStep} Puan
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustPlayerPoints(p, -pointStep)}
                              className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              -{pointStep} Puan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPlayer(p)}
                              className="bg-[#02274c] hover:bg-[#033669] text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePlayer(p.id, p.full_name)}
                              className="bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              Sil
                            </button>
                          </td>
                        )}
                      </tr>
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