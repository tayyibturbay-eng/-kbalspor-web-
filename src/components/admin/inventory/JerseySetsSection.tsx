"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EquipmentLog, JerseyPiece, JerseySet, SIZE_OPTIONS } from "@/types/club";

const supabase = createClient();

function buildDefaultPieces(
  qty: number,
  defaultSize: string,
  defaultGk1And12: boolean
): JerseyPiece[] {
  const count = Math.max(1, Math.min(100, qty || 1));
  return Array.from({ length: count }, (_, idx) => {
    const num = idx + 1;
    return {
      id: `piece-${Date.now()}-${num}-${Math.random().toString(36).slice(2, 6)}`,
      number: num,
      size: defaultSize || "M",
      is_goalkeeper: defaultGk1And12 ? num === 1 || num === 12 : false,
    };
  });
}

async function uploadJerseyPhoto(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `jerseys/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("jersey-photos")
    .upload(filePath, file);
  if (upErr) return null;
  const { data: pub } = supabase.storage
    .from("jersey-photos")
    .getPublicUrl(filePath);
  return pub.publicUrl;
}

type MiniPlayer = {
  id: string;
  full_name: string;
  age_group?: string;
  parent_phone?: string | null;
};

interface JerseySetsSectionProps {
  jerseySets: JerseySet[];
  setJerseySets: React.Dispatch<React.SetStateAction<JerseySet[]>>;
  logs?: EquipmentLog[];
  setLogs?: React.Dispatch<React.SetStateAction<EquipmentLog[]>>;
  players?: MiniPlayer[];
  onStatus: (msg: string) => void;
}

export function JerseySetsSection({
  jerseySets,
  setJerseySets,
  logs = [],
  setLogs,
  players = [],
  onStatus,
}: JerseySetsSectionProps) {
  const [editingSet, setEditingSet] = useState<JerseySet | null>(null);
  const [editingPieces, setEditingPieces] = useState<JerseyPiece[]>([]);
  const [savingSetEdit, setSavingSetEdit] = useState(false);

  function getPieceHolderName(setId: string, num: number): string | null {
    const activeLog = logs.find(
      (l) =>
        l.status === "teslim_edildi" &&
        l.jersey_set_id === setId &&
        l.jersey_number_given === num
    );
    if (!activeLog) return null;
    const holder = players.find((p) => p.id === activeLog.player_id);
    return holder?.full_name || "Zimmetli Sporcu";
  }

  function isPieceMissing(setId: string, num: number): boolean {
    return logs.some(
      (l) =>
        l.status === "kayip_eksik" &&
        l.jersey_set_id === setId &&
        l.jersey_number_given === num
    );
  }

  async function handleTogglePieceMissing(setItem: JerseySet, piece: JerseyPiece) {
    const existingMissing = logs.find(
      (l) =>
        l.status === "kayip_eksik" &&
        l.jersey_set_id === setItem.id &&
        l.jersey_number_given === piece.number
    );

    if (existingMissing) {
      const { error } = await supabase
        .from("equipment_logs")
        .update({ status: "iade_edildi" })
        .eq("id", existingMissing.id);
      if (!error) {
        setLogs?.((prev) =>
          prev.map((l) =>
            l.id === existingMissing.id ? { ...l, status: "iade_edildi" } : l
          )
        );
        onStatus(
          `${setItem.set_name} #${piece.number} numaralı forma kayıp/eksik listesinden çıkarıldı.`
        );
      }
      return;
    }

    const activeLog = logs.find(
      (l) =>
        l.status === "teslim_edildi" &&
        l.jersey_set_id === setItem.id &&
        l.jersey_number_given === piece.number
    );

    if (activeLog) {
      const { error } = await supabase
        .from("equipment_logs")
        .update({ status: "kayip_eksik" })
        .eq("id", activeLog.id);
      if (!error) {
        setLogs?.((prev) =>
          prev.map((l) =>
            l.id === activeLog.id ? { ...l, status: "kayip_eksik" } : l
          )
        );
        onStatus(
          `${setItem.set_name} #${piece.number} numaralı forma Kayıp / Eksik işaretlendi.`
        );
      }
      return;
    }

    const fallbackPlayerId = players[0]?.id;
    if (!fallbackPlayerId) {
      onStatus(
        "Kayıp/eksik kaydı oluşturmak için önce en az 1 sporcu kaydı olmalıdır."
      );
      return;
    }

    const { data, error } = await supabase
      .from("equipment_logs")
      .insert({
        player_id: fallbackPlayerId,
        jersey_set_id: setItem.id,
        item_name: `${setItem.set_name} (${setItem.kit_type}) #${piece.number}`,
        item_size: piece.size || "M",
        jersey_number_given: piece.number,
        category: "Forma",
        status: "kayip_eksik",
      })
      .select()
      .single();

    if (!error && data) {
      setLogs?.((prev) => [data as EquipmentLog, ...prev]);
      onStatus(
        `${setItem.set_name} #${piece.number} numaralı forma tekil olarak Kayıp / Eksik işaretlendi.`
      );
    }
  }

  function openEditSet(setItem: JerseySet) {
    setEditingSet({ ...setItem });
    const existingPieces =
      Array.isArray(setItem.items) && setItem.items.length > 0
        ? setItem.items.map((x) => ({ ...x, size: x.size || "M" }))
        : buildDefaultPieces(setItem.total_quantity || 20, "M", true);
    setEditingPieces(existingPieces);
  }

  async function handleSaveSetEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSet) return;
    setSavingSetEdit(true);

    const normalizedPieces = editingPieces.map((p) => ({
      ...p,
      size: p.size || "M",
    }));

    const { data, error } = await supabase
      .from("jersey_sets")
      .update({
        set_name: editingSet.set_name.trim(),
        kit_type: editingSet.kit_type,
        total_quantity: normalizedPieces.length,
        items: normalizedPieces,
      })
      .eq("id", editingSet.id)
      .select()
      .single();

    setSavingSetEdit(false);
    if (error) {
      onStatus("Güncelleme hatası: " + error.message);
      return;
    }
    if (data) {
      setJerseySets((prev) =>
        prev.map((j) => (j.id === editingSet.id ? (data as JerseySet) : j))
      );
      setEditingSet(null);
      onStatus("Forma takımı, numaralar ve bedenler kaydedildi.");
    }
  }

  async function handleUploadSetPhotoAfter(setId: string, file: File) {
    const url = await uploadJerseyPhoto(file);
    if (!url) {
      onStatus("Görsel yüklenemedi.");
      return;
    }
    const { error } = await supabase
      .from("jersey_sets")
      .update({ photo_url: url })
      .eq("id", setId);
    if (!error) {
      setJerseySets((prev) =>
        prev.map((j) => (j.id === setId ? { ...j, photo_url: url } : j))
      );
      if (editingSet?.id === setId)
        setEditingSet({ ...editingSet, photo_url: url });
      onStatus("Forma takımı görseli güncellendi.");
    }
  }

  async function handleDeleteJerseySet(id: string, name: string) {
    if (!confirm(`"${name}" forma takımını silmek istediğinize emin misiniz?`))
      return;
    await supabase.from("jersey_sets").delete().eq("id", id);
    setJerseySets((prev) => prev.filter((j) => j.id !== id));
    if (editingSet?.id === id) setEditingSet(null);
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-[var(--text-primary)]">
          Forma Takımları (Numara Bazlı Kayıp / Eksik İşaretleme)
        </h3>
      </div>

      {editingSet && (
        <form
          onSubmit={handleSaveSetEdit}
          className="bg-[var(--bg-surface)] rounded-2xl border-2 border-[var(--brand-red)] p-6 space-y-4 shadow-md"
        >
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-base font-black text-[var(--text-primary)]">
              Düzenle: {editingSet.set_name} ({editingPieces.length} Forma)
            </h3>
            <button
              type="button"
              onClick={() => setEditingSet(null)}
              className="text-xs font-bold text-[var(--text-secondary)] underline cursor-pointer"
            >
              Kapat
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={editingSet.set_name}
              onChange={(e) =>
                setEditingSet({ ...editingSet, set_name: e.target.value })
              }
              className="min-h-[42px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-bold"
            />
            <select
              value={editingSet.kit_type}
              onChange={(e) =>
                setEditingSet({
                  ...editingSet,
                  kit_type: e.target.value as JerseySet["kit_type"],
                })
              }
              className="min-h-[42px] px-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-bold"
            >
              <option value="Ev">Ev Forması</option>
              <option value="Deplasman">Deplasman Forması</option>
              <option value="Alternatif">Alternatif Forma</option>
              <option value="Özel">Özel Seri</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-[var(--text-secondary)]">
              İstediğiniz forma numarasında (örneğin #5) &quot;Kayıp /
              Eksik&quot; butonuna basarak tek tek işaretleyebilirsiniz.
            </p>
            <button
              type="button"
              onClick={() =>
                setEditingPieces((prev) => [
                  ...prev,
                  {
                    id: `piece-${Date.now()}`,
                    number:
                      prev.length > 0
                        ? Math.max(...prev.map((x) => x.number)) + 1
                        : 1,
                    size: "M",
                    is_goalkeeper: false,
                  },
                ])
              }
              className="px-3 py-1.5 rounded-lg bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold cursor-pointer"
            >
              + Tek Forma Ekle
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {editingPieces.map((piece, idx) => {
              const holderName = getPieceHolderName(editingSet.id, piece.number);
              const missing = isPieceMissing(editingSet.id, piece.number);

              return (
                <div
                  key={piece.id}
                  className={`p-3 rounded-xl border space-y-2 ${
                    missing
                      ? "bg-[var(--status-danger-bg)]/45 border-red-400"
                      : holderName
                      ? "bg-[var(--status-warning-bg)]/45 border-amber-400"
                      : "bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                        missing
                          ? "bg-[var(--brand-red)] text-white"
                          : holderName
                          ? "bg-amber-600 text-white"
                          : "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      }`}
                    >
                      {missing
                        ? "Kayıp / Eksik"
                        : holderName
                        ? holderName
                        : "Boşta"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPieces((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-[var(--brand-red)] text-xs font-extrabold px-1 cursor-pointer"
                      title="Bu formayı çıkar"
                    >
                      x
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16">
                      <label className="block text-[10px] font-bold text-[var(--text-muted)]">
                        No
                      </label>
                      <input
                        type="number"
                        value={piece.number}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingPieces((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? { ...p, number: isNaN(val) ? 0 : val }
                                : p
                            )
                          );
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-extrabold text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="w-20">
                      <label className="block text-[10px] font-bold text-[var(--text-muted)]">
                        Beden
                      </label>
                      <select
                        value={piece.size || "M"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingPieces((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, size: val } : p
                            )
                          );
                        }}
                        className="w-full px-1.5 py-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-bold"
                      >
                        {SIZE_OPTIONS.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-1 text-[11px] font-extrabold text-[var(--text-primary)] cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={piece.is_goalkeeper}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditingPieces((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, is_goalkeeper: checked } : p
                            )
                          );
                        }}
                      />
                      Kaleci
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePieceMissing(editingSet, piece)}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      missing
                        ? "bg-emerald-600 text-white"
                        : "bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)]"
                    }`}
                  >
                    {missing
                      ? `#${piece.number} Kayıp/Eksik Kaldır`
                      : `#${piece.number} Kayıp / Eksik İşaretle`}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={savingSetEdit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold cursor-pointer"
          >
            {savingSetEdit
              ? "Kaydediliyor..."
              : "Forma Değişikliklerini Kaydet"}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {jerseySets.map((j) => {
          const pieces = Array.isArray(j.items) ? j.items : [];
          const gkList = pieces
            .filter((x) => x.is_goalkeeper)
            .map((x) => `#${x.number}`);
          const assignedCount = pieces.filter(
            (x) => Boolean(getPieceHolderName(j.id, x.number))
          ).length;

          return (
            <div
              key={j.id}
              className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-xs flex flex-col"
            >
              {j.photo_url ? (
                <img
                  src={j.photo_url}
                  alt={j.set_name}
                  className="w-full h-44 object-cover bg-[var(--bg-subtle)]"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] flex items-center justify-center text-white font-black">
                  {j.kit_type} Forması
                </div>
              )}
              <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2.5 py-0.5 rounded bg-[var(--brand-navy)] text-white text-xs font-extrabold">
                    {j.kit_type}
                  </span>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">
                    {j.set_name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold">
                    Toplam: {j.total_quantity} • Zimmetli: {assignedCount} •
                    Boşta: {Math.max(0, j.total_quantity - assignedCount)}
                  </p>

                  {pieces.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="block text-[11px] font-bold text-[var(--text-muted)]">
                        Numaralar (Tek tıkla Kayıp/Eksik işaretle):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {pieces.map((x) => {
                          const h = getPieceHolderName(j.id, x.number);
                          const miss = isPieceMissing(j.id, x.number);
                          return (
                            <button
                              key={x.id}
                              type="button"
                              onClick={() => handleTogglePieceMissing(j, x)}
                              title={
                                miss
                                  ? `#${x.number} Kayıp/Eksik (kaldırmak için tıkla)`
                                  : h
                                  ? `#${x.number} (${h}) - Kayıp/Eksik işaretle`
                                  : `#${x.number} (Boşta) - Kayıp/Eksik işaretle`
                              }
                              className={`px-2 py-0.5 rounded text-[11px] font-extrabold border cursor-pointer ${
                                miss
                                  ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)]"
                                  : h
                                  ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-amber-400/60"
                                  : "bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--brand-red)]"
                              }`}
                            >
                              #{x.number}
                              {miss ? " !" : ""}
                            </button>
                          );
                        })}
                      </div>
                      {gkList.length > 0 && (
                        <div className="text-[11px] text-[var(--status-warning-text)] font-bold pt-0.5">
                          Kaleci Formaları: {gkList.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => openEditSet(j)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Numara / Beden / Durum
                  </button>
                  <label className="px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:opacity-85 border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-extrabold cursor-pointer">
                    Görsel {j.photo_url ? "Değiştir" : "Ekle"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadSetPhotoAfter(j.id, f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteJerseySet(j.id, j.set_name)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer ml-auto"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}