"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { AGE_GROUPS, Player } from "@/types/club";

const supabase = createClient();

interface JerseySetRow {
  id: string;
  set_name: string;
  kit_type: string;
  size_label?: string | null;
  total_count: number;
  available_count: number;
  photo_url?: string | null;
}

interface StockItemRow {
  id: string;
  product_name: string;
  category: string;
  size_label?: string | null;
  item_number?: number | null;
  total_count: number;
  available_count: number;
  photo_url?: string | null;
}

interface EquipmentLogRow {
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
  status: "Müsait" | "Teslim Edildi" | "Bakımda" | "Kayıp";
  assigned_to?: string;
}

interface InventoryManagerProps {
  players: Player[];
  onFeedback?: (msg: string) => void;
  onLogActivity?: (action: string, details: string) => Promise<void>;
}

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Standart"] as const;

const CONDITION_OPTIONS = [
  "Yeni / Sıfır",
  "İyi Durumda",
  "Kullanılmış",
  "Yıpranmış",
  "Kayıp / Hasarlı",
] as const;

const ITEM_STATUSES: Array<"Müsait" | "Teslim Edildi" | "Bakımda" | "Kayıp"> = [
  "Müsait",
  "Teslim Edildi",
  "Bakımda",
  "Kayıp",
];

function getUnitCardStyle(status: JerseyUnitDetail["status"]): string {
  if (status === "Kayıp") {
    return "bg-rose-950/65 border-rose-500 ring-1 ring-rose-400/60";
  }
  if (status === "Teslim Edildi") {
    return "bg-amber-950/55 border-amber-400 ring-1 ring-amber-300/50";
  }
  if (status === "Bakımda") {
    return "bg-sky-950/45 border-sky-400/70";
  }
  return "bg-[var(--bg-surface)] border-[var(--border-subtle)]";
}

function getUnitBadgeStyle(status: JerseyUnitDetail["status"]): string {
  if (status === "Kayıp") {
    return "bg-rose-600 text-white";
  }
  if (status === "Teslim Edildi") {
    return "bg-amber-400 text-slate-950";
  }
  if (status === "Bakımda") {
    return "bg-sky-500 text-white";
  }
  return "bg-emerald-700/30 text-emerald-300";
}

