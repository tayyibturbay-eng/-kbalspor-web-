"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
}

export interface JerseyPiece {
  id: string;
  number: number;
  size: string;
  is_goalkeeper: boolean;
}

interface JerseySet {
  id: string;
  set_name: string;
  kit_type: "Ev" | "Deplasman" | "Alternatif" | "Özel";
  photo_url: string | null;
  total_quantity: number;
  items?: JerseyPiece[] | null;
}

interface StockItem {
  id: string;
  product_name: string;
  category: string;
  stock_count: number;
  photo_url?: string | null;
  size_info?: string | null;
}

interface EquipmentLog {
  id: string;
  player_id: string;
  jersey_set_id: string | null;
  item_name: string;
  item_size: string | null;
  jersey_number_given: number | null;
  category: string | null;
  given_date: string;
  status: "teslim_edildi" | "iade_edildi" | "kayip_eksik";
}

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

function waLink(phone: string | null | undefined, text: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function buildDefaultPieces(qty: number, defaultSize: string, defaultGk1And12: boolean): JerseyPiece[] {
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

async function uploadEquipmentPhoto(file: File, folder: string): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("jersey-photos").upload(filePath, file);
  if (upErr) return null;
  const { data: pub } = supabase.storage.from("jersey-photos").getPublicUrl(filePath);
  return pub.publicUrl;
}

export function InventoryManager({ players }: { players: Player[] }) {
  const [subTab, setSubTab] = useState<"jerseys" | "stock" | "unreturned" | "missing">("jerseys");

  const [jerseySets, setJerseySets] = useState<JerseySet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Yeni Forma Takımı Formu
  const [setName, setSetName] = useState("");
  const [kitType, setKitType] = useState<JerseySet["kit_type"]>("Ev");
  const [setQty, setSetQty] = useState("20");
  const [defaultJerseySize, setDefaultJerseySize] = useState("M");
  const [gkDefault1And12, setGkDefault1And12] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingSet, setSavingSet] = useState(false);

  // Forma Takımı Düzenleme Modal / Alanı
  const [editingSet, setEditingSet] = useState<JerseySet | null>(null);
  const [editingPieces, setEditingPieces] = useState<JerseyPiece[]>([]);
  const [savingSetEdit, setSavingSetEdit] = useState(false);

  // Yeni Stok Ürünü Formu
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("Dış Giyim");
  const [prodCount, setProdCount] = useState("20");
  const [prodSizeInfo, setProdSizeInfo] = useState("S, M, L, XL");
  const [prodPhotoFile, setProdPhotoFile] = useState<File | null>(null);
  const [savingStock, setSavingStock] = useState(false);

  // Stok Ürünü Düzenleme
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);

  // Teslim Formu
  const [selPlayer, setSelPlayer] = useState("");
  const [giveMode, setGiveMode] = useState<"forma" | "malzeme">("forma");
  const [selJerseySet, setSelJerseySet] = useState("");
  const [selStockName, setSelStockName] = useState("Yağmurluk");
  const [itemSize, setItemSize] = useState("M");
  const [jerseyNo, setJerseyNo] = useState("");

  const loadData = async () => {
    const supabase = createClient();
    const [jRes, sRes, lRes] = await Promise.all([
      supabase.from("jersey_sets").select("*").order("created_at", { ascending: false }),
      supabase.from("equipment_stock").select("*").order("product_name", { ascending: true }),
      supabase.from("equipment_logs").select("*").order("created_at", { ascending: false }),
    ]);
    if (jRes.data) {
      setJerseySets(jRes.data as JerseySet[]);
      if (jRes.data.length > 0) setSelJerseySet((p) => p || jRes.data[0].id);
    }
    if (sRes.data) {
      setStockItems(sRes.data as StockItem[]);
      if (sRes.data.length > 0) setSelStockName((p) => p || sRes.data[0].product_name);
    }
    if (lRes.data) setLogs(lRes.data as EquipmentLog[]);
  };

  useEffect(() => {
    loadData();
    if (players.length > 0 && !selPlayer) setSelPlayer(players[0].id);
  }, [players]);

  const handleCreateJerseySet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName.trim()) return;
    setSavingSet(true);
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadEquipmentPhoto(photoFile, "jerseys");
    }

    const qty = Number(setQty) || 20;
    const generatedItems = buildDefaultPieces(qty, defaultJerseySize, gkDefault1And12);

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
      setStatusMsg("Forma takımı eklenemedi: " + error.message);
      return;
    }
    if (data) {
      const created = data as JerseySet;
      setJerseySets((prev) => [created, ...prev]);
      setSetName("");
      setPhotoFile(null);
      setStatusMsg(`✅ ${created.set_name} eklendi (1-${created.total_quantity} numaralandırıldı). İsterseniz tek tek numara ve beden düzenleyebilirsiniz.`);
      openEditSet(created);
    }
  };

  const openEditSet = (setItem: JerseySet) => {
    setEditingSet({ ...setItem });
    const existingPieces =
      Array.isArray(setItem.items) && setItem.items.length > 0
        ? setItem.items.map((x) => ({ ...x }))
        : buildDefaultPieces(setItem.total_quantity || 20, "M", true);
    setEditingPieces(existingPieces);
  };

  const handleSaveSetEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSet) return;
    setSavingSetEdit(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("jersey_sets")
      .update({
        set_name: editingSet.set_name.trim(),
        kit_type: editingSet.kit_type,
        total_quantity: editingPieces.length,
        items: editingPieces,
      })
      .eq("id", editingSet.id)
      .select()
      .single();

    setSavingSetEdit(false);
    if (error) {
      setStatusMsg("Güncelleme hatası: " + error.message);
      return;
    }
    if (data) {
      setJerseySets((prev) => prev.map((j) => (j.id === editingSet.id ? (data as JerseySet) : j)));
      setEditingSet(null);
      setStatusMsg("✅ Forma takımı, numaralar ve bedenler güncellendi.");
    }
  };

  const handleUploadSetPhotoAfter = async (setId: string, file: File) => {
    const url = await uploadEquipmentPhoto(file, "jerseys");
    if (!url) {
      setStatusMsg("Görsel yüklenemedi.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("jersey_sets").update({ photo_url: url }).eq("id", setId);
    if (!error) {
      setJerseySets((prev) => prev.map((j) => (j.id === setId ? { ...j, photo_url: url } : j)));
      if (editingSet?.id === setId) setEditingSet({ ...editingSet, photo_url: url });
      setStatusMsg("✅ Forma takımı görseli güncellendi.");
    }
  };

  const handleDeleteJerseySet = async (id: string, name: string) => {
    if (!confirm(`"${name}" forma takımını silmek istediğinize emin misiniz?`)) return;
    const supabase = createClient();
    await supabase.from("jersey_sets").delete().eq("id", id);
    setJerseySets((prev) => prev.filter((j) => j.id !== id));
    if (editingSet?.id === id) setEditingSet(null);
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setSavingStock(true);
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (prodPhotoFile) {
      photoUrl = await uploadEquipmentPhoto(prodPhotoFile, "stock");
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
      setStatusMsg("Ürün eklenemedi: " + error.message);
      return;
    }
    if (data) {
      setStockItems((prev) => [...prev, data as StockItem]);
      setProdName("");
      setProdPhotoFile(null);
      setStatusMsg("✅ Yeni malzeme stoğu eklendi.");
    }
  };

  const handleSaveStockEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock) return;
    const supabase = createClient();
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
      setStockItems((prev) => prev.map((s) => (s.id === editingStock.id ? (data as StockItem) : s)));
      setEditingStock(null);
      setStatusMsg("✅ Ürün bilgileri güncellendi.");
    }
  };

  const handleUploadStockPhotoAfter = async (stockId: string, file: File) => {
    const url = await uploadEquipmentPhoto(file, "stock");
    if (!url) {
      setStatusMsg("Görsel yüklenemedi.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("equipment_stock").update({ photo_url: url }).eq("id", stockId);
    if (!error) {
      setStockItems((prev) => prev.map((s) => (s.id === stockId ? { ...s, photo_url: url } : s)));
      setStatusMsg("✅ Ürün görseli güncellendi.");
    }
  };

  const handleDeleteStock = async (id: string, name: string) => {
    if (!confirm(`"${name}" ürününü silmek istediğinize emin misiniz?`)) return;
    const supabase = createClient();
    await supabase.from("equipment_stock").delete().eq("id", id);
    setStockItems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGiveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selPlayer) return;
    const supabase = createClient();
    const chosenSet = jerseySets.find((j) => j.id === selJerseySet);

    const payload =
      giveMode === "forma"
        ? {
            player_id: selPlayer,
            jersey_set_id: selJerseySet || null,
            item_name: chosenSet ? `${chosenSet.set_name} (${chosenSet.kit_type})` : "Forma",
            item_size: itemSize.trim() || null,
            jersey_number_given: jerseyNo ? Number(jerseyNo) : null,
            category: "Forma",
            status: "teslim_edildi",
          }
        : {
            player_id: selPlayer,
            jersey_set_id: null,
            item_name: selStockName,
            item_size: itemSize.trim() || null,
            jersey_number_given: null,
            category: "Malzeme",
            status: "teslim_edildi",
          };

    const { data, error } = await supabase.from("equipment_logs").insert(payload).select().single();
    if (!error && data) {
      setLogs((prev) => [data as EquipmentLog, ...prev]);
      setJerseyNo("");
      setStatusMsg("✅ Teslimat kaydedildi.");
    }
  };

  const updateLogStatus = async (id: string, status: EquipmentLog["status"]) => {
    const supabase = createClient();
    const { error } = await supabase.from("equipment_logs").update({ status }).eq("id", id);
    if (!error) setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const sendClubAlert = async (player: Player | undefined, text: string) => {
    if (!player) return;
    const supabase = createClient();
    await supabase.from("club_messages").insert({
      title: "⚠️ Malzeme İade Hatırlatması",
      body: `${player.full_name}: ${text}`,
      target_group: player.age_group,
      sender_name: "Yönetim (Malzeme Takip)",
    });
    alert(`${player.full_name} için kulüp mesajı/bildirimi yayınlandı.`);
  };

  const selectedSetObj = jerseySets.find((j) => j.id === selJerseySet);
  const selectedSetPieces = Array.isArray(selectedSetObj?.items) ? selectedSetObj.items : [];
  const unreturnedLogs = logs.filter((l) => l.status === "teslim_edildi");
  const missingLogs = logs.filter((l) => l.status === "kayip_eksik");

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex justify-between items-center">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="underline ml-3">
            Kapat
          </button>
        </div>
      )}

      {/* Alt Sekmeler */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: "jerseys", l: `Forma Takımları (${jerseySets.length})` },
          { k: "stock", l: `Ürün Stoğu & Teslim (${stockItems.length})` },
          { k: "unreturned", l: `Geri Verilmeyenler (${unreturnedLogs.length})` },
          { k: "missing", l: `Eksik / Kayıp (${missingLogs.length})` },
        ].map((item) => (
          <button
            key={item.k}
            type="button"
            onClick={() => setSubTab(item.k as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
              subTab === item.k
                ? "bg-[#02274c] text-white border-[#02274c]"
                : "bg-white text-[#02274c] border-slate-300"
            }`}
          >
            {item.l}
          </button>
        ))}
      </div>

      {/* 1. FORMA TAKIMLARI */}
      {subTab === "jerseys" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateJerseySet} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#02274c]">Yeni Forma Takımı Oluştur</h3>
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
                onChange={(e) => setKitType(e.target.value as JerseySet["kit_type"])}
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
                <label className="block text-xs font-bold text-slate-600 mb-1">Varsayılan Beden</label>
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

              <label className="flex items-center gap-2 text-xs font-bold text-[#02274c] bg-slate-50 p-3 rounded-xl border cursor-pointer">
                <input
                  type="checkbox"
                  checked={gkDefault1And12}
                  onChange={(e) => setGkDefault1And12(e.target.checked)}
                />
                🧤 1 ve 12 numaralar ön tanımlı Kaleci Forması olsun
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Forma Görseli (İsteğe Bağlı)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSet}
              className="w-full sm:w-auto px-6 min-h-[44px] rounded-xl bg-[#a60513] text-white font-extrabold text-sm cursor-pointer"
            >
              {savingSet ? "Oluşturuluyor..." : "Forma Takımı Ekle (1'den Adede Numaralandır)"}
            </button>
          </form>

          {/* TEK TEK FORMA NUMARASI / BEDEN / KALECİ DÜZENLEME PANELİ */}
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
                  className="text-xs font-bold text-slate-500 underline cursor-pointer"
                >
                  Kapat
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={editingSet.set_name}
                  onChange={(e) => setEditingSet({ ...editingSet, set_name: e.target.value })}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm font-bold"
                />
                <select
                  value={editingSet.kit_type}
                  onChange={(e) =>
                    setEditingSet({ ...editingSet, kit_type: e.target.value as JerseySet["kit_type"] })
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
                <p className="text-xs text-slate-600">
                  Her formanın numarasını (örn. 13 → 95), bedenini ve Kaleci durumunu tek tek değiştirebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setEditingPieces((prev) => [
                      ...prev,
                      {
                        id: `piece-${Date.now()}`,
                        number: prev.length > 0 ? Math.max(...prev.map((x) => x.number)) + 1 : 1,
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
                {editingPieces.map((piece, idx) => (
                  <div
                    key={piece.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                      piece.is_goalkeeper ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="w-16">
                      <label className="block text-[10px] font-bold text-slate-500">No</label>
                      <input
                        type="number"
                        value={piece.number}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingPieces((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, number: isNaN(val) ? 0 : val } : p))
                          );
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-[#02274c]"
                      />
                    </div>

                    <div className="w-20">
                      <label className="block text-[10px] font-bold text-slate-500">Beden</label>
                      <select
                        value={piece.size}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingPieces((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, size: val } : p))
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

                    <label className="flex items-center gap-1 text-[11px] font-extrabold text-slate-700 cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={piece.is_goalkeeper}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditingPieces((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, is_goalkeeper: checked } : p))
                          );
                        }}
                      />
                      🧤 Kaleci
                    </label>

                    <button
                      type="button"
                      onClick={() => setEditingPieces((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-auto mt-3 text-red-600 text-xs font-extrabold px-1.5 cursor-pointer"
                      title="Bu formayı çıkar"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={savingSetEdit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold cursor-pointer"
              >
                {savingSetEdit ? "Kaydediliyor..." : "✓ Forma Değişikliklerini Kaydet"}
              </button>
            </form>
          )}

          {/* FORMA TAKIMLARI LİSTESİ */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jerseySets.map((j) => {
              const pieces = Array.isArray(j.items) ? j.items : [];
              const gkList = pieces.filter((x) => x.is_goalkeeper).map((x) => `#${x.number}`);
              return (
                <div key={j.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  {j.photo_url ? (
                    <img src={j.photo_url} alt={j.set_name} className="w-full h-44 object-cover bg-slate-100" />
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
                      <h3 className="text-lg font-extrabold text-[#02274c]">{j.set_name}</h3>
                      <p className="text-xs text-slate-600">Takım Stoğu: {j.total_quantity} adet</p>
                      {pieces.length > 0 && (
                        <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                          <div>
                            <strong>Numaralar:</strong>{" "}
                            {pieces
                              .slice(0, 12)
                              .map((x) => `#${x.number}(${x.size})`)
                              .join(", ")}
                            {pieces.length > 12 ? ` ... (+${pieces.length - 12})` : ""}
                          </div>
                          {gkList.length > 0 && (
                            <div className="text-amber-800 font-bold">🧤 Kaleci Formaları: {gkList.join(", ")}</div>
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
                        ✏️ Numara / Beden Düzenle
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
                        className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-extrabold cursor-pointer ml-auto"
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
      )}

      {/* 2. ÜRÜN STOĞU EKLEME, DÜZENLEME & OYUNCUYA TESLİM */}
      {subTab === "stock" && (
        <div className="space-y-6">
          <form onSubmit={handleAddStock} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="text-base font-extrabold text-[#02274c]">Yeni Malzeme / Ürün Stoğu Ekle</h3>
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
                className="text-xs"
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
                <h4 className="font-extrabold text-[#02274c] text-sm">Ürün Düzenle: {editingStock.product_name}</h4>
                <button
                  type="button"
                  onClick={() => setEditingStock(null)}
                  className="text-xs text-slate-500 underline"
                >
                  Vazgeç
                </button>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={editingStock.product_name}
                  onChange={(e) => setEditingStock({ ...editingStock, product_name: e.target.value })}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  value={editingStock.category}
                  onChange={(e) => setEditingStock({ ...editingStock, category: e.target.value })}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="number"
                  value={editingStock.stock_count}
                  onChange={(e) => setEditingStock({ ...editingStock, stock_count: Number(e.target.value) })}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  placeholder="Bedenler (S, M, L...)"
                  value={editingStock.size_info || ""}
                  onChange={(e) => setEditingStock({ ...editingStock, size_info: e.target.value })}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">
                ✓ Değişiklikleri Kaydet
              </button>
            </form>
          )}

          {/* STOK ÜRÜNLERİ LİSTESİ (GÖRSEL EKLEME + TEK TEK DÜZENLEME) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.product_name} className="w-full h-36 object-cover bg-slate-100" />
                ) : (
                  <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                    Görsel Yok
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-[#a60513] uppercase">{s.category}</span>
                      <h4 className="font-extrabold text-[#02274c]">{s.product_name}</h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-extrabold text-slate-800">
                      {s.stock_count} adet
                    </span>
                  </div>
                  {s.size_info && <p className="text-xs text-slate-600">Bedenler: {s.size_info}</p>}

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
                      className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold cursor-pointer ml-auto"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* OYUNCUYA TESLİM FORMU */}
          <form onSubmit={handleGiveItem} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#02274c]">Oyuncuya Forma / Malzeme Teslim Et</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGiveMode("forma")}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold cursor-pointer ${
                  giveMode === "forma" ? "bg-[#a60513] text-white" : "border border-slate-300"
                }`}
              >
                Forma Ver
              </button>
              <button
                type="button"
                onClick={() => setGiveMode("malzeme")}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold cursor-pointer ${
                  giveMode === "malzeme" ? "bg-[#a60513] text-white" : "border border-slate-300"
                }`}
              >
                Yağmurluk / Eşofman / Malzeme Ver
              </button>
            </div>

            <div className="grid sm:grid-cols-5 gap-3">
              <select
                value={selPlayer}
                onChange={(e) => setSelPlayer(e.target.value)}
                className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.age_group} - {p.full_name}
                  </option>
                ))}
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
                    const found = selectedSetPieces.find((x) => String(x.number) === num);
                    if (found) setItemSize(found.size);
                  }}
                  className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold text-sm"
                >
                  <option value="">-- Forma No Seç --</option>
                  {selectedSetPieces.map((piece) => (
                    <option key={piece.id} value={piece.number}>
                      #{piece.number} ({piece.size}) {piece.is_goalkeeper ? "🧤 Kaleci" : ""}
                    </option>
                  ))}
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

              <input
                type="text"
                placeholder="Beden (S, M, L...)"
                value={itemSize}
                onChange={(e) => setItemSize(e.target.value)}
                className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 text-sm"
              />

              <button type="submit" className="min-h-[46px] rounded-xl bg-emerald-600 text-white font-extrabold text-sm cursor-pointer">
                Teslim Et
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. GERİ VERİLMEYENLER */}
      {subTab === "unreturned" && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
          {unreturnedLogs.length === 0 ? (
            <p className="p-6 text-slate-500 text-sm">Geri beklenen forma veya malzeme yok.</p>
          ) : (
            unreturnedLogs.map((l) => {
              const pl = players.find((p) => p.id === l.player_id);
              const wa = waLink(
                pl?.parent_phone,
                `Sayın Veli, ${pl?.full_name || ""} üzerinde bulunan ${l.item_name} (Beden: ${l.item_size || "-"}, No: ${l.jersey_number_given ?? "-"}) iadesi beklenmektedir.`
              );
              return (
                <div key={l.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-[#02274c]">{pl?.full_name || "Oyuncu"}</strong> — {l.item_name}
                    <span className="text-xs text-slate-600 ml-2">
                      Beden: <strong>{l.item_size || "-"}</strong>
                      {l.jersey_number_given ? ` • No: #${l.jersey_number_given}` : ""} • {l.given_date}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateLogStatus(l.id, "iade_edildi")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                    >
                      İade Alındı
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLogStatus(l.id, "kayip_eksik")}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-extrabold"
                    >
                      Kayıp / Eksik
                    </button>
                    <button
                      type="button"
                      onClick={() => sendClubAlert(pl, `${l.item_name} iadesi beklenmektedir.`)}
                      className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold"
                    >
                      Bildirim Gönder
                    </button>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. EKSİK / KAYIP FORMALAR */}
      {subTab === "missing" && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
          {missingLogs.length === 0 ? (
            <p className="p-6 text-slate-500 text-sm">Eksik veya kayıp olarak işaretlenen malzeme yok.</p>
          ) : (
            missingLogs.map((l) => {
              const pl = players.find((p) => p.id === l.player_id);
              return (
                <div key={l.id} className="p-4 flex flex-wrap items-center justify-between gap-3 bg-red-50/50">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-extrabold mr-2">
                      KAYIP / EKSİK
                    </span>
                    <strong className="text-[#02274c]">{pl?.full_name || "Oyuncu"}</strong> — {l.item_name} (Beden:{" "}
                    {l.item_size || "-"}, No: {l.jersey_number_given ?? "-"})
                  </div>
                  <button
                    type="button"
                    onClick={() => updateLogStatus(l.id, "iade_edildi")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                  >
                    Bulundu / İade Alındı
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}