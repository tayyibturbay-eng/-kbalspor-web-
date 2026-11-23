"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { Player } from "@/types/club";

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

interface InventoryManagerProps {
  players: Player[];
}

const CONDITION_OPTIONS = [
  "Yeni / Sıfır",
  "İyi Durumda",
  "Kullanılmış",
  "Yıpranmış",
  "Kayıp / Hasarlı",
] as const;

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Standart"] as const;

export function InventoryManager({ players }: InventoryManagerProps) {
  const [jerseySets, setJerseySets] = useState<JerseySetRow[]>([]);
  const [stockItems, setStockItems] = useState<StockItemRow[]>([]);
  const [logs, setLogs] = useState<EquipmentLogRow[]>([]);

  const [mode, setMode] = useState<"forma" | "ekipman">("forma");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedJerseySetId, setSelectedJerseySetId] = useState<string>("");
  const [selectedStockId, setSelectedStockId] = useState<string>("");

  const [jerseyNumber, setJerseyNumber] = useState<string>("");
  const [sizeLabel, setSizeLabel] = useState<string>("L");
  const [conditionStatus, setConditionStatus] = useState<string>("Yeni / Sıfır");
  const [actionStatus, setActionStatus] = useState<"teslim_edildi" | "iade_alindi" | "kayip">("teslim_edildi");
  const [notes, setNotes] = useState<string>("");

  const [historyFilterPlayerId, setHistoryFilterPlayerId] = useState<string>("all");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const fetchInventoryData = useCallback(async () => {
    const [jRes, sRes, lRes] = await Promise.all([
      supabase.from("jersey_sets").select("*").order("set_name", { ascending: true }),
      supabase.from("equipment_stock").select("*").order("product_name", { ascending: true }),
      supabase.from("equipment_logs").select("*").order("created_at", { ascending: false }).limit(200),
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
      visibleIds.length > 0 && visibleIds.every((id) => selectedLogIds.includes(id));
    if (allSelected) {
      setSelectedLogIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLogIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  async function handleAssignOrReturn(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!selectedPlayerId) {
      setFeedback({ ok: false, text: "Lütfen bir sporcu seçin." });
      return;
    }

    const parsedNum = jerseyNumber.trim() ? parseInt(jerseyNumber.trim(), 10) : null;
    if (parsedNum !== null && (isNaN(parsedNum) || parsedNum < 1 || parsedNum > 99)) {
      setFeedback({ ok: false, text: "Forma / ekipman numarası 1 ile 99 arasında olmalıdır." });
      return;
    }

    if (mode === "forma") {
      const chosenSet = jerseySets.find((j) => j.id === selectedJerseySetId);
      if (!chosenSet) {
        setFeedback({ ok: false, text: "Lütfen bir forma seti seçin." });
        return;
      }

      // Forma tesliminde veya iadesinde forma no zorunludur; numara seçili değilse emanet verilmez
      if (parsedNum === null) {
        setFeedback({
          ok: false,
          text: "Forma seçili değil / forma numarası girilmemiş! Emanet veya teslim işlemi için forma numarası zorunludur.",
        });
        return;
      }

      if (actionStatus === "teslim_edildi" && chosenSet.available_count <= 0) {
        setFeedback({ ok: false, text: "Seçilen forma setinde stok kalmadı." });
        return;
      }

      setSubmitting(true);
      const { error: logErr } = await supabase.from("equipment_logs").insert({
        player_id: selectedPlayerId,
        item_type: "forma",
        item_name: chosenSet.set_name,
        jersey_number: parsedNum,
        size_label: sizeLabel,
        condition_status: actionStatus === "kayip" ? "Kayıp / Hasarlı" : conditionStatus,
        status: actionStatus,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (logErr) {
        setSubmitting(false);
        setFeedback({ ok: false, text: "Kayıt oluşturulamadı: " + logErr.message });
        return;
      }

      if (actionStatus === "teslim_edildi") {
        await supabase
          .from("jersey_sets")
          .update({ available_count: Math.max(0, chosenSet.available_count - 1) })
          .eq("id", chosenSet.id);
      } else if (actionStatus === "iade_alindi") {
        await supabase
          .from("jersey_sets")
          .update({
            available_count: Math.min(chosenSet.total_count, chosenSet.available_count + 1),
          })
          .eq("id", chosenSet.id);
      }

      setSubmitting(false);
      setJerseyNumber("");
      setNotes("");
      setFeedback({
        ok: true,
        text: `${chosenSet.set_name} (#${parsedNum}, Beden: ${sizeLabel}) için işlem kaydedildi.`,
      });
      await fetchInventoryData();
      return;
    }

    // Diğer ekipmanlar: numara isteğe bağlı, beden ve durum aktif
    const chosenStock = stockItems.find((s) => s.id === selectedStockId);
    if (!chosenStock) {
      setFeedback({ ok: false, text: "Lütfen bir ekipman seçin." });
      return;
    }

    if (actionStatus === "teslim_edildi" && chosenStock.available_count <= 0) {
      setFeedback({ ok: false, text: "Seçilen ekipmanda stok kalmadı." });
      return;
    }

    setSubmitting(true);
    const { error: eqErr } = await supabase.from("equipment_logs").insert({
      player_id: selectedPlayerId,
      item_type: "ekipman",
      item_name: chosenStock.product_name,
      jersey_number: parsedNum, // opsiyonel
      size_label: sizeLabel,
      condition_status: actionStatus === "kayip" ? "Kayıp / Hasarlı" : conditionStatus,
      status: actionStatus,
      notes: notes.trim() || null,
      created_at: new Date().toISOString(),
    });

    if (eqErr) {
      setSubmitting(false);
      setFeedback({ ok: false, text: "Ekipman kaydı eklenemedi: " + eqErr.message });
      return;
    }

    if (actionStatus === "teslim_edildi") {
      await supabase
        .from("equipment_stock")
        .update({ available_count: Math.max(0, chosenStock.available_count - 1) })
        .eq("id", chosenStock.id);
    } else if (actionStatus === "iade_alindi") {
      await supabase
        .from("equipment_stock")
        .update({
          available_count: Math.min(chosenStock.total_count, chosenStock.available_count + 1),
        })
        .eq("id", chosenStock.id);
    }

    setSubmitting(false);
    setJerseyNumber("");
    setNotes("");
    setFeedback({
      ok: true,
      text: `${chosenStock.product_name} (Beden: ${sizeLabel}${
        parsedNum !== null ? `, No: #${parsedNum}` : ""
      }) işlemi kaydedildi.`,
    });
    await fetchInventoryData();
  }

  async function handleDeleteSingleLog(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("equipment_logs").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setFeedback({ ok: false, text: "Kayıt silinemedi: " + error.message });
      return;
    }
    setLogs((prev) => prev.filter((item) => item.id !== id));
    setSelectedLogIds((prev) => prev.filter((item) => item !== id));
    setFeedback({ ok: true, text: "Malzeme geçmişi kaydı silindi." });
  }

  async function handleDeleteLogsBatch(ids: string[], label: string) {
    if (ids.length === 0) return;
    setClearingHistory(true);
    const { error } = await supabase.from("equipment_logs").delete().in("id", ids);
    setClearingHistory(false);
    if (error) {
      setFeedback({ ok: false, text: "Geçmiş temizlenemedi: " + error.message });
      return;
    }
    setLogs((prev) => prev.filter((item) => !ids.includes(item.id)));
    setSelectedLogIds((prev) => prev.filter((item) => !ids.includes(item)));
    setFeedback({ ok: true, text: `${ids.length} adet malzeme kaydı temizlendi (${label}).` });
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <form
        onSubmit={handleAssignOrReturn}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              Forma &amp; Ekipman Teslim / İade / Kayıp Yönetimi
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Formalarda numara zorunludur; diğer ekipmanlarda numara isteğe bağlıdır.
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode("forma")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                mode === "forma"
                  ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
              }`}
            >
              Forma İşlemi
            </button>
            <button
              type="button"
              onClick={() => setMode("ekipman")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                mode === "ekipman"
                  ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
              }`}
            >
              Diğer Ekipman
            </button>
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
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.age_group})
                </option>
              ))}
            </select>
          </div>

          {mode === "forma" ? (
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
              {mode === "forma" ? "Forma Numarası *" : "Numara (Opsiyonel)"}
            </label>
            <input
              type="number"
              min={1}
              max={99}
              required={mode === "forma"}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder={mode === "forma" ? "Örn: 10 (Zorunlu)" : "İsteğe bağlı (1-99)"}
              className={`w-full rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-black text-[var(--text-primary)] ${
                mode === "forma" && !jerseyNumber.trim()
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
                  e.target.value as "teslim_edildi" | "iade_alindi" | "kayip"
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

      {/* Malzeme Geçmişi & Silme/Temizleme */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[var(--text-primary)]">
              Sporcu Malzeme Geçmişi ({filteredLogs.length})
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Tekil kayıt silebilir, seçili kayıtları veya filtrelenen geçmişi temizleyebilirsiniz.
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
                  void handleDeleteLogsBatch(selectedLogIds, "Seçili Kayıtlar")
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
                  historyFilterPlayerId === "all" ? "Tüm Geçmiş" : "Seçili Sporcu"
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