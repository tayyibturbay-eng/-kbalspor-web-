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
  players?: MiniPlayer[];
  onStatus: (msg: string) => void;
}

export function JerseySetsSection({
  jerseySets,
  setJerseySets,
  logs = [],
  players = [],
  onStatus,
}: JerseySetsSectionProps) {
  const [setName, setSetName] = useState("");
  const [kitType, setKitType] = useState<JerseySet["kit_type"]>("Ev");
  const [setQty, setSetQty] = useState("20");
  const [defaultJerseySize, setDefaultJerseySize] = useState("M");
  const [gkDefault1And12, setGkDefault1And12] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingSet, setSavingSet] = useState(false);

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

  function openEditSet(setItem: JerseySet) {
    setEditingSet({ ...setItem });
    const existingPieces =
      Array.isArray(setItem.items) && setItem.items.length > 0
        ? setItem.items.map((x) => ({ ...x, size: x.size || "M" }))
        : buildDefaultPieces(setItem.total_quantity || 20, "M", true);
    setEditingPieces(existingPieces);
  }

  async function handleCreateJerseySet(e: React.FormEvent) {
    e.preventDefault();
    if (!setName.trim()) return;
    setSavingSet(true);

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadJerseyPhoto(photoFile);
    }

    const qty = Number(setQty) || 20;
    const generatedItems = buildDefaultPieces(
      qty,
      defaultJerseySize,
      gkDefault1And12
    );

    const { data, error } = await supabase
      .from("jersey_sets")
      .insert({
        set_name: setName.trim(),
        kit_type: kitType,
        total_quantity: generatedItems.length,
        photo_url: photoUrl,
        items: generatedItems,
      })
      .select()
      .single();

    setSavingSet(false);
    if (error) {
      onStatus("Forma takımı eklenemedi: " + error.message);
      return;
    }
    if (data) {
      const created = data as JerseySet;
      setJerseySets((prev) => [created, ...prev]);
      setSetName("");
      setPhotoFile(null);
      onStatus(
        `✅ ${created.set_name} eklendi (1-${created.total_quantity} numaralandırıldı, beden: ${defaultJerseySize}).`
      );
      openEditSet(created);
    }
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
      onStatus("✅ Forma takımı, numaralar ve bedenler kaydedildi.");
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
      onStatus("✅ Forma takımı görseli güncellendi.");
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
    <div className="space-y-6 text-slate-900">
      <form
        onSubmit={handleCreateJerseySet}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <h3 className="text-base font-extrabold text-[#02274c]">
          Yeni Forma Takımı Oluştur
        </h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Forma Takımı Adı (Örn: 2026 Çubuklu)"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            className="sm:col-span-2 min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
          <select
            value={kitType}
            onChange={(e) =>
              setKitType(e.target.value as JerseySet["kit_type"])
            }
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
          >
            <option value="Ev">Ev Forması</option>
            <option value="Deplasman">Deplasman Forması</option>
            <option value="Alternatif">Alternatif Forma</option>
            <option value="Özel">Özel Seri</option>
          </select>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="Adet (1..N)"
            value={setQty}
            onChange={(e) => setSetQty(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Varsayılan Beden
            </label>
            <select
              value={defaultJerseySize}
              onChange={(e) => setDefaultJerseySize(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border-2 border-slate-300 text-sm font-bold"
            >
              {SIZE_OPTIONS.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[#02274c] bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={gkDefault1And12}
              onChange={(e) => setGkDefault1And12(e.target.checked)}
            />
            🧤 1 ve 12 numaralar ön tanımlı Kaleci Forması olsun
          </label>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Forma Görseli (İsteğe Bağlı)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingSet}
          className="w-full sm:w-auto px-6 min-h-[44px] rounded-xl bg-[#a60513] text-white font-extrabold text-sm cursor-pointer"
        >
          {savingSet
            ? "Oluşturuluyor..."
            : "Forma Takımı Ekle (1'den Adede Numaralandır)"}
        </button>
      </form>

      {editingSet && (
        <form
          onSubmit={handleSaveSetEdit}
          className="bg-white rounded-2xl border-2 border-[#a60513] p-6 space-y-4 shadow-md"
        >
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-base font-extrabold text-[#02274c]">
              Düzenle: {editingSet.set_name} ({editingPieces.length} Forma)
            </h3>
            <button
              type="button"
              onClick={() => setEditingSet(null)}
              className="text-xs font-bold text-slate-600 underline cursor-pointer"
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
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm font-bold"
            />
            <select
              value={editingSet.kit_type}
              onChange={(e) =>
                setEditingSet({
                  ...editingSet,
                  kit_type: e.target.value as JerseySet["kit_type"],
                })
              }
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm font-bold"
            >
              <option value="Ev">Ev Forması</option>
              <option value="Deplasman">Deplasman Forması</option>
              <option value="Alternatif">Alternatif Forma</option>
              <option value="Özel">Özel Seri</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-slate-700">
              Her kutucukta numaranın kimde olduğu veya boşta olduğu yazar. Beden ve Kaleci bilgisini değiştirdikten sonra mutlaka kaydedin.
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
              className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold cursor-pointer"
            >
              + Tek Forma Ekle
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {editingPieces.map((piece, idx) => {
              const holderName = getPieceHolderName(editingSet.id, piece.number);
              return (
                <div
                  key={piece.id}
                  className={`p-3 rounded-xl border space-y-2 ${
                    holderName
                      ? "bg-amber-50 border-amber-300"
                      : piece.is_goalkeeper
                      ? "bg-sky-50 border-sky-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                        holderName
                          ? "bg-amber-600 text-white"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {holderName ? `👤 ${holderName}` : "✓ Boşta"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPieces((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-700 text-xs font-extrabold px-1 cursor-pointer"
                      title="Bu formayı çıkar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16">
                      <label className="block text-[10px] font-bold text-slate-600">
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
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-[#02274c]"
                      />
                    </div>

                    <div className="w-20">
                      <label className="block text-[10px] font-bold text-slate-600">
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
                        className="w-full px-1.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                      >
                        {SIZE_OPTIONS.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 cursor-pointer mt-3">
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
                      🧤 Kaleci
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={savingSetEdit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold cursor-pointer"
          >
            {savingSetEdit
              ? "Kaydediliyor..."
              : "✓ Forma Değişikliklerini Kaydet"}
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
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col"
            >
              {j.photo_url ? (
                <img
                  src={j.photo_url}
                  alt={j.set_name}
                  className="w-full h-44 object-cover bg-slate-100"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-r from-[#02274c] to-[#a60513] flex items-center justify-center text-white font-black">
                  {j.kit_type} Forması
                </div>
              )}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 rounded bg-[#02274c] text-white text-xs font-extrabold">
                    {j.kit_type}
                  </span>
                  <h3 className="text-lg font-extrabold text-[#02274c]">
                    {j.set_name}
                  </h3>
                  <p className="text-xs text-slate-700 font-semibold">
                    Toplam: {j.total_quantity} • Zimmetli: {assignedCount} • Boşta:{" "}
                    {Math.max(0, j.total_quantity - assignedCount)}
                  </p>
                  {pieces.length > 0 && (
                    <div className="text-[11px] text-slate-700 space-y-0.5 pt-1">
                      <div>
                        <strong>Numaralar:</strong>{" "}
                        {pieces
                          .slice(0, 10)
                          .map((x) => {
                            const h = getPieceHolderName(j.id, x.number);
                            return `#${x.number}(${x.size || "M"}${
                              h ? `-${h.split(" ")[0]}` : "-Boş"
                            })`;
                          })
                          .join(", ")}
                        {pieces.length > 10
                          ? ` ... (+${pieces.length - 10})`
                          : ""}
                      </div>
                      {gkList.length > 0 && (
                        <div className="text-amber-900 font-bold">
                          🧤 Kaleci Formaları: {gkList.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => openEditSet(j)}
                    className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold cursor-pointer"
                  >
                    ✏️ Numara / Beden / Durum
                  </button>
                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold cursor-pointer">
                    📷 Görsel {j.photo_url ? "Değiştir" : "Ekle"}
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
                    className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-800 text-xs font-extrabold cursor-pointer ml-auto"
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