function buildDefaultUnitsForSet(set: JerseySetRow): JerseyUnitDetail[] {
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

export function InventoryManager({
  players,
  onFeedback,
  onLogActivity,
}: InventoryManagerProps) {
  const [jerseySets, setJerseySets] = useState<JerseySetRow[]>([]);
  const [stockItems, setStockItems] = useState<StockItemRow[]>([]);
  const [logs, setLogs] = useState<EquipmentLogRow[]>([]);

  const [panelTab, setPanelTab] = useState<"forma" | "ekipman">("forma");

  const [jerseyName, setJerseyName] = useState("");
  const [kitType, setKitType] = useState("İç Saha");
  const [jerseyQty, setJerseyQty] = useState("20");
  const [jerseyDefaultSize, setJerseyDefaultSize] = useState("M");
  const [jerseyPhotoUrl, setJerseyPhotoUrl] = useState("/logo.png");
  const [creatingJersey, setCreatingJersey] = useState(false);

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Eşofman Takımı");
  const [otherQty, setOtherQty] = useState("10");
  const [otherSize, setOtherSize] = useState("M");
  const [otherNumber, setOtherNumber] = useState("");
  const [otherPhotoUrl, setOtherPhotoUrl] = useState("/logo.png");
  const [creatingOther, setCreatingOther] = useState(false);

  const [selectedJerseySetId, setSelectedJerseySetId] = useState<string>("");
  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [jerseyUnitsMap, setJerseyUnitsMap] = useState<
    Record<string, JerseyUnitDetail[]>
  >({});
  const [customAddNumber, setCustomAddNumber] = useState("");
  const [customAddSize, setCustomAddSize] = useState("M");

  const [editOtherNum, setEditOtherNum] = useState("");
  const [editOtherSize, setEditOtherSize] = useState("M");
  const [editOtherStatus, setEditOtherStatus] = useState<
    "Müsait" | "Teslim Edildi" | "Bakımda" | "Kayıp"
  >("Müsait");

  const [ageFilter, setAgeFilter] = useState<string>("Tümü");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [jerseyNumber, setJerseyNumber] = useState<string>("");
  const [sizeLabel, setSizeLabel] = useState<string>("L");
  const [conditionStatus, setConditionStatus] = useState<string>("Yeni / Sıfır");
  const [actionStatus, setActionStatus] = useState<
    "teslim_edildi" | "iade_alindi" | "kayip"
  >("teslim_edildi");
  const [notes, setNotes] = useState<string>("");

  const [historyFilterPlayerId, setHistoryFilterPlayerId] = useState<string>("all");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const notify = useCallback(
    (ok: boolean, text: string) => {
      setFeedback({ ok, text });
      onFeedback?.(text);
    },
    [onFeedback]
  );

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const filteredPlayers = useMemo(() => {
    if (ageFilter === "Tümü") return players;
    return players.filter((p) => p.age_group === ageFilter);
  }, [players, ageFilter]);

  const fetchInventoryData = useCallback(async () => {
    const [jRes, sRes, lRes] = await Promise.all([
      supabase
        .from("jersey_sets")
        .select("*")
        .order("set_name", { ascending: true }),
      supabase
        .from("equipment_stock")
        .select("*")
        .order("product_name", { ascending: true }),
      supabase
        .from("equipment_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const jList = (jRes.data as JerseySetRow[] | null) || [];
    const sList = (sRes.data as StockItemRow[] | null) || [];
    const lList = (lRes.data as EquipmentLogRow[] | null) || [];

    setJerseySets(jList);
    setStockItems(sList);
    setLogs(lList);

    setSelectedPlayerId((prev) => prev || players[0]?.id || "");
    setSelectedJerseySetId((prev) => prev || jList[0]?.id || "");
    setSelectedStockId((prev) => prev || sList[0]?.id || "");
  }, [players]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem("ikbal_jersey_units_v1");
        if (raw) {
          setJerseyUnitsMap(
            JSON.parse(raw) as Record<string, JerseyUnitDetail[]>
          );
        }
      } catch {
        // yoksay
      }
      void fetchInventoryData();
    }, 0);

    const unsubscribe = subscribeClubLiveUpdates(
      supabase,
      () => {
        void fetchInventoryData();
      },
      "admin-inventory-live"
    );

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [fetchInventoryData]);

  function saveUnitsMap(next: Record<string, JerseyUnitDetail[]>) {
    setJerseyUnitsMap(next);
    try {
      localStorage.setItem("ikbal_jersey_units_v1", JSON.stringify(next));
    } catch {
      // yoksay
    }
  }

  async function insertEquipmentLogSafe(payload: {
    player_id: string;
    item_type: string;
    item_name: string;
    jersey_number: number | null;
    size_label: string;
    condition_status: string;
    status: string;
    notes: string | null;
    created_at: string;
  }) {
    const res = await supabase.from("equipment_logs").insert(payload);
    if (!res.error) return { error: null };

    const missingCol =
      res.error.message.includes("condition_status") ||
      res.error.message.includes("item_type") ||
      res.error.message.includes("schema cache");

    if (missingCol) {
      const {
        condition_status: _c,
        item_type: _t,
        ...fallbackPayload
      } = payload;
      void _c;
      void _t;
      const retry = await supabase.from("equipment_logs").insert(fallbackPayload);
      return { error: retry.error };
    }

    return { error: res.error };
  }

  async function insertJerseySetSafe(baseRow: {
    set_name: string;
    kit_type: string;
    size_label: string;
    total_count: number;
    available_count: number;
    photo_url: string;
  }) {
    const firstTry = await supabase
      .from("jersey_sets")
      .insert(baseRow)
      .select("*")
      .single();

    if (!firstTry.error) return firstTry;

    if (firstTry.error.message.includes("jersey_sets_kit_type_check")) {
      const candidates = ["home", "away", "third", "goalkeeper", "İç Saha", "Deplasman"];
      for (const candidate of candidates) {
        const retry = await supabase
          .from("jersey_sets")
          .insert({ ...baseRow, kit_type: candidate })
          .select("*")
          .single();
        if (!retry.error) return retry;
      }
    }

    return firstTry;
  }

  const activeJerseySet = useMemo(
    () =>
      jerseySets.find((j) => j.id === selectedJerseySetId) ||
      jerseySets[0] ||
      null,
    [jerseySets, selectedJerseySetId]
  );

  const activeOtherItem = useMemo(
    () =>
      stockItems.find((s) => s.id === selectedStockId) || stockItems[0] || null,
    [stockItems, selectedStockId]
  );

  const currentUnits: JerseyUnitDetail[] = useMemo(() => {
    if (!activeJerseySet) return [];
    const existing = jerseyUnitsMap[activeJerseySet.id];
    if (existing && existing.length > 0) return existing;
    return buildDefaultUnitsForSet(activeJerseySet);
  }, [activeJerseySet, jerseyUnitsMap]);

  const filteredLogs = useMemo(() => {
    if (historyFilterPlayerId === "all") return logs;
    return logs.filter((l) => l.player_id === historyFilterPlayerId);
  }, [logs, historyFilterPlayerId]);

  const toggleSelectLog = (id: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const visibleIds = filteredLogs.map((l) => l.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedLogIds.includes(id));
    if (allSelected) {
      setSelectedLogIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLogIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

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
        notify(true, "Kapak görseli yüklendi.");
        return;
      }
    }

    setter(URL.createObjectURL(file));
    notify(true, "Kapak görseli önizleme bağlantısı oluşturuldu.");
  }

  async function handleCreateJersey(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(1, parseInt(jerseyQty, 10) || 1);
    const title = jerseyName.trim() || `${kitType} Forma Seti (${qty} Adet)`;

    setCreatingJersey(true);
    const { data, error } = await insertJerseySetSafe({
      set_name: title,
      kit_type: kitType,
      size_label: jerseyDefaultSize,
      total_count: qty,
      available_count: qty,
      photo_url: jerseyPhotoUrl.trim() || "/logo.png",
    });
    setCreatingJersey(false);

    if (error) {
      notify(false, "Forma eklenemedi: " + error.message);
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
      setSelectedJerseySetId(createdId);
    }

    setJerseyName("");
    await onLogActivity?.(
      "Forma Ekleme",
      `${title} (${qty} adet, 1-${qty} otomatik numaralandırıldı)`
    );
    notify(
      true,
      `${qty} adet forma 1'den ${qty}'e numaralandırılarak eklendi.`
    );
    await fetchInventoryData();
  }

  async function handleCreateOtherItem(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(1, parseInt(otherQty, 10) || 1);
    const name = productName.trim() || category;
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
        photo_url: otherPhotoUrl.trim() || "/logo.png",
      })
      .select("*")
      .single();
    setCreatingOther(false);

    if (error) {
      notify(false, "Malzeme eklenemedi: " + error.message);
      return;
    }

    const createdId = (data as { id?: string } | null)?.id;
    if (createdId) {
      setSelectedStockId(createdId);
      if (parsedNum !== null && !Number.isNaN(parsedNum)) {
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
    }

    setProductName("");
    setOtherNumber("");
    await onLogActivity?.(
      "Malzeme Ekleme",
      `${name} (${category}, ${qty} adet${
        parsedNum ? `, No: #${parsedNum}` : ""
      })`
    );
    notify(true, `${name} envantere eklendi.`);
    await fetchInventoryData();
  }

  function handleAddCustomNumberUnit() {
    if (!activeJerseySet) return;
    const num = parseInt(customAddNumber, 10);
    if (Number.isNaN(num) || num < 1 || num > 999) {
      notify(
        false,
        "Lütfen 1 ile 999 arasında geçerli bir numara girin (örn: 95)."
      );
      return;
    }

    const list = [...currentUnits];
    if (list.some((u) => u.number === num)) {
      notify(false, `#${num} numarası zaten listede mevcut.`);
      return;
    }

    list.push({
      id: `${activeJerseySet.id}-u-${num}-${Date.now()}`,
      set_id: activeJerseySet.id,
      number: num,
      size: customAddSize,
      status: "Müsait",
    });

    saveUnitsMap({ ...jerseyUnitsMap, [activeJerseySet.id]: list });
    setCustomAddNumber("");
    notify(true, `#${num} numaralı forma (${customAddSize}) eklendi.`);
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
    notify(
      true,
      `${activeOtherItem.product_name} için numara/beden/durum güncellendi.`
    );
  }

  async function handleAssignOrReturn(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!selectedPlayerId) {
      notify(false, "Lütfen bir sporcu seçin.");
      return;
    }

    const parsedNum = jerseyNumber.trim()
      ? parseInt(jerseyNumber.trim(), 10)
      : null;

    if (
      parsedNum !== null &&
      (isNaN(parsedNum) || parsedNum < 1 || parsedNum > 999)
    ) {
      notify(false, "Numara 1 ile 999 arasında olmalıdır.");
      return;
    }

    const targetPlayer = playerMap.get(selectedPlayerId);

    if (panelTab === "forma") {
      const chosenSet = jerseySets.find((j) => j.id === selectedJerseySetId);
      if (!chosenSet) {
        notify(false, "Lütfen bir forma seti seçin.");
        return;
      }

      if (parsedNum === null) {
        notify(
          false,
          "Forma seçili değil / forma numarası girilmemiş! Emanet veya teslim işlemi için forma numarası zorunludur."
        );
        return;
      }

      if (
        actionStatus === "teslim_edildi" &&
        chosenSet.available_count <= 0
      ) {
        notify(false, "Seçilen forma setinde stok kalmadı.");
        return;
      }

      setSubmitting(true);
      const { error: logErr } = await insertEquipmentLogSafe({
        player_id: selectedPlayerId,
        item_type: "forma",
        item_name: chosenSet.set_name,
        jersey_number: parsedNum,
        size_label: sizeLabel,
        condition_status:
          actionStatus === "kayip" ? "Kayıp / Hasarlı" : conditionStatus,
        status: actionStatus,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (logErr) {
        setSubmitting(false);
        notify(false, "Kayıt oluşturulamadı: " + logErr.message);
        return;
      }

      const nextAvail =
        actionStatus === "teslim_edildi"
          ? Math.max(0, chosenSet.available_count - 1)
          : actionStatus === "iade_alindi"
          ? Math.min(chosenSet.total_count, chosenSet.available_count + 1)
          : chosenSet.available_count;

      await supabase
        .from("jersey_sets")
        .update({
          available_count: nextAvail,
          size_label: sizeLabel,
        })
        .eq("id", chosenSet.id);

      const baseUnits =
        jerseyUnitsMap[chosenSet.id] && jerseyUnitsMap[chosenSet.id].length > 0
          ? [...jerseyUnitsMap[chosenSet.id]]
          : buildDefaultUnitsForSet(chosenSet);

      const matchedIdx = baseUnits.findIndex((u) => u.number === parsedNum);
      const unitStatus: JerseyUnitDetail["status"] =
        actionStatus === "teslim_edildi"
          ? "Teslim Edildi"
          : actionStatus === "kayip"
          ? "Kayıp"
          : "Müsait";

      if (matchedIdx >= 0) {
        baseUnits[matchedIdx] = {
          ...baseUnits[matchedIdx],
          size: sizeLabel,
          status: unitStatus,
          assigned_to:
            actionStatus === "teslim_edildi"
              ? targetPlayer?.full_name
              : undefined,
        };
      } else {
        baseUnits.push({
          id: `${chosenSet.id}-u-${parsedNum}`,
          set_id: chosenSet.id,
          number: parsedNum,
          size: sizeLabel,
          status: unitStatus,
          assigned_to:
            actionStatus === "teslim_edildi"
              ? targetPlayer?.full_name
              : undefined,
        });
      }
      saveUnitsMap({ ...jerseyUnitsMap, [chosenSet.id]: baseUnits });

      setSubmitting(false);
      setJerseyNumber("");
      setNotes("");
      await onLogActivity?.(
        "Forma İşlemi",
        `${targetPlayer?.full_name || "Sporcu"} -> ${
          chosenSet.set_name
        } #${parsedNum} (Beden: ${sizeLabel}, İşlem: ${actionStatus})`
      );
      notify(
        true,
        `${chosenSet.set_name} (#${parsedNum}, Beden: ${sizeLabel}) için işlem kaydedildi.`
      );
      await fetchInventoryData();
      return;
    }

    const chosenStock = stockItems.find((s) => s.id === selectedStockId);
    if (!chosenStock) {
      notify(false, "Lütfen bir ekipman seçin.");
      return;
    }

    if (
      actionStatus === "teslim_edildi" &&
      chosenStock.available_count <= 0
    ) {
      notify(false, "Seçilen ekipmanda stok kalmadı.");
      return;
    }

    setSubmitting(true);
    const { error: eqErr } = await insertEquipmentLogSafe({
      player_id: selectedPlayerId,
      item_type: "ekipman",
      item_name: chosenStock.product_name,
      jersey_number: parsedNum,
      size_label: sizeLabel,
      condition_status:
        actionStatus === "kayip" ? "Kayıp / Hasarlı" : conditionStatus,
      status: actionStatus,
      notes: notes.trim() || null,
      created_at: new Date().toISOString(),
    });

    if (eqErr) {
      setSubmitting(false);
      notify(false, "Ekipman kaydı eklenemedi: " + eqErr.message);
      return;
    }

    const nextStockAvail =
      actionStatus === "teslim_edildi"
        ? Math.max(0, chosenStock.available_count - 1)
        : actionStatus === "iade_alindi"
        ? Math.min(chosenStock.total_count, chosenStock.available_count + 1)
        : chosenStock.available_count;

    await supabase
      .from("equipment_stock")
      .update({
        available_count: nextStockAvail,
        size_label: sizeLabel,
      })
      .eq("id", chosenStock.id);

    setSubmitting(false);
    setJerseyNumber("");
    setNotes("");
    await onLogActivity?.(
      "Malzeme İşlemi",
      `${targetPlayer?.full_name || "Sporcu"} -> ${
        chosenStock.product_name
      } (Beden: ${sizeLabel}${
        parsedNum !== null ? `, No: #${parsedNum}` : ""
      }, İşlem: ${actionStatus})`
    );
    notify(
      true,
      `${chosenStock.product_name} (Beden: ${sizeLabel}${
        parsedNum !== null ? `, No: #${parsedNum}` : ""
      }) işlemi kaydedildi.`
    );
    await fetchInventoryData();
  }

  async function handleDeleteSingleLog(id: string) {
    setDeletingId(id);
    const { error } = await supabase
      .from("equipment_logs")
      .delete()
      .eq("id", id);
    setDeletingId(null);
    if (error) {
      notify(false, "Kayıt silinemedi: " + error.message);
      return;
    }
    setLogs((prev) => prev.filter((item) => item.id !== id));
    setSelectedLogIds((prev) => prev.filter((item) => item !== id));
    await onLogActivity?.("Malzeme Geçmişi Silme", `Kayıt silindi (#${id})`);
    notify(true, "Malzeme geçmişi kaydı silindi.");
  }

  async function handleDeleteLogsBatch(ids: string[], label: string) {
    if (ids.length === 0) return;
    setClearingHistory(true);
    const { error } = await supabase
      .from("equipment_logs")
      .delete()
      .in("id", ids);
    setClearingHistory(false);
    if (error) {
      notify(false, "Geçmiş temizlenemedi: " + error.message);
      return;
    }
    setLogs((prev) => prev.filter((item) => !ids.includes(item.id)));
    setSelectedLogIds((prev) => prev.filter((item) => !ids.includes(item)));
    await onLogActivity?.(
      "Malzeme Geçmişi Temizleme",
      `${ids.length} kayıt silindi (${label})`
    );
    notify(
      true,
      `${ids.length} adet malzeme kaydı temizlendi (${label}).`
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">
            Ortak Forma &amp; Malzeme Yönetim Paneli
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Formalar ve diğer malzemeler tek ortak panelde; kapak görseli,
            1&apos;den otomatik numara, rastgele numara, beden/numara/durum ve
            geçmiş yönetimi birlikte çalışır.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPanelTab("forma")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
              panelTab === "forma"
                ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}
          >
            Formalar ({jerseySets.length})
          </button>
          <button
            type="button"
            onClick={() => setPanelTab("ekipman")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
              panelTab === "ekipman"
                ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)]"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}
          >
            Diğer Malzemeler ({stockItems.length})
          </button>
        </div>
      </div>

      {panelTab === "forma" && (
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
                  Beden
                </label>
                <select
                  value={jerseyDefaultSize}
                  onChange={(e) => setJerseyDefaultSize(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-bold"
                >
                  {SIZE_OPTIONS.map((sz) => (
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
                  Kapak Fotoğrafı
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
                  src={jerseyPhotoUrl || "/logo.png"}
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

          <div className="lg:col-span-7 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black">
                Forma Setleri &amp; Beden / Numara / Durum Paneli
              </h3>
              <select
                value={activeJerseySet?.id || ""}
                onChange={(e) => setSelectedJerseySetId(e.target.value)}
                className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-bold"
              >
                {jerseySets.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.set_name} ({j.available_count}/{j.total_count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                Teslim Edildi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-600 inline-block" />
                Kayıp
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                Müsait
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {jerseySets.map((j) => (
                <button
                  type="button"
                  key={j.id}
                  onClick={() => setSelectedJerseySetId(j.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition ${
                    activeJerseySet?.id === j.id
                      ? "border-[var(--brand-navy)] bg-[var(--brand-navy-soft)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  }`}
                >
                  <img
                    src={j.photo_url || "/logo.png"}
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

            {activeJerseySet && (
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
                      {SIZE_OPTIONS.map((sz) => (
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
                      className={`rounded-xl border p-2.5 space-y-1.5 text-xs transition ${getUnitCardStyle(
                        unit.status
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[11px] ${getUnitBadgeStyle(
                            unit.status
                          )}`}
                        >
                          #{unit.number} • {unit.status}
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
                          className="w-16 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-primary)]"
                        />
                      </div>

                      {unit.assigned_to && unit.status === "Teslim Edildi" && (
                        <div className="text-[10px] font-bold text-amber-200 truncate">
                          Sporcu: {unit.assigned_to}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1">
                        <select
                          value={unit.size}
                          onChange={(e) =>
                            handleUpdateUnit(unit.id, { size: e.target.value })
                          }
                          className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          {SIZE_OPTIONS.map((sz) => (
                            <option key={sz} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>

                        <select
                          value={unit.status}
                          onChange={(e) =>
                            handleUpdateUnit(unit.id, {
                              status: e.target
                                .value as JerseyUnitDetail["status"],
                            })
                          }
                          className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
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

      {panelTab === "ekipman" && (
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
                  <option value="Çanta / Top">Çanta / Top</option>
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
                  {SIZE_OPTIONS.map((sz) => (
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
                  Kapak Fotoğrafı
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
                  src={otherPhotoUrl || "/logo.png"}
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
                    setSelectedStockId(s.id);
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
                    src={s.photo_url || "/logo.png"}
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

            {activeOtherItem && (
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
                      {SIZE_OPTIONS.map((sz) => (
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
                            | "Bakımda"
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

      <form
        onSubmit={handleAssignOrReturn}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="text-lg font-black text-[var(--text-primary)]">
              Forma &amp; Ekipman Teslim / İade / Kayıp İşlemi
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Formalarda numara zorunludur; diğer ekipmanlarda numara isteğe
              bağlıdır. İade alındığında seçilen beden korunur.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-bold"
            >
              <option value="Tümü">Tüm Yaş Grupları</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Sporcu *
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              {filteredPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.age_group})
                </option>
              ))}
            </select>
          </div>

          {panelTab === "forma" ? (
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Forma Seti *
              </label>
              <select
                value={selectedJerseySetId}
                onChange={(e) => setSelectedJerseySetId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
              >
                {jerseySets.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.set_name} (Stok: {j.available_count}/{j.total_count})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Ekipman *
              </label>
              <select
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
              >
                {stockItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.product_name} (Stok: {s.available_count}/{s.total_count})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {panelTab === "forma"
                ? "Forma Numarası *"
                : "Numara (Opsiyonel)"}
            </label>
            <input
              type="number"
              min={1}
              max={999}
              required={panelTab === "forma"}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder={
                panelTab === "forma" ? "Örn: 10 (Zorunlu)" : "İsteğe bağlı"
              }
              className={`w-full rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-black text-[var(--text-primary)] ${
                panelTab === "forma" && !jerseyNumber.trim()
                  ? "border-amber-400 bg-[var(--status-warning-bg)]/35"
                  : "border-[var(--border-strong)] bg-[var(--bg-subtle)]"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Beden *
            </label>
            <select
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              {SIZE_OPTIONS.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              İşlem Türü
            </label>
            <select
              value={actionStatus}
              onChange={(e) =>
                setActionStatus(
                  e.target.value as
                    | "teslim_edildi"
                    | "iade_alindi"
                    | "kayip"
                )
              }
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              <option value="teslim_edildi">Emanet / Teslim Et</option>
              <option value="iade_alindi">İade Alındı</option>
              <option value="kayip">Kayıp / Hasarlı</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Malzeme Durumu
            </label>
            <select
              value={conditionStatus}
              onChange={(e) => setConditionStatus(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Açıklama / Not
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="İsteğe bağlı not..."
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs sm:text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              feedback.ok
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs sm:text-sm font-black cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Kaydediliyor..." : "Malzeme İşlemini Kaydet"}
        </button>
      </form>

      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[var(--text-primary)]">
              Sporcu Malzeme Geçmişi ({filteredLogs.length})
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Tekil kayıt silebilir, seçili kayıtları veya filtrelenen
              geçmişi temizleyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={historyFilterPlayerId}
              onChange={(e) => setHistoryFilterPlayerId(e.target.value)}
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)]"
            >
              <option value="all">Tüm Sporcular</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>

            {filteredLogs.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
              >
                {filteredLogs.every((l) => selectedLogIds.includes(l.id))
                  ? "Seçimi Kaldır"
                  : "Tümünü Seç"}
              </button>
            )}

            {selectedLogIds.length > 0 && (
              <button
                type="button"
                disabled={clearingHistory}
                onClick={() =>
                  void handleDeleteLogsBatch(
                    selectedLogIds,
                    "Seçili Kayıtlar"
                  )
                }
                className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                Seçilenleri Sil ({selectedLogIds.length})
              </button>
            )}

            <button
              type="button"
              disabled={clearingHistory || filteredLogs.length === 0}
              onClick={() =>
                void handleDeleteLogsBatch(
                  filteredLogs.map((l) => l.id),
                  historyFilterPlayerId === "all"
                    ? "Tüm Geçmiş"
                    : "Seçili Sporcu"
                )
              }
              className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
            >
              {clearingHistory ? "Temizleniyor..." : "Geçmişi Temizle"}
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center text-xs font-bold text-[var(--text-secondary)]">
            Görüntülenecek malzeme geçmişi bulunmuyor.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredLogs.map((item) => {
              const pName =
                playerMap.get(item.player_id)?.full_name || "Sporcu";
              const isChecked = selectedLogIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectLog(item.id)}
                      className="mt-1 accent-[var(--brand-red)] cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-[var(--text-primary)]">
                        {pName} • {item.item_name}
                        {item.jersey_number ? ` (#${item.jersey_number})` : ""}
                        {item.size_label ? ` • Beden: ${item.size_label}` : ""}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Durum: {item.condition_status || item.status} • İşlem:{" "}
                        {item.status}
                        {item.notes ? ` • Not: ${item.notes}` : ""}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => void handleDeleteSingleLog(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Siliniyor..." : "Sil"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}