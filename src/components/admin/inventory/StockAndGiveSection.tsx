"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EquipmentLog, JerseySet, SIZE_OPTIONS, StockItem } from "@/types/club";

const supabase = createClient();

type MiniPlayer = {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
};

async function uploadStockPhoto(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `stock/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("jersey-photos")
    .upload(filePath, file);
  if (upErr) return null;
  const { data: pub } = supabase.storage
    .from("jersey-photos")
    .getPublicUrl(filePath);
  return pub.publicUrl;
}

interface StockAndGiveSectionProps {
  players: MiniPlayer[];
  jerseySets: JerseySet[];
  stockItems: StockItem[];
  setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  logs: EquipmentLog[];
  setLogs: React.Dispatch<React.SetStateAction<EquipmentLog[]>>;
  onStatus: (msg: string) => void;
}

export function StockAndGiveSection({
  players,
  jerseySets,
  stockItems,
  setStockItems,
  logs,
  setLogs,
  onStatus,
}: StockAndGiveSectionProps) {
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("Dış Giyim");
  const [prodCount, setProdCount] = useState("20");
  const [prodSizeInfo, setProdSizeInfo] = useState("S, M, L, XL");
  const [prodPhotoFile, setProdPhotoFile] = useState<File | null>(null);
  const [savingStock, setSavingStock] = useState(false);

  const [editingStock, setEditingStock] = useState<StockItem | null>(null);

  const [selPlayer, setSelPlayer] = useState("");
  const [giveMode, setGiveMode] = useState<"forma" | "malzeme">("forma");
  const [handoverType, setHandoverType] = useState<"emanet" | "tam_teslim">("emanet");
  const [selJerseySet, setSelJerseySet] = useState("");
  const [selStockName, setSelStockName] = useState("Yağmurluk");
  const [itemSize, setItemSize] = useState("M");
  const [jerseyNo, setJerseyNo] = useState("");

  useEffect(() => {
    if (players.length > 0 && !selPlayer) setSelPlayer(players[0].id);
  }, [players, selPlayer]);

  useEffect(() => {
    if (jerseySets.length > 0 && !selJerseySet)
      setSelJerseySet(jerseySets[0].id);
  }, [jerseySets, selJerseySet]);

  useEffect(() => {
    if (stockItems.length > 0 && !selStockName)
      setSelStockName(stockItems[0].product_name);
  }, [stockItems, selStockName]);

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    if (!prodName.trim()) return;
    setSavingStock(true);

    let photoUrl: string | null = null;
    if (prodPhotoFile) {
      photoUrl = await uploadStockPhoto(prodPhotoFile);
    }

    const { data, error } = await supabase
      .from("equipment_stock")
      .insert({
        product_name: prodName.trim(),
        category: prodCat.trim() || "Malzeme",
        stock_count: Number(prodCount) || 0,
        size_info: prodSizeInfo.trim() || null,
        photo_url: photoUrl,
      })
      .select()
      .single();

    setSavingStock(false);
    if (error) {
      onStatus("Ürün eklenemedi: " + error.message);
      return;
    }
    if (data) {
      setStockItems((prev) => [...prev, data as StockItem]);
      setProdName("");
      setProdPhotoFile(null);
      onStatus("✅ Yeni malzeme stoğu eklendi.");
    }
  }

  async function handleSaveStockEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStock) return;
    const { data, error } = await supabase
      .from("equipment_stock")
      .update({
        product_name: editingStock.product_name.trim(),
        category: editingStock.category.trim(),
        stock_count: Number(editingStock.stock_count) || 0,
        size_info: editingStock.size_info?.trim() || null,
      })
      .eq("id", editingStock.id)
      .select()
      .single();

    if (!error && data) {
      setStockItems((prev) =>
        prev.map((s) => (s.id === editingStock.id ? (data as StockItem) : s))
      );
      setEditingStock(null);
      onStatus("✅ Ürün bilgileri güncellendi.");
    }
  }

  async function handleUploadStockPhotoAfter(stockId: string, file: File) {
    const url = await uploadStockPhoto(file);
    if (!url) {
      onStatus("Görsel yüklenemedi.");
      return;
    }
    const { error } = await supabase
      .from("equipment_stock")
      .update({ photo_url: url })
      .eq("id", stockId);
    if (!error) {
      setStockItems((prev) =>
        prev.map((s) => (s.id === stockId ? { ...s, photo_url: url } : s))
      );
      onStatus("✅ Ürün görseli güncellendi.");
    }
  }

  async function handleDeleteStock(id: string, name: string) {
    if (!confirm(`"${name}" ürününü silmek istediğinize emin misiniz?`))
      return;
    await supabase.from("equipment_stock").delete().eq("id", id);
    setStockItems((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleGiveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selPlayer) return;
    const chosenSet = jerseySets.find((j) => j.id === selJerseySet);

    if (giveMode === "forma" && selJerseySet && jerseyNo) {
      const existingHolderLog = logs.find(
        (l) =>
          l.status === "teslim_edildi" &&
          l.jersey_set_id === selJerseySet &&
          l.jersey_number_given === Number(jerseyNo)
      );
      if (existingHolderLog) {
        const holder = players.find((p) => p.id === existingHolderLog.player_id);
        const proceed = confirm(
          `⚠️ #${jerseyNo} numaralı forma şu an "${
            holder?.full_name || "başka bir sporcu"
          }" üzerinde görünüyor. Yine de teslim etmek istiyor musunuz?`
        );
        if (!proceed) return;
      }
    }

    const handoverLabel =
      handoverType === "emanet" ? "Emanet" : "Tam Teslim";

    const payload =
      giveMode === "forma"
        ? {
            player_id: selPlayer,
            jersey_set_id: selJerseySet || null,
            item_name: chosenSet
              ? `${chosenSet.set_name} (${chosenSet.kit_type}) [${handoverLabel}]`
              : `Forma [${handoverLabel}]`,
            item_size: itemSize.trim() || "M",
            jersey_number_given: jerseyNo ? Number(jerseyNo) : null,
            category: "Forma",
            status: "teslim_edildi",
          }
        : {
            player_id: selPlayer,
            jersey_set_id: null,
            item_name: `${selStockName} [${handoverLabel}]`,
            item_size: itemSize.trim() || "M",
            jersey_number_given: null,
            category: "Malzeme",
            status: "teslim_edildi",
          };

    const { data, error } = await supabase
      .from("equipment_logs")
      .insert(payload)
      .select()
      .single();

    if (error) {
      onStatus("Teslimat kaydedilemedi: " + error.message);
      return;
    }

    if (data) {
      setLogs((prev) => [data as EquipmentLog, ...prev]);

      if (giveMode === "malzeme") {
        const targetStock = stockItems.find(
          (s) => s.product_name === selStockName
        );
        if (targetStock && targetStock.stock_count > 0) {
          const nextCount = targetStock.stock_count - 1;
          await supabase
            .from("equipment_stock")
            .update({ stock_count: nextCount })
            .eq("id", targetStock.id);
          setStockItems((prev) =>
            prev.map((s) =>
              s.id === targetStock.id ? { ...s, stock_count: nextCount } : s
            )
          );
        }
      }

      setJerseyNo("");
      onStatus(`✅ ${handoverLabel} kaydı oluşturuldu.`);
    }
  }

  const selectedSetObj = jerseySets.find((j) => j.id === selJerseySet);
  const selectedSetPieces = Array.isArray(selectedSetObj?.items)
    ? selectedSetObj.items
    : [];

  return (
    <div className="space-y-6 text-slate-900">
      <form
        onSubmit={handleAddStock}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"
      >
        <h3 className="text-base font-extrabold text-[#02274c]">
          Yeni Malzeme / Ürün Stoğu Ekle
        </h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Ürün Adı (Örn: Yağmurluk)"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
          <input
            type="text"
            placeholder="Kategori (Dış Giyim, Çanta...)"
            value={prodCat}
            onChange={(e) => setProdCat(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
          <input
            type="number"
            placeholder="Stok Adedi"
            value={prodCount}
            onChange={(e) => setProdCount(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
          <input
            type="text"
            placeholder="Bedenler (Örn: S, M, L, XL)"
            value={prodSizeInfo}
            onChange={(e) => setProdSizeInfo(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProdPhotoFile(e.target.files?.[0] || null)}
            className="text-xs text-slate-700"
          />
          <button
            type="submit"
            disabled={savingStock}
            className="px-6 min-h-[44px] rounded-xl bg-[#02274c] text-white font-extrabold text-sm cursor-pointer"
          >
            {savingStock ? "Ekleniyor..." : "Yeni Ürün Stoğu Ekle"}
          </button>
        </div>
      </form>

      {editingStock && (
        <form
          onSubmit={handleSaveStockEdit}
          className="bg-white rounded-2xl border-2 border-[#a60513] p-5 space-y-3"
        >
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-[#02274c] text-sm">
              Ürün Düzenle: {editingStock.product_name}
            </h4>
            <button
              type="button"
              onClick={() => setEditingStock(null)}
              className="text-xs text-slate-600 underline"
            >
              Vazgeç
            </button>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={editingStock.product_name}
              onChange={(e) =>
                setEditingStock({
                  ...editingStock,
                  product_name: e.target.value,
                })
              }
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="text"
              value={editingStock.category}
              onChange={(e) =>
                setEditingStock({ ...editingStock, category: e.target.value })
              }
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="number"
              value={editingStock.stock_count}
              onChange={(e) =>
                setEditingStock({
                  ...editingStock,
                  stock_count: Number(e.target.value),
                })
              }
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="text"
              placeholder="Bedenler (S, M, L...)"
              value={editingStock.size_info || ""}
              onChange={(e) =>
                setEditingStock({ ...editingStock, size_info: e.target.value })
              }
              className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
          >
            ✓ Değişiklikleri Kaydet
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stockItems.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            {s.photo_url ? (
              <img
                src={s.photo_url}
                alt={s.product_name}
                className="w-full h-36 object-cover bg-slate-100"
              />
            ) : (
              <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                Görsel Yok
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold text-[#a60513] uppercase">
                    {s.category}
                  </span>
                  <h4 className="font-extrabold text-[#02274c]">
                    {s.product_name}
                  </h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-extrabold text-slate-800">
                  {s.stock_count} adet
                </span>
              </div>
              {s.size_info && (
                <p className="text-xs text-slate-600">
                  Bedenler: {s.size_info}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingStock({ ...s })}
                  className="px-2.5 py-1 rounded-lg bg-[#02274c] text-white text-xs font-bold cursor-pointer"
                >
                  ✏️ Düzenle
                </button>
                <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">
                  📷 Görsel {s.photo_url ? "Değiştir" : "Ekle"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadStockPhotoAfter(s.id, f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteStock(s.id, s.product_name)}
                  className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 text-xs font-bold cursor-pointer ml-auto"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleGiveItem}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <h3 className="text-lg font-extrabold text-[#02274c]">
          Oyuncuya Forma / Malzeme Teslim Et
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGiveMode("forma")}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold cursor-pointer ${
              giveMode === "forma"
                ? "bg-[#a60513] text-white"
                : "border border-slate-300 bg-white text-slate-800"
            }`}
          >
            Forma Ver
          </button>
          <button
            type="button"
            onClick={() => setGiveMode("malzeme")}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold cursor-pointer ${
              giveMode === "malzeme"
                ? "bg-[#a60513] text-white"
                : "border border-slate-300 bg-white text-slate-800"
            }`}
          >
            Yağmurluk / Eşofman / Malzeme Ver
          </button>
        </div>

        <div className="grid sm:grid-cols-6 gap-3">
          <select
            value={selPlayer}
            onChange={(e) => setSelPlayer(e.target.value)}
            className="sm:col-span-2 min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.age_group} - {p.full_name}
              </option>
            ))}
          </select>

          <select
            value={handoverType}
            onChange={(e) =>
              setHandoverType(e.target.value as "emanet" | "tam_teslim")
            }
            className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
          >
            <option value="emanet">🔄 Emanet</option>
            <option value="tam_teslim">✅ Tam Teslim</option>
          </select>

          {giveMode === "forma" ? (
            <select
              value={selJerseySet}
              onChange={(e) => setSelJerseySet(e.target.value)}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
            >
              {jerseySets.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.set_name} ({j.kit_type})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selStockName}
              onChange={(e) => setSelStockName(e.target.value)}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
            >
              {stockItems.map((s) => (
                <option key={s.id} value={s.product_name}>
                  {s.product_name} ({s.stock_count})
                </option>
              ))}
            </select>
          )}

          {giveMode === "forma" && selectedSetPieces.length > 0 ? (
            <select
              value={jerseyNo}
              onChange={(e) => {
                const num = e.target.value;
                setJerseyNo(num);
                const found = selectedSetPieces.find(
                  (x) => String(x.number) === num
                );
                if (found) setItemSize(found.size || "M");
              }}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
            >
              <option value="">-- Forma No Seç --</option>
              {selectedSetPieces.map((piece) => {
                const assignedLog = logs.find(
                  (l) =>
                    l.status === "teslim_edildi" &&
                    l.jersey_set_id === selJerseySet &&
                    l.jersey_number_given === piece.number
                );
                const holder = assignedLog
                  ? players.find((p) => p.id === assignedLog.player_id)
                  : null;
                return (
                  <option key={piece.id} value={piece.number}>
                    #{piece.number} ({piece.size || "M"}){" "}
                    {piece.is_goalkeeper ? "🧤 Kaleci" : ""}{" "}
                    {holder ? `[Zimmetli: ${holder.full_name}]` : "[Boşta]"}
                  </option>
                );
              })}
            </select>
          ) : (
            giveMode === "forma" && (
              <input
                type="number"
                placeholder="Forma Numarası"
                value={jerseyNo}
                onChange={(e) => setJerseyNo(e.target.value)}
                className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 text-sm"
              />
            )
          )}

          <select
            value={itemSize}
            onChange={(e) => setItemSize(e.target.value)}
            className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
          >
            {SIZE_OPTIONS.map((sz) => (
              <option key={sz} value={sz}>
                Beden: {sz}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-6 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm cursor-pointer"
        >
          {handoverType === "emanet" ? "Emanet Olarak Ver" : "Tam Teslim Et"}
        </button>
      </form>
    </div>
  );
}