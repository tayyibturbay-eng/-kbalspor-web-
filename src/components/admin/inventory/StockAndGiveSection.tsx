"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Player } from "@/types/club";

const supabase = createClient();

export interface JerseySetRecord {
  id: string;
  set_name: string;
  kit_type: string;
  size_label?: string | null;
  total_count: number;
  available_count: number;
  photo_url?: string | null;
}

export interface StockItemRecord {
  id: string;
  product_name: string;
  category: string;
  size_label?: string | null;
  item_number?: number | null;
  total_count: number;
  available_count: number;
  photo_url?: string | null;
}

export interface EquipmentLogRecord {
  id: string;
  player_id: string;
  item_type?: string | null;
  item_name: string;
  jersey_number?: number | null;
  size_label?: string | null;
  condition_status?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

interface JerseyUnitDetail {
  id: string;
  set_id: string;
  number: number;
  size: string;
  status: "Müsait" | "Teslim Edildi" | "Kayıp";
  assigned_to?: string;
}

interface StockAndGiveSectionProps {
  players: Player[];
  jerseySets: JerseySetRecord[];
  stockItems: StockItemRecord[];
  equipmentLogs: EquipmentLogRecord[];
  onRefresh: () => Promise<void>;
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Standart"] as const;
const ITEM_STATUSES: Array<"Müsait" | "Teslim Edildi" | "Kayıp"> = [
  "Müsait",
  "Teslim Edildi",
  "Kayıp",
];

function buildDefaultUnitsForSet(set: JerseySetRecord): JerseyUnitDetail[] {
  const count = Math.max(1, Number(set.total_count || 1));
  const defaultSize = set.size_label || "M";
  const unavailableCount = Math.max(
    0,
    count - Number(set.available_count ?? count)
  );
  return Array.from({ length: count }, (_, idx) => {
    const num = idx + 1;
    const isOut = idx < unavailableCount;
    return {
      id: `${set.id}-u-${num}`,
      set_id: set.id,
      number: num,
      size: defaultSize,
      status: isOut ? "Teslim Edildi" : "Müsait",
    };
  });
}

export function StockAndGiveSection({
  players,
  jerseySets,
  stockItems,
  equipmentLogs,
  onRefresh,
  onFeedback,
  onLogActivity,
}: StockAndGiveSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<"jerseys" | "other">(
    "jerseys"
  );

  // Yeni Forma Ekleme (Adet sorar, 1'den başlayarak otomatik numaralandırır)
  const [jerseyName, setJerseyName] = useState("");
  const [kitType, setKitType] = useState("İç Saha");
  const [jerseyQty, setJerseyQty] = useState("20");
  const [jerseyDefaultSize, setJerseyDefaultSize] = useState("M");
  const [jerseyPhotoUrl, setJerseyPhotoUrl] = useState("/logo-square.png");
  const [creatingJersey, setCreatingJersey] = useState(false);

  // Yeni Diğer Malzeme Ekleme (Yağmurluk, eşofman takımı vb. + opsiyonel numara)
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Eşofman Takımı");
  const [otherQty, setOtherQty] = useState("10");
  const [otherSize, setOtherSize] = useState("M");
  const [otherNumber, setOtherNumber] = useState("");
  const [otherPhotoUrl, setOtherPhotoUrl] = useState("/logo-square.png");
  const [creatingOther, setCreatingOther] = useState(false);

  // Beden / Numara / Durum Paneli (Forma veya diğer malzeme)
  const [detailTargetType, setDetailTargetType] = useState<"jersey" | "other">(
    "jersey"
  );
  const [selectedJerseyId, setSelectedJerseyId] = useState<string>("");
  const [selectedOtherId, setSelectedOtherId] = useState<string>("");
  const [jerseyUnitsMap, setJerseyUnitsMap] = useState<
    Record<string, JerseyUnitDetail[]>
  >({});
  const [customAddNumber, setCustomAddNumber] = useState("");
  const [customAddSize, setCustomAddSize] = useState("M");

  // Diğer malzeme numara / beden / durum düzenleme
  const [editOtherNum, setEditOtherNum] = useState("");
  const [editOtherSize, setEditOtherSize] = useState("M");
  const [editOtherStatus, setEditOtherStatus] = useState<
    "Müsait" | "Teslim Edildi" | "Kayıp"
  >("Müsait");

  // Teslim Etme / İade Alma
  const [ageFilter, setAgeFilter] = useState<string>("Tümü");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [deliverKind, setDeliverKind] = useState<"jersey" | "other">("jersey");
  const [deliverItemId, setDeliverItemId] = useState<string>("");
  const [deliverNumber, setDeliverNumber] = useState<string>("1");
  const [deliverSize, setDeliverSize] = useState<string>("M");
  const [deliverNotes, setDeliverNotes] = useState<string>("");
  const [delivering, setDelivering] = useState<boolean>(false);

  const loadUnitsFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("ikbal_jersey_units_v1");
      if (raw) {
        setJerseyUnitsMap(JSON.parse(raw) as Record<string, JerseyUnitDetail[]>);
      }
    } catch {
      // yoksay
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUnitsFromStorage();
      if (jerseySets.length > 0) {
        setSelectedJerseyId((prev) => prev || jerseySets[0].id);
        setDeliverItemId((prev) => prev || jerseySets[0].id);
      }
      if (stockItems.length > 0) {
        setSelectedOtherId((prev) => prev || stockItems[0].id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUnitsFromStorage, jerseySets, stockItems]);

  function saveUnitsMap(next: Record<string, JerseyUnitDetail[]>) {
    setJerseyUnitsMap(next);
    try {
      localStorage.setItem("ikbal_jersey_units_v1", JSON.stringify(next));
    } catch {
      // yoksay
    }
  }

  const activeJerseySet = useMemo(
    () =>
      jerseySets.find((j) => j.id === selectedJerseyId) || jerseySets[0] || null,
    [jerseySets, selectedJerseyId]
  );

  const activeOtherItem = useMemo(
    () =>
      stockItems.find((s) => s.id === selectedOtherId) || stockItems[0] || null,
    [stockItems, selectedOtherId]
  );

  const currentUnits: JerseyUnitDetail[] = useMemo(() => {
    if (!activeJerseySet) return [];
    const existing = jerseyUnitsMap[activeJerseySet.id];
    if (existing && existing.length > 0) return existing;
    return buildDefaultUnitsForSet(activeJerseySet);
  }, [activeJerseySet, jerseyUnitsMap]);

  async function handleUploadCover(
    file: File,
    setter: (url: string) => void
  ) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const filePath = `inventory/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("club-media")
      .upload(filePath, file, { upsert: true });

    if (!error) {
      const { data } = supabase.storage
        .from("club-media")
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        setter(data.publicUrl);
        onFeedback("Kapak görseli yüklendi.");
        return;
      }
    }

    setter(URL.createObjectURL(file));
    onFeedback("Kapak görseli önizleme bağlantısı oluşturuldu.");
  }

  async function handleCreateJersey(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(1, parseInt(jerseyQty, 10) || 1);
    const title =
      jerseyName.trim() || `${kitType} Forma Seti (${qty} Adet)`;

    setCreatingJersey(true);
    const { data, error } = await supabase
      .from("jersey_sets")
      .insert({
        set_name: title,
        kit_type: kitType,
        size_label: jerseyDefaultSize,
        total_count: qty,
        available_count: qty,
        photo_url: jerseyPhotoUrl.trim() || "/logo-square.png",
      })
      .select("*")
      .single();
    setCreatingJersey(false);

    if (error) {
      onFeedback("Forma eklenemedi: " + error.message);
      return;
    }

    const createdId = (data as { id?: string } | null)?.id;
    if (createdId) {
      const autoUnits: JerseyUnitDetail[] = Array.from(
        { length: qty },
        (_, idx) => ({
          id: `${createdId}-u-${idx + 1}`,
          set_id: createdId,
          number: idx + 1,
          size: jerseyDefaultSize,
          status: "Müsait",
        })
      );
      saveUnitsMap({ ...jerseyUnitsMap, [createdId]: autoUnits });
      setSelectedJerseyId(createdId);
      setDetailTargetType("jersey");
    }

    setJerseyName("");
    await onLogActivity(
      "Forma Ekleme",
      `${title} (${qty} adet, 1-${qty} otomatik numaralandırıldı)`
    );
    onFeedback(`${qty} adet forma 1'den ${qty}'e numaralandırılarak eklendi.`);
    await onRefresh();
  }

  async function handleCreateOtherItem(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(1, parseInt(otherQty, 10) || 1);
    const name = productName.trim() || `${category}`;
    const parsedNum = otherNumber.trim() ? parseInt(otherNumber, 10) : null;

    setCreatingOther(true);
    const { data, error } = await supabase
      .from("equipment_stock")
      .insert({
        product_name: name,
        category,
        size_label: otherSize,
        total_count: qty,
        available_count: qty,
        photo_url: otherPhotoUrl.trim() || "/logo-square.png",
      })
      .select("*")
      .single();
    setCreatingOther(false);

    if (error) {
      onFeedback("Malzeme eklenemedi: " + error.message);
      return;
    }

    const createdId = (data as { id?: string } | null)?.id;
    if (createdId && parsedNum !== null && !Number.isNaN(parsedNum)) {
      try {
        const metaRaw = localStorage.getItem("ikbal_other_meta_v1");
        const meta = metaRaw
          ? (JSON.parse(metaRaw) as Record<
              string,
              { number?: number | null; size?: string; status?: string }
            >)
          : {};
        meta[createdId] = {
          number: parsedNum,
          size: otherSize,
          status: "Müsait",
        };
        localStorage.setItem("ikbal_other_meta_v1", JSON.stringify(meta));
      } catch {
        // yoksay
      }
    }

    setProductName("");
    setOtherNumber("");
    await onLogActivity(
      "Malzeme Ekleme",
      `${name} (${category}, ${qty} adet${
        parsedNum ? `, No: #${parsedNum}` : ""
      })`
    );
    onFeedback(`${name} envantere eklendi.`);
    await onRefresh();
  }

  function handleAddCustomNumberUnit() {
    if (!activeJerseySet) return;
    const num = parseInt(customAddNumber, 10);
    if (Number.isNaN(num) || num <= 0) {
      onFeedback("Lütfen geçerli bir forma numarası girin (örn: 95).");
      return;
    }

    const list = [...currentUnits];
    if (list.some((u) => u.number === num)) {
      onFeedback(`#${num} numarası zaten listede mevcut.`);
      return;
    }

    list.push({
      id: `${activeJerseySet.id}-u-${num}-${Date.now()}`,
      set_id: activeJerseySet.id,
      number: num,
      size: customAddSize,
      status: "Müsait",
    });

    const nextMap = { ...jerseyUnitsMap, [activeJerseySet.id]: list };
    saveUnitsMap(nextMap);
    setCustomAddNumber("");
    onFeedback(`#${num} numaralı forma (${customAddSize}) eklendi.`);
  }

  function handleUpdateUnit(
    unitId: string,
    patch: Partial<JerseyUnitDetail>
  ) {
    if (!activeJerseySet) return;
    const updatedList = currentUnits.map((u) =>
      u.id === unitId ? { ...u, ...patch } : u
    );
    saveUnitsMap({ ...jerseyUnitsMap, [activeJerseySet.id]: updatedList });
  }

  function handleSaveOtherItemDetails() {
    if (!activeOtherItem) return;
    const numVal = editOtherNum.trim() ? parseInt(editOtherNum, 10) : null;
    try {
      const metaRaw = localStorage.getItem("ikbal_other_meta_v1");
      const meta = metaRaw
        ? (JSON.parse(metaRaw) as Record<
            string,
            { number?: number | null; size?: string; status?: string }
          >)
        : {};
      meta[activeOtherItem.id] = {
        number: numVal && !Number.isNaN(numVal) ? numVal : null,
        size: editOtherSize,
        status: editOtherStatus,
      };
      localStorage.setItem("ikbal_other_meta_v1", JSON.stringify(meta));
    } catch {
      // yoksay
    }
    void supabase
      .from("equipment_stock")
      .update({ size_label: editOtherSize })
      .eq("id", activeOtherItem.id);
    onFeedback(
      `${activeOtherItem.product_name} için numara/beden/durum güncellendi.`
    );
  }

  async function handleDeliverEquipment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlayerId) {
      onFeedback("Lütfen malzeme teslim edilecek sporcuyu seçin.");
      return;
    }

    const targetPlayer = players.find((p) => p.id === selectedPlayerId);
    const parsedNum = deliverNumber.trim() ? parseInt(deliverNumber, 10) : null;

    setDelivering(true);

    if (deliverKind === "jersey") {
      const setItem =
        jerseySets.find((j) => j.id === deliverItemId) || jerseySets[0];
      if (!setItem) {
        setDelivering(false);
        onFeedback("Teslim edilecek forma seti bulunamadı.");
        return;
      }

      const { error } = await supabase.from("equipment_logs").insert({
        player_id: selectedPlayerId,
        item_type: "Forma",
        item_name: setItem.set_name,
        jersey_number: parsedNum,
        size_label: deliverSize,
        condition_status: "İyi",
        status: "Teslim Edildi",
        notes: deliverNotes.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (!error) {
        const nextAvail = Math.max(0, Number(setItem.available_count ?? 0) - 1);
        await supabase
          .from("jersey_sets")
          .update({ available_count: nextAvail, size_label: deliverSize })
          .eq("id", setItem.id);

        const baseUnits =
          jerseyUnitsMap[setItem.id] && jerseyUnitsMap[setItem.id].length > 0
            ? [...jerseyUnitsMap[setItem.id]]
            : buildDefaultUnitsForSet(setItem);

        const matchedIdx =
          parsedNum !== null
            ? baseUnits.findIndex((u) => u.number === parsedNum)
            : -1;

        if (matchedIdx >= 0) {
          baseUnits[matchedIdx] = {
            ...baseUnits[matchedIdx],
            size: deliverSize,
            status: "Teslim Edildi",
            assigned_to: targetPlayer?.full_name,
          };
        } else if (parsedNum !== null) {
          baseUnits.push({
            id: `${setItem.id}-u-${parsedNum}`,
            set_id: setItem.id,
            number: parsedNum,
            size: deliverSize,
            status: "Teslim Edildi",
            assigned_to: targetPlayer?.full_name,
          });
        }
        saveUnitsMap({ ...jerseyUnitsMap, [setItem.id]: baseUnits });
      }

      setDelivering(false);
      if (error) {
        onFeedback("Teslim kaydedilemedi: " + error.message);
        return;
      }

      await onLogActivity(
        "Forma Teslimi",
        `${targetPlayer?.full_name || "Sporcu"} -> ${setItem.set_name}${
          parsedNum ? ` #${parsedNum}` : ""
        } (Beden: ${deliverSize})`
      );
      onFeedback("Forma teslim edildi ve seçilen beden kaydedildi.");
      setDeliverNotes("");
      await onRefresh();
      return;
    }

    const stockItem =
      stockItems.find((s) => s.id === deliverItemId) || stockItems[0];
    if (!stockItem) {
      setDelivering(false);
      onFeedback("Teslim edilecek malzeme bulunamadı.");
      return;
    }

    const { error } = await supabase.from("equipment_logs").insert({
      player_id: selectedPlayerId,
      item_type: stockItem.category || "Ekipman",
      item_name: stockItem.product_name,
      jersey_number: parsedNum,
      size_label: deliverSize,
      condition_status: "İyi",
      status: "Teslim Edildi",
      notes: deliverNotes.trim() || null,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      const nextAvail = Math.max(0, Number(stockItem.available_count ?? 0) - 1);
      await supabase
        .from("equipment_stock")
        .update({ available_count: nextAvail, size_label: deliverSize })
        .eq("id", stockItem.id);
    }

    setDelivering(false);
    if (error) {
      onFeedback("Teslim kaydedilemedi: " + error.message);
      return;
    }

    await onLogActivity(
      "Malzeme Teslimi",
      `${targetPlayer?.full_name || "Sporcu"} -> ${stockItem.product_name}${
        parsedNum ? ` #${parsedNum}` : ""
      } (Beden: ${deliverSize})`
    );
    onFeedback("Malzeme teslim edildi.");
    setDeliverNotes("");
    await onRefresh();
  }

  // İade alındığında teslimde seçilen son beden envanterde korunur!
  async function handleReturnLog(log: EquipmentLogRecord) {
    const keptSize = log.size_label || "M";
    const { error } = await supabase
      .from("equipment_logs")
      .update({ status: "İade Edildi", size_label: keptSize })
      .eq("id", log.id);

    if (error) {
      onFeedback("İade alınamadı: " + error.message);
      return;
    }

    const matchedJersey = jerseySets.find((j) => j.set_name === log.item_name);
    if (matchedJersey) {
      const nextAvail = Math.min(
        matchedJersey.total_count,
        Number(matchedJersey.available_count ?? 0) + 1
      );
      await supabase
        .from("jersey_sets")
        .update({ available_count: nextAvail, size_label: keptSize })
        .eq("id", matchedJersey.id);

      const units =
        jerseyUnitsMap[matchedJersey.id] &&
        jerseyUnitsMap[matchedJersey.id].length > 0
          ? [...jerseyUnitsMap[matchedJersey.id]]
          : buildDefaultUnitsForSet(matchedJersey);

      if (log.jersey_number) {
        const idx = units.findIndex((u) => u.number === log.jersey_number);
        if (idx >= 0) {
          units[idx] = {
            ...units[idx],
            size: keptSize,
            status: "Müsait",
            assigned_to: undefined,
          };
        }
      }
      saveUnitsMap({ ...jerseyUnitsMap, [matchedJersey.id]: units });
    } else {
      const matchedStock = stockItems.find(
        (s) => s.product_name === log.item_name
      );
      if (matchedStock) {
        const nextAvail = Math.min(
          matchedStock.total_count,
          Number(matchedStock.available_count ?? 0) + 1
        );
        await supabase
          .from("equipment_stock")
          .update({ available_count: nextAvail, size_label: keptSize })
          .eq("id", matchedStock.id);
      }
    }

    await onLogActivity(
      "Malzeme İadesi",
      `${log.item_name} iade alındı (Beden korundu: ${keptSize})`
    );
    onFeedback(`İade alındı. Forma/malzeme bedeni (${keptSize}) korundu.`);
    await onRefresh();
  }

  const filteredPlayers = useMemo(() => {
    if (ageFilter === "Tümü") return players;
    return players.filter((p) => p.age_group === ageFilter);
  }, [players, ageFilter]);

  const activeLogs = useMemo(
    () => equipmentLogs.filter((l) => l.status !== "İade Edildi"),
    [equipmentLogs]
  );

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      {/* Ortak Malzeme Paneli Sekmeleri */}
      <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">
            Ortak Forma &amp; Malzeme Envanter Paneli
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Formalar ve diğer malzemeler tek panel altında; kapak görseli,
            numaralandırma ve beden/numara/durum düzenleme aktif.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("jerseys")}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
              activeSubTab === "jerseys"
                ? "bg-[var(--brand-navy)] text-white"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
            }`}
          >
            Formalar ({jerseySets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("other")}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
              activeSubTab === "other"
                ? "bg-[var(--brand-red)] text-white"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
            }`}
          >
            Diğer Malzemeler ({stockItems.length})
          </button>
        </div>
      </div>

      {/* Sekme 1: Formalar */}
      {activeSubTab === "jerseys" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateJersey}
            className="lg:col-span-5 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-3.5"
          >
            <h3 className="text-base font-black">
              Yeni Forma Ekle (Otomatik 1&apos;den Numaralandır)
            </h3>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Forma Seti Adı
              </label>
              <input
                type="text"
                value={jerseyName}
                onChange={(e) => setJerseyName(e.target.value)}
                placeholder="Örn: U11 İç Saha Çubuklu"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Tür
                </label>
                <select
                  value={kitType}
                  onChange={(e) => setKitType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
                >
                  <option value="İç Saha">İç Saha</option>
                  <option value="Deplasman">Deplasman</option>
                  <option value="Alternatif">Alternatif</option>
                  <option value="Kaleci">Kaleci</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Adet *
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={jerseyQty}
                  onChange={(e) => setJerseyQty(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Varsayılan Beden
                </label>
                <select
                  value={jerseyDefaultSize}
                  onChange={(e) => setJerseyDefaultSize(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
                >
                  {SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Kapak Görseli
                </label>
                <label className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-[11px] font-extrabold cursor-pointer">
                  Görsel Yükle
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadCover(f, setJerseyPhotoUrl);
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src={jerseyPhotoUrl || "/logo-square.png"}
                  alt="Forma kapak önizleme"
                  className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)] bg-white shrink-0"
                />
                <input
                  type="text"
                  value={jerseyPhotoUrl}
                  onChange={(e) => setJerseyPhotoUrl(e.target.value)}
                  placeholder="/logo.png veya görsel URL"
                  className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingJersey}
              className="w-full py-2.5 rounded-xl bg-[var(--brand-navy)] hover:opacity-95 text-white text-xs font-black cursor-pointer"
            >
              {creatingJersey
                ? "Ekleniyor..."
                : "Formayı Adetle Ekle (1'den Numaralandır)"}
            </button>
          </form>

          {/* Forma Listesi & Beden / Numara / Durum Paneli */}
          <div className="lg:col-span-7 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black">
                Forma Setleri &amp; Beden / Numara / Durum Paneli
              </h3>
              <select
                value={activeJerseySet?.id || ""}
                onChange={(e) => {
                  setSelectedJerseyId(e.target.value);
                  setDetailTargetType("jersey");
                }}
                className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-bold"
              >
                {jerseySets.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.set_name} ({j.available_count}/{j.total_count})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {jerseySets.map((j) => (
                <button
                  type="button"
                  key={j.id}
                  onClick={() => {
                    setSelectedJerseyId(j.id);
                    setDetailTargetType("jersey");
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                    activeJerseySet?.id === j.id
                      ? "border-[var(--brand-navy)] bg-[var(--brand-navy-soft)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  }`}
                >
                  <img
                    src={j.photo_url || "/logo-square.png"}
                    alt={j.set_name}
                    className="w-12 h-12 rounded-xl object-cover bg-white border border-[var(--border-subtle)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black truncate">
                      {j.set_name}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {j.kit_type} • Beden: {j.size_label || "M"} • Stok:{" "}
                      {j.available_count}/{j.total_count}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activeJerseySet && detailTargetType === "jersey" && (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black">
                    {activeJerseySet.set_name} — Tekil Forma Beden / Numara /
                    Durum ({currentUnits.length} adet)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customAddNumber}
                      onChange={(e) => setCustomAddNumber(e.target.value)}
                      placeholder="No (örn: 95)"
                      className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold"
                    />
                    <select
                      value={customAddSize}
                      onChange={(e) => setCustomAddSize(e.target.value)}
                      className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-bold"
                    >
                      {SIZES.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCustomNumberUnit}
                      className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-xs font-extrabold cursor-pointer"
                    >
                      + Numara Ekle
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {currentUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-[var(--brand-ink)]">
                          #{unit.number}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={unit.number}
                          onChange={(e) => {
                            const nextNum = parseInt(e.target.value, 10);
                            if (!Number.isNaN(nextNum) && nextNum > 0) {
                              handleUpdateUnit(unit.id, { number: nextNum });
                            }
                          }}
                          className="w-16 rounded border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <select
                          value={unit.size}
                          onChange={(e) =>
                            handleUpdateUnit(unit.id, { size: e.target.value })
                          }
                          className="rounded border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-1.5 py-1 text-[11px] font-bold"
                        >
                          {SIZES.map((sz) => (
                            <option key={sz} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>

                        <select
                          value={unit.status}
                          onChange={(e) =>
                            handleUpdateUnit(unit.id, {
                              status: e.target.value as JerseyUnitDetail["status"],
                            })
                          }
                          className="rounded border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-1.5 py-1 text-[11px] font-bold"
                        >
                          {ITEM_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sekme 2: Diğer Malzemeler (Yağmurluk, Eşofman Takımı vb. + Numara/Beden/Durum) */}
      {activeSubTab === "other" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateOtherItem}
            className="lg:col-span-5 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-3.5"
          >
            <h3 className="text-base font-black">
              Yeni Malzeme Ekle (Yağmurluk, Eşofman Takımı vb.)
            </h3>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Malzeme Adı *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Örn: Kulüp Yağmurluğu veya Eşofman Takımı"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-2 text-xs font-bold"
                >
                  <option value="Eşofman Takımı">Eşofman Takımı</option>
                  <option value="Yağmurluk">Yağmurluk</option>
                  <option value="Antrenman Yeleği">Antrenman Yeleği</option>
                  <option value="Top">Top</option>
                  <option value="Çanta">Çanta</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Adet
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={otherQty}
                  onChange={(e) => setOtherQty(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-2 text-xs font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Beden
                </label>
                <select
                  value={otherSize}
                  onChange={(e) => setOtherSize(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-2 text-xs font-bold"
                >
                  {SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                  Numara (Ops.)
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={otherNumber}
                  onChange={(e) => setOtherNumber(e.target.value)}
                  placeholder="No"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Kapak Görseli
                </label>
                <label className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white text-[11px] font-extrabold cursor-pointer">
                  Görsel Yükle
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadCover(f, setOtherPhotoUrl);
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src={otherPhotoUrl || "/logo-square.png"}
                  alt="Malzeme kapak önizleme"
                  className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)] bg-white shrink-0"
                />
                <input
                  type="text"
                  value={otherPhotoUrl}
                  onChange={(e) => setOtherPhotoUrl(e.target.value)}
                  placeholder="/logo.png veya görsel URL"
                  className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingOther}
              className="w-full py-2.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-black cursor-pointer"
            >
              {creatingOther ? "Ekleniyor..." : "Malzemeyi Envantere Ekle"}
            </button>
          </form>

          {/* Diğer Malzemeler + Beden / Numara / Durum Paneli */}
          <div className="lg:col-span-7 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
            <h3 className="text-base font-black">
              Diğer Malzemeler &amp; Numara / Beden / Durum Paneli
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stockItems.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSelectedOtherId(s.id);
                    setDetailTargetType("other");
                    setEditOtherSize(s.size_label || "M");
                    setEditOtherNum(s.item_number ? String(s.item_number) : "");
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                    activeOtherItem?.id === s.id
                      ? "border-[var(--brand-red)] bg-[var(--status-warning-bg)]/20"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  }`}
                >
                  <img
                    src={s.photo_url || "/logo-square.png"}
                    alt={s.product_name}
                    className="w-12 h-12 rounded-xl object-cover bg-white border border-[var(--border-subtle)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black truncate">
                      {s.product_name}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {s.category} • Beden: {s.size_label || "M"} • Stok:{" "}
                      {s.available_count}/{s.total_count}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activeOtherItem && detailTargetType === "other" && (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4 space-y-3">
                <div className="text-xs font-black">
                  {activeOtherItem.product_name} — Numara / Beden / Durum
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Malzeme Numarası
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={editOtherNum}
                      onChange={(e) => setEditOtherNum(e.target.value)}
                      placeholder="Örn: 12"
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Beden
                    </label>
                    <select
                      value={editOtherSize}
                      onChange={(e) => setEditOtherSize(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold"
                    >
                      {SIZES.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                      Durum
                    </label>
                    <select
                      value={editOtherStatus}
                      onChange={(e) =>
                        setEditOtherStatus(
                          e.target.value as
                            | "Müsait"
                            | "Teslim Edildi"
                            | "Kayıp"
                        )
                      }
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold"
                    >
                      {ITEM_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveOtherItemDetails}
                  className="px-4 py-2 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-extrabold cursor-pointer"
                >
                  Numara / Beden / Durumu Kaydet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ortak Teslim Et & Aktif Zimmet / İade Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleDeliverEquipment}
          className="lg:col-span-6 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-3.5"
        >
          <h3 className="text-base font-black">Sporcuya Teslim Et</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Yaş Grubu Filtresi
              </label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold"
              >
                <option value="Tümü">Tümü</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Sporcu Seç *
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold"
              >
                <option value="">Sporcu seçin...</option>
                {filteredPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.age_group})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Tür
              </label>
              <select
                value={deliverKind}
                onChange={(e) => {
                  const nextKind = e.target.value as "jersey" | "other";
                  setDeliverKind(nextKind);
                  if (nextKind === "jersey" && jerseySets[0]) {
                    setDeliverItemId(jerseySets[0].id);
                  } else if (nextKind === "other" && stockItems[0]) {
                    setDeliverItemId(stockItems[0].id);
                  }
                }}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
              >
                <option value="jersey">Forma</option>
                <option value="other">Diğer Malzeme</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Malzeme / Forma
              </label>
              <select
                value={deliverItemId}
                onChange={(e) => setDeliverItemId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
              >
                {deliverKind === "jersey"
                  ? jerseySets.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.set_name} ({j.available_count} müsait)
                      </option>
                    ))
                  : stockItems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.product_name} ({s.available_count} müsait)
                      </option>
                    ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Beden
              </label>
              <select
                value={deliverSize}
                onChange={(e) => setDeliverSize(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
              >
                {SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Numara (Ops.)
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={deliverNumber}
                onChange={(e) => setDeliverNumber(e.target.value)}
                placeholder="Örn: 95"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Not
              </label>
              <input
                type="text"
                value={deliverNotes}
                onChange={(e) => setDeliverNotes(e.target.value)}
                placeholder="İsteğe bağlı not..."
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={delivering}
            className="w-full py-2.5 rounded-xl bg-[var(--brand-navy)] hover:opacity-95 text-white text-xs font-black cursor-pointer"
          >
            {delivering ? "Teslim Ediliyor..." : "Teslim Et"}
          </button>
        </form>

        <div className="lg:col-span-6 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-3">
          <h3 className="text-base font-black">
            Teslim Edilmiş Malzemeler &amp; İade Al ({activeLogs.length})
          </h3>
          {activeLogs.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Şu an iade bekleyen teslim kaydı bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeLogs.map((log) => {
                const pName =
                  players.find((p) => p.id === log.player_id)?.full_name ||
                  "Sporcu";
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div>
                      <div className="font-black">
                        {pName} • {log.item_name}
                        {log.jersey_number ? ` #${log.jersey_number}` : ""}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Beden: {log.size_label || "M"} • Durum: {log.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleReturnLog(log)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold cursor-pointer shrink-0"
                    >
                      İade Al
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}