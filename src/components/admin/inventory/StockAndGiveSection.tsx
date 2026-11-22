"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_GROUPS,
  EquipmentLog,
  JerseyPiece,
  JerseySet,
  SIZE_OPTIONS,
  StockItem,
} from "@/types/club";

const supabase = createClient();

type MiniPlayer = {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
};

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

async function uploadPhoto(folder: "jerseys" | "stock", file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
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
  setJerseySets?: React.Dispatch<React.SetStateAction<JerseySet[]>>;
  stockItems: StockItem[];
  setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  logs: EquipmentLog[];
  setLogs: React.Dispatch<React.SetStateAction<EquipmentLog[]>>;
  onStatus: (msg: string) => void;
}

export function StockAndGiveSection({
  players,
  jerseySets,
  setJerseySets,
  stockItems,
  setStockItems,
  logs,
  setLogs,
  onStatus,
}: StockAndGiveSectionProps) {
  const [createType, setCreateType] = useState<"forma_takimi" | "malzeme_stok">(
    "forma_takimi"
  );

  const [setName, setSetName] = useState("");
  const [kitType, setKitType] = useState<JerseySet["kit_type"]>("Ev");
  const [setQty, setSetQty] = useState("20");
  const [defaultJerseySize, setDefaultJerseySize] = useState("M");
  const [gkDefault1And12, setGkDefault1And12] = useState(true);
  const [setPhotoFile, setSetPhotoFile] = useState<File | null>(null);

  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("Dış Giyim");
  const [prodCount, setProdCount] = useState("20");
  const [prodSizeInfo, setProdSizeInfo] = useState("S, M, L, XL");
  const [hasNumberField, setHasNumberField] = useState(false);
  const [prodNumberInfo, setProdNumberInfo] = useState("");
  const [prodPhotoFile, setProdPhotoFile] = useState<File | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [missingQtyById, setMissingQtyById] = useState<Record<string, number>>({});

  const [playerCategoryFilter, setPlayerCategoryFilter] = useState<string>("Tümü");
  const [playerQuery, setPlayerQuery] = useState<string>("");

  const [selPlayer, setSelPlayer] = useState("");
  const [giveMode, setGiveMode] = useState<"forma" | "malzeme">("forma");
  const [handoverType, setHandoverType] = useState<"emanet" | "tam_teslim">("emanet");
  const [selJerseySet, setSelJerseySet] = useState("");
  const [selStockName, setSelStockName] = useState("Yağmurluk");
  const [itemSize, setItemSize] = useState("M");
  const [jerseyNo, setJerseyNo] = useState("");

  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLocaleLowerCase("tr-TR");
    return players.filter((p) => {
      const catOk =
        playerCategoryFilter === "Tümü" || p.age_group === playerCategoryFilter;
      const nameOk = !q || p.full_name.toLocaleLowerCase("tr-TR").includes(q);
      return catOk && nameOk;
    });
  }, [players, playerCategoryFilter, playerQuery]);

  const effectivePlayerId = useMemo(() => {
    if (filteredPlayers.length === 0) return "";
    return filteredPlayers.some((p) => p.id === selPlayer)
      ? selPlayer
      : filteredPlayers[0].id;
  }, [filteredPlayers, selPlayer]);

  const effectiveJerseySetId = useMemo(() => {
    if (jerseySets.length === 0) return "";
    return jerseySets.some((j) => j.id === selJerseySet)
      ? selJerseySet
      : jerseySets[0].id;
  }, [jerseySets, selJerseySet]);

  const effectiveStockName = useMemo(() => {
    if (stockItems.length === 0) return selStockName;
    return stockItems.some((s) => s.product_name === selStockName)
      ? selStockName
      : stockItems[0].product_name;
  }, [stockItems, selStockName]);

  async function handleUnifiedCreate(e: React.FormEvent) {
    e.preventDefault();
    setSavingCreate(true);

    try {
      if (createType === "forma_takimi") {
        if (!setName.trim()) return;
        let photoUrl: string | null = null;
        if (setPhotoFile) {
          photoUrl = await uploadPhoto("jerseys", setPhotoFile);
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

        if (error) {
          onStatus("Forma takımı eklenemedi: " + error.message);
          return;
        }
        if (data) {
          const created = data as JerseySet;
          setJerseySets?.((prev) => [created, ...prev]);
          setSelJerseySet(created.id);
          setSetName("");
          setSetPhotoFile(null);
          onStatus(
            `✅ ${created.set_name} forma takımı eklendi (1-${created.total_quantity}).`
          );
        }
      } else {
        if (!prodName.trim()) return;
        let photoUrl: string | null = null;
        if (prodPhotoFile) {
          photoUrl = await uploadPhoto("stock", prodPhotoFile);
        }

        const numNote =
          hasNumberField && prodNumberInfo.trim()
            ? ` [No: ${prodNumberInfo.trim()}]`
            : "";

        const { data, error } = await supabase
          .from("equipment_stock")
          .insert({
            product_name: `${prodName.trim()}${numNote}`,
            category: prodCat.trim() || "Malzeme",
            stock_count: Number(prodCount) || 0,
            size_info: prodSizeInfo.trim() || null,
            photo_url: photoUrl,
          })
          .select()
          .single();

        if (error) {
          onStatus("Ürün eklenemedi: " + error.message);
          return;
        }
        if (data) {
          const createdStock = data as StockItem;
          setStockItems((prev) => [...prev, createdStock]);
          setSelStockName(createdStock.product_name);
          setProdName("");
          setProdNumberInfo("");
          setHasNumberField(false);
          setProdPhotoFile(null);
          onStatus("✅ Yeni malzeme stoğu eklendi.");
        }
      }
    } finally {
      setSavingCreate(false);
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
    const url = await uploadPhoto("stock", file);
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

  async function handleMarkStockMissing(stockItem: StockItem) {
    const targetPlayerId = effectivePlayerId || players[0]?.id;
    if (!targetPlayerId) {
      onStatus("Eksik/kayıp kaydı için önce en az 1 sporcu kaydı bulunmalıdır.");
      return;
    }

    const { data, error } = await supabase
      .from("equipment_logs")
      .insert({
        player_id: targetPlayerId,
        jersey_set_id: null,
        item_name: stockItem.product_name,
        item_size: stockItem.size_info || "M",
        jersey_number_given: null,
        category: "Malzeme",
        status: "kayip_eksik",
      })
      .select()
      .single();

    if (error) {
      onStatus("Eksik/kayıp kaydı açılamadı: " + error.message);
      return;
    }
    if (data) {
      setLogs((prev) => [data as EquipmentLog, ...prev]);
      onStatus(`⚠️ "${stockItem.product_name}" tekil olarak Eksik / Kayıp işaretlendi.`);
    }
  }

  async function handleGiveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!effectivePlayerId) return;
    const chosenSet = jerseySets.find((j) => j.id === effectiveJerseySetId);
    const parsedNum = jerseyNo.trim() ? Number(jerseyNo.trim()) : null;

    if (giveMode === "forma" && effectiveJerseySetId && parsedNum) {
      const existingHolderLog = logs.find(
        (l) =>
          l.status === "teslim_edildi" &&
          l.jersey_set_id === effectiveJerseySetId &&
          l.jersey_number_given === parsedNum
      );
      if (existingHolderLog) {
        const holder = players.find((p) => p.id === existingHolderLog.player_id);
        const proceed = confirm(
          `⚠️ #${parsedNum} numaralı forma şu an "${
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
            player_id: effectivePlayerId,
            jersey_set_id: effectiveJerseySetId || null,
            item_name: chosenSet
              ? `${chosenSet.set_name} (${chosenSet.kit_type}) [${handoverLabel}]`
              : `Forma [${handoverLabel}]`,
            item_size: itemSize.trim() || "M",
            jersey_number_given: parsedNum,
            category: "Forma",
            status: "teslim_edildi",
          }
        : {
            player_id: effectivePlayerId,
            jersey_set_id: null,
            item_name: `${effectiveStockName}${
              parsedNum ? ` #${parsedNum}` : ""
            } [${handoverLabel}]`,
            item_size: itemSize.trim() || "M",
            jersey_number_given: parsedNum,
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
          (s) => s.product_name === effectiveStockName
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

  const selectedSetObj = jerseySets.find((j) => j.id === effectiveJerseySetId);
  const selectedSetPieces = Array.isArray(selectedSetObj?.items)
    ? selectedSetObj.items
    : [];

  return (
    <div className="space-y-6 text-slate-900">
      <form
        onSubmit={handleGiveItem}
        className="bg-white rounded-2xl border-2 border-[#02274c]/25 p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-[#02274c]">
            ⚡ Hızlı Forma / Malzeme Teslim Et
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGiveMode("forma")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
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
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
                giveMode === "malzeme"
                  ? "bg-[#a60513] text-white"
                  : "border border-slate-300 bg-white text-slate-800"
              }`}
            >
              Diğer Malzeme Ver
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <select
            value={playerCategoryFilter}
            onChange={(e) => setPlayerCategoryFilter(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-[#02274c]"
          >
            <option value="Tümü">Kategori: Tüm Yaş Grupları</option>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            placeholder="Oyuncu adı yazarak hızlı bul..."
            className="sm:col-span-2 min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900"
          />
        </div>

        <div className="grid sm:grid-cols-6 gap-3">
          <select
            value={effectivePlayerId}
            onChange={(e) => setSelPlayer(e.target.value)}
            className="sm:col-span-2 min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
          >
            {filteredPlayers.length === 0 ? (
              <option value="">Eşleşen oyuncu bulunamadı</option>
            ) : (
              filteredPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.age_group} - {p.full_name}
                </option>
              ))
            )}
          </select>

          <select
            value={handoverType}
            onChange={(e) =>
              setHandoverType(e.target.value as "emanet" | "tam_teslim")
            }
            className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
          >
            <option value="emanet">🔄 Emanet</option>
            <option value="tam_teslim">✅ Tam Teslim</option>
          </select>

          {giveMode === "forma" ? (
            <select
              value={effectiveJerseySetId}
              onChange={(e) => setSelJerseySet(e.target.value)}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
            >
              {jerseySets.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.set_name} ({j.kit_type})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={effectiveStockName}
              onChange={(e) => setSelStockName(e.target.value)}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
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
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
            >
              <option value="">-- Forma No Seç --</option>
              {selectedSetPieces.map((piece) => {
                const assignedLog = logs.find(
                  (l) =>
                    l.status === "teslim_edildi" &&
                    l.jersey_set_id === effectiveJerseySetId &&
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
            <input
              type="number"
              min={1}
              max={999}
              placeholder={
                giveMode === "forma"
                  ? "Forma Numarası"
                  : "Numara (Opsiyonel)"
              }
              value={jerseyNo}
              onChange={(e) => setJerseyNo(e.target.value)}
              className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 text-sm bg-white"
            />
          )}

          <select
            value={itemSize}
            onChange={(e) => setItemSize(e.target.value)}
            className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
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
          {handoverType === "emanet"
            ? "Emanet Olarak Ver"
            : "Tam Teslim Et"}
        </button>
      </form>

      <form
        onSubmit={handleUnifiedCreate}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#02274c]">
              Yeni Kayıt Ekle (Forma Takımı veya Malzeme Stok)
            </h3>
            <p className="text-xs text-slate-500">
              Eklemek istediğiniz türü seçin; diğer malzemelerde isterseniz numara bilgisi ekleyin.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreateType("forma_takimi")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                createType === "forma_takimi"
                  ? "bg-[#02274c] text-white"
                  : "border border-slate-300 bg-slate-50 text-slate-800"
              }`}
            >
              👕 Forma Takımı Oluştur
            </button>
            <button
              type="button"
              onClick={() => setCreateType("malzeme_stok")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                createType === "malzeme_stok"
                  ? "bg-[#a60513] text-white"
                  : "border border-slate-300 bg-slate-50 text-slate-800"
              }`}
            >
              📦 Yeni Malzeme Stok
            </button>
          </div>
        </div>

        {createType === "forma_takimi" ? (
          <>
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
                className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm bg-white"
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
                  className="w-full min-h-[42px] px-3 rounded-xl border-2 border-slate-300 text-sm font-bold bg-white"
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
                  onChange={(e) => setSetPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingCreate}
              className="px-6 min-h-[44px] rounded-xl bg-[#a60513] text-white font-extrabold text-sm cursor-pointer"
            >
              {savingCreate
                ? "Oluşturuluyor..."
                : "Forma Takımı Ekle (1'den Adede Numaralandır)"}
            </button>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Ürün Adı (Örn: Eşofman Takımı, Yağmurluk)"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="min-h-[44px] px-3 rounded-xl border-2 border-slate-300 text-sm"
              />
              <input
                type="text"
                placeholder="Kategori (Dış Giyim, Eşofman...)"
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setHasNumberField((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  hasNumberField
                    ? "bg-[#02274c] text-white border-[#02274c]"
                    : "bg-slate-50 text-[#02274c] border-slate-300"
                }`}
              >
                {hasNumberField ? "✕ Numara Alanını Kapat" : "+ Numara Ekle"}
              </button>

              {hasNumberField && (
                <input
                  type="text"
                  placeholder="Numara bilgisi girin (Örn: #1-#20 veya #5)"
                  value={prodNumberInfo}
                  onChange={(e) => setProdNumberInfo(e.target.value)}
                  className="min-h-[40px] px-3 rounded-xl border-2 border-[#02274c]/40 text-xs sm:text-sm font-bold text-[#02274c] bg-sky-50/40"
                />
              )}
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
                disabled={savingCreate}
                className="px-6 min-h-[44px] rounded-xl bg-[#02274c] text-white font-extrabold text-sm cursor-pointer"
              >
                {savingCreate ? "Ekleniyor..." : "Yeni Ürün Stoğu Ekle"}
              </button>
            </div>
          </>
        )}
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
              className="text-xs text-slate-600 underline cursor-pointer"
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
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
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

              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                <button
                  type="button"
                  onClick={() => setEditingStock({ ...s })}
                  className="px-2.5 py-1 rounded-lg bg-[#02274c] text-white text-xs font-bold cursor-pointer"
                >
                  ✏️ Düzenle
                </button>
                                <div className="inline-flex items-center gap-1">
                  <select
                    aria-label={`${s.product_name} eksik/kayıp adet`}
                    value={missingQtyById[s.id] || 1}
                    onChange={(e) =>
                      setMissingQtyById((prev) => ({
                        ...prev,
                        [s.id]: Number(e.target.value) || 1,
                      }))
                    }
                    className="rounded-lg border border-amber-300 bg-white text-slate-900 px-2 py-1 text-xs font-extrabold"
                  >
                    {Array.from(
                      { length: Math.max(1, Number(s.stock_count) || 1) },
                      (_, idx) => idx + 1
                    ).map((qtyVal) => (
                      <option key={qtyVal} value={qtyVal}>
                        {qtyVal} Adet
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleMarkStockMissing(s)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-extrabold cursor-pointer"
                  >
                    ⚠️ Eksik / Kayıp
                  </button>
                </div>
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
    </div>
  );
}