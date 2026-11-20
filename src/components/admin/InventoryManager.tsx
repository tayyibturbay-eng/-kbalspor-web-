"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: string;
  full_name: string;
  age_group: string;
  parent_phone: string | null;
}

interface JerseySet {
  id: string;
  set_name: string;
  kit_type: "Ev" | "Deplasman" | "Alternatif" | "Özel";
  photo_url: string | null;
  total_quantity: number;
}

interface StockItem {
  id: string;
  product_name: string;
  category: string;
  stock_count: number;
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

function waLink(phone: string | null | undefined, text: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function InventoryManager({ players }: { players: Player[] }) {
  const [subTab, setSubTab] = useState<"jerseys" | "stock" | "unreturned" | "missing">("jerseys");

  const [jerseySets, setJerseySets] = useState<JerseySet[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);

  // Yeni Forma Takımı Formu
  const [setName, setSetName] = useState("");
  const [kitType, setKitType] = useState<JerseySet["kit_type"]>("Ev");
  const [setQty, setSetQty] = useState("20");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingSet, setSavingSet] = useState(false);

  // Yeni Stok Ürünü Formu
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("Dış Giyim");
  const [prodCount, setProdCount] = useState("20");

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
      const ext = photoFile.name.split(".").pop() || "jpg";
      const filePath = `${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("jersey-photos")
        .upload(filePath, photoFile);
      if (!upErr) {
        const { data: pub } = supabase.storage.from("jersey-photos").getPublicUrl(filePath);
        photoUrl = pub.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("jersey_sets")
      .insert({
        set_name: setName.trim(),
        kit_type: kitType,
        total_quantity: Number(setQty) || 20,
        photo_url: photoUrl,
      })
      .select()
      .single();

    setSavingSet(false);
    if (!error && data) {
      setJerseySets((prev) => [data as JerseySet, ...prev]);
      setSetName("");
      setPhotoFile(null);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("equipment_stock")
      .insert({
        product_name: prodName.trim(),
        category: prodCat,
        stock_count: Number(prodCount) || 0,
      })
      .select()
      .single();
    if (!error && data) {
      setStockItems((prev) => [...prev, data as StockItem]);
      setProdName("");
    }
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
      sender_name: "Yönetim (Malzeme Takip)",
      age_group: player.age_group,
      message_text: `${player.full_name}: ${text}`,
    });
    alert(`${player.full_name} için kulüp mesajı/bildirimi yayınlandı.`);
  };

  const unreturnedLogs = logs.filter((l) => l.status === "teslim_edildi");
  const missingLogs = logs.filter((l) => l.status === "kayip_eksik");

  return (
    <div className="space-y-6">
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
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border ${
              subTab === item.k
                ? "bg-[#02274c] text-white border-[#02274c]"
                : "bg-white text-[#02274c] border-slate-300"
            }`}
          >
            {item.l}
          </button>
        ))}
      </div>

      {/* 1. FORMA TAKIMLARI (EV / DEPLASMAN / ALTERNATİF + FOTOĞRAF) */}
      {subTab === "jerseys" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateJerseySet} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-4 gap-3">
            <input type="text" required placeholder="Forma Takımı Adı (Örn: 2026 Çubuklu)" value={setName} onChange={(e) => setSetName(e.target.value)} className="sm:col-span-2 min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
            <select value={kitType} onChange={(e) => setKitType(e.target.value as JerseySet["kit_type"])} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
              <option value="Ev">Ev Forması</option>
              <option value="Deplasman">Deplasman Forması</option>
              <option value="Alternatif">Alternatif Forma</option>
              <option value="Özel">Özel Seri</option>
            </select>
            <input type="number" placeholder="Adet" value={setQty} onChange={(e) => setSetQty(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="sm:col-span-2 text-sm" />
            <button type="submit" disabled={savingSet} className="sm:col-span-2 min-h-[46px] rounded-xl bg-[#a60513] text-white font-extrabold">
              {savingSet ? "Yükleniyor..." : "Forma Takımı Ekle"}
            </button>
          </form>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jerseySets.map((j) => (
              <div key={j.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {j.photo_url ? (
                  <img src={j.photo_url} alt={j.set_name} className="w-full h-44 object-cover bg-slate-100" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-r from-[#02274c] to-[#a60513] flex items-center justify-center text-white font-black">
                    {j.kit_type} Forması
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <span className="px-2.5 py-0.5 rounded bg-[#02274c] text-white text-xs font-extrabold">{j.kit_type}</span>
                  <h3 className="text-lg font-extrabold text-[#02274c]">{j.set_name}</h3>
                  <p className="text-xs text-slate-500">Takım Stoğu: {j.total_quantity} adet</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ÜRÜN STOĞU EKLEME & OYUNCUYA TESLİM */}
      {subTab === "stock" && (
        <div className="space-y-6">
          <form onSubmit={handleAddStock} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-4 gap-3">
            <input type="text" required placeholder="Yeni Ürün Adı (Örn: Yağmurluk)" value={prodName} onChange={(e) => setProdName(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
            <input type="text" placeholder="Kategori (Dış Giyim, Çanta...)" value={prodCat} onChange={(e) => setProdCat(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
            <input type="number" placeholder="Stok Adedi" value={prodCount} onChange={(e) => setProdCount(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
            <button type="submit" className="min-h-[46px] rounded-xl bg-[#02274c] text-white font-extrabold">Yeni Ürün Stoğu Ekle</button>
          </form>

          <form onSubmit={handleGiveItem} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#02274c]">Oyuncuya Forma / Malzeme Teslim Et</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => setGiveMode("forma")} className={`px-4 py-2 rounded-xl text-sm font-extrabold ${giveMode === "forma" ? "bg-[#a60513] text-white" : "border border-slate-300"}`}>Forma Ver</button>
              <button type="button" onClick={() => setGiveMode("malzeme")} className={`px-4 py-2 rounded-xl text-sm font-extrabold ${giveMode === "malzeme" ? "bg-[#a60513] text-white" : "border border-slate-300"}`}>Yağmurluk / Eşofman / Malzeme Ver</button>
            </div>

            <div className="grid sm:grid-cols-5 gap-3">
              <select value={selPlayer} onChange={(e) => setSelPlayer(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                {players.map((p) => <option key={p.id} value={p.id}>{p.age_group} - {p.full_name}</option>)}
              </select>

              {giveMode === "forma" ? (
                <select value={selJerseySet} onChange={(e) => setSelJerseySet(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                  {jerseySets.map((j) => <option key={j.id} value={j.id}>{j.set_name} ({j.kit_type})</option>)}
                </select>
              ) : (
                <select value={selStockName} onChange={(e) => setSelStockName(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                  {stockItems.map((s) => <option key={s.id} value={s.product_name}>{s.product_name} ({s.stock_count})</option>)}
                </select>
              )}

              <input type="text" placeholder="Beden (S, M, L...)" value={itemSize} onChange={(e) => setItemSize(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />

              {giveMode === "forma" && (
                <input type="number" placeholder="Forma Numarası" value={jerseyNo} onChange={(e) => setJerseyNo(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              )}

              <button type="submit" className="min-h-[46px] rounded-xl bg-emerald-600 text-white font-extrabold">Teslim Et</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. GERİ VERİLMEYENLER VE MESAJ GÖNDERME */}
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
                    <button type="button" onClick={() => updateLogStatus(l.id, "iade_edildi")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">İade Alındı</button>
                    <button type="button" onClick={() => updateLogStatus(l.id, "kayip_eksik")} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-extrabold">Kayıp / Eksik</button>
                    <button type="button" onClick={() => sendClubAlert(pl, `${l.item_name} iadesi beklenmektedir.`)} className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold">Bildirim Gönder</button>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold">WhatsApp</a>}
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
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-extrabold mr-2">KAYIP / EKSİK</span>
                    <strong className="text-[#02274c]">{pl?.full_name || "Oyuncu"}</strong> — {l.item_name} (Beden: {l.item_size || "-"}, No: {l.jersey_number_given ?? "-"})
                  </div>
                  <button type="button" onClick={() => updateLogStatus(l.id, "iade_edildi")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">Bulundu / İade Alındı</button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}