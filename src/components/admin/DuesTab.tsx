// DuesTab.tsx
"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Due, Player } from "@/types/club";
import { DUE_MONTHS, cleanWaPhone, sendPushViaApi } from "@/lib/club-utils";

const supabase = createClient();

interface DuesTabProps {
  adminName: string;
  players: Player[];
  dues: Due[];
  setDues: React.Dispatch<React.SetStateAction<Due[]>>;
  monthlyFee: string;
  setMonthlyFee: (val: string) => void;
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
}

export function DuesTab({
  adminName,
  players,
  dues,
  setDues,
  monthlyFee,
  setMonthlyFee,
  onFeedback,
  onLogActivity,
}: DuesTabProps) {
  const defaultMonth = DUE_MONTHS[0] || "Kasım 2026";
  const [selectedDueMonth, setSelectedDueMonth] = useState(defaultMonth);
  const [dueGroupFilter, setDueGroupFilter] = useState("Tümü");
  const [feeWaMsg, setFeeWaMsg] = useState<string | null>(null);
  const [manualPayGroup, setManualPayGroup] = useState("Tümü");
  const [manualPayPlayerId, setManualPayPlayerId] = useState("");
  const [manualPayMonth, setManualPayMonth] = useState(defaultMonth);
  const [manualPayAmount, setManualPayAmount] = useState(monthlyFee);
  const [pastDueMonth, setPastDueMonth] = useState(defaultMonth);
  const [pastDueCustomNote, setPastDueCustomNote] = useState("");

  const playersByGroupForSelect = useMemo(() => {
    const groups =
      manualPayGroup === "Tümü"
        ? AGE_GROUPS
        : AGE_GROUPS.filter((g) => g === manualPayGroup);

    const grouped: Array<{ group: string; items: Player[] }> = groups
      .map((g) => ({
        group: String(g),
        items: players.filter((p) => p.age_group === g),
      }))
      .filter((x) => x.items.length > 0);

    const knownGroups = new Set<string>(AGE_GROUPS as unknown as string[]);
    const otherPlayers = players.filter((p) => !knownGroups.has(p.age_group));
    if (manualPayGroup === "Tümü" && otherPlayers.length > 0) {
      grouped.push({ group: "Diğer", items: otherPlayers });
    }

    return grouped;
  }, [players, manualPayGroup]);

  const groupedMonthlyDues = useMemo(() => {
    const monthDuesMap = new Map<string, Due>();
    dues
      .filter((d) => d.month_label === selectedDueMonth)
      .forEach((d) => monthDuesMap.set(d.player_id, d));

    return AGE_GROUPS.filter(
      (g) => dueGroupFilter === "Tümü" || dueGroupFilter === g
    )
      .map((g) => {
        const groupPlayers = players.filter((p) => p.age_group === g);
        const rows = groupPlayers
          .map((p) => {
            const due = monthDuesMap.get(p.id);
            const isPaid = Boolean(
              due && (due.status === "Ödendi" || due.status === "paid")
            );
            return { player: p, due, isPaid };
          })
          .sort((a, b) => Number(a.isPaid) - Number(b.isPaid));
        const paidCount = rows.filter((r) => r.isPaid).length;
        const paidTotal = rows.reduce(
          (sum, r) =>
            sum + (r.isPaid ? Number(r.due?.amount || monthlyFee) : 0),
          0
        );
        return { group: g, rows, paidCount, paidTotal };
      })
      .filter((x) => x.rows.length > 0);
  }, [dues, players, selectedDueMonth, dueGroupFilter, monthlyFee]);

  const pastUnpaidPlayers = useMemo(() => {
    const pastDuePaidIds = new Set(
      dues
        .filter(
          (d) =>
            d.month_label === pastDueMonth &&
            (d.status === "Ödendi" || d.status === "paid")
        )
        .map((d) => d.player_id)
    );
    return players.filter((p) => !pastDuePaidIds.has(p.id));
  }, [dues, players, pastDueMonth]);

  async function updateMonthlyFee() {
    const feeNum = Number(monthlyFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      onFeedback("Geçerli bir aidat tutarı girin.");
      return;
    }
    const { error: setErr } = await supabase
      .from("club_settings")
      .upsert(
        { key: "monthly_fee", value: String(feeNum) },
        { onConflict: "key" }
      );

    if (setErr) {
      onFeedback("Aidat ücreti kaydedilemedi: " + setErr.message);
      return;
    }

    const msg = `AİDAT ÜCRETİ GÜNCELLEMESİ\nDeğerli velilerimiz ve sporcularımız, Çorum İkbal Spor Kulübü aylık kulüp aidat ücreti ${feeNum} TL olarak güncellenmiştir.`;
    await supabase.from("club_messages").insert({
      body: msg,
      message_text: msg,
      age_group: "Tüm Kulüp",
      sender_name: adminName || "Yönetici",
      created_at: new Date().toISOString(),
    });

    await onLogActivity(
      "Aidat Ücreti Güncelleme",
      `Aylık aidat ücreti ${feeNum} TL yapıldı ve duyuru gönderildi.`
    );
    setFeeWaMsg(msg);
    setManualPayAmount(String(feeNum));
    onFeedback(
      `Aidat ücreti ${feeNum} TL olarak güncellendi ve bildirim yayınlandı.`
    );
  }

  async function handleManualDuePayment(e: React.FormEvent) {
    e.preventDefault();
    const target = players.find((p) => p.id === manualPayPlayerId);
    if (!target) {
      onFeedback("Lütfen ödeme yapan oyuncuyu seçin.");
      return;
    }
    const amountNum = Number(manualPayAmount) || Number(monthlyFee) || 500;
    const existing = dues.find(
      (d) => d.player_id === target.id && d.month_label === manualPayMonth
    );

    if (existing) {
      const { error } = await supabase
        .from("dues")
        .update({
          status: "Ödendi",
          amount: amountNum,
          paid_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        onFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      setDues((prev) =>
        prev.map((d) =>
          d.id === existing.id
            ? { ...d, status: "Ödendi", amount: amountNum }
            : d
        )
      );
    } else {
      const { data, error } = await supabase
        .from("dues")
        .insert({
          player_id: target.id,
          month_label: manualPayMonth,
          amount: amountNum,
          status: "Ödendi",
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        onFeedback("Aidat kaydedilemedi: " + error.message);
        return;
      }
      if (data) setDues((prev) => [data as Due, ...prev]);
    }

    await onLogActivity(
      "Aidat Tahsilatı",
      `${target.full_name} — ${manualPayMonth} (${amountNum} TL) Ödendi`
    );
    setSelectedDueMonth(manualPayMonth);
    onFeedback(
      `${target.full_name} için ${manualPayMonth} ödemesi (${amountNum} TL) Ödendi olarak kaydedildi.`
    );
    setManualPayPlayerId("");
  }

  async function togglePlayerMonthDue(player: Player, existingDue?: Due) {
    const feeNum = Number(monthlyFee) || 500;
    if (!existingDue) {
      const { data, error } = await supabase
        .from("dues")
        .insert({
          player_id: player.id,
          month_label: selectedDueMonth,
          amount: feeNum,
          status: "Ödendi",
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        onFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      if (data) setDues((prev) => [data as Due, ...prev]);
      await onLogActivity(
        "Aidat Tahsilatı",
        `${player.full_name} — ${selectedDueMonth} (${feeNum} TL) Ödendi`
      );
      onFeedback(
        `${player.full_name} (${selectedDueMonth}) Ödendi olarak işaretlendi.`
      );
    } else {
      const isPaid =
        existingDue.status === "Ödendi" || existingDue.status === "paid";
      const nextStatus = isPaid ? "Bekleniyor" : "Ödendi";
      const nextAmount = existingDue.amount || feeNum;

      const { error } = await supabase
        .from("dues")
        .update({
          status: nextStatus,
          amount: nextAmount,
          paid_at: nextStatus === "Ödendi" ? new Date().toISOString() : null,
        })
        .eq("id", existingDue.id);

      if (error) {
        onFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      setDues((prev) =>
        prev.map((d) =>
          d.id === existingDue.id
            ? { ...d, status: nextStatus, amount: nextAmount }
            : d
        )
      );
      await onLogActivity(
        "Aidat Güncelleme",
        `${player.full_name} — ${selectedDueMonth} -> ${nextStatus}`
      );
      onFeedback(
        `${player.full_name} (${selectedDueMonth}) durumu: ${nextStatus}`
      );
    }
  }

  async function sendBulkPastDueNotification() {
    if (pastUnpaidPlayers.length === 0) {
      onFeedback(`${pastDueMonth} için ödemesi kalan oyuncu bulunmuyor.`);
      return;
    }
    const bodyText =
      pastDueCustomNote.trim() ||
      `AİDAT HATIRLATMA (${pastDueMonth})\nSayın velilerimiz ve sporcularımız, ${pastDueMonth} dönemine ait kulüp aidat ödemesini henüz gerçekleştirmeyen sporcularımızın ödemelerini en kısa sürede tamamlamalarını rica ederiz.`;

    const { error } = await supabase.from("club_messages").insert({
      body: bodyText,
      message_text: bodyText,
      age_group: "Tümü",
      sender_name: adminName || "Yönetici",
      created_at: new Date().toISOString(),
    });

    if (error) {
      onFeedback("Bildirim gönderilemedi: " + error.message);
      return;
    }

    const pushRes = await sendPushViaApi(
      ["Tümü"],
      `${pastDueMonth} Aidat Hatırlatması`,
      bodyText
    );
    await onLogActivity(
      "Toplu Aidat Hatırlatma",
      `${pastDueMonth} dönemi için ödemesi kalan ${pastUnpaidPlayers.length} sporcuya kulüp bildirimi gönderildi (${pushRes.sentCount} cihaz).`
    );
    onFeedback(
      `${pastDueMonth} ödemesi kalan ${pastUnpaidPlayers.length} sporcu için toplu kulüp bildirimi gönderildi (${pushRes.sentCount} cihaz).`
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-[var(--text-primary)]">
            Aylık Aidat Ücreti &amp; Dönem Seçimi
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Kasım 2026 itibarıyla her yeni ayda 3 ay sonrası otomatik açılır;
            ödemeyenler her zaman en üstte gösterilir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            Güncel Ücret (TL):
          </span>
          <input
            type="number"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            className="w-24 border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm font-bold"
          />
          <button
            type="button"
            onClick={updateMonthlyFee}
            className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition"
          >
            Ücreti Güncelle &amp; Bildir
          </button>
        </div>
      </div>

      {feeWaMsg && (
        <div className="bg-[var(--status-success-bg)]/65 border border-[var(--status-success-text)]/30 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3">
          <span className="text-xs text-[var(--status-success-text)] font-bold">
            {feeWaMsg}
          </span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(feeWaMsg)}`}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl"
          >
            WhatsApp Grubunda Paylaş
          </a>
        </div>
      )}

      <form
        onSubmit={handleManualDuePayment}
        className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3"
      >
        <h3 className="font-black text-[var(--text-primary)] text-sm">
          Ödeme Ekle (Grup, Kişi, Ay ve Verilen Tutarı Seç)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={manualPayGroup}
            onChange={(e) => {
              setManualPayGroup(e.target.value);
              setManualPayPlayerId("");
            }}
            className="border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)]"
          >
            <option value="Tümü">Tüm Gruplar</option>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </option>
            ))}
          </select>
          <select
            required
            value={manualPayPlayerId}
            onChange={(e) => setManualPayPlayerId(e.target.value)}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">-- Ödeme Yapan Oyuncuyu Seç --</option>
            {playersByGroupForSelect.map(({ group, items }) => (
              <optgroup
                key={group}
                label={group === "Çorum Süper Amatör Ligi" ? "SAL" : group}
              >
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.age_group})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={manualPayMonth}
            onChange={(e) => setManualPayMonth(e.target.value)}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm"
          >
            {DUE_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              required
              placeholder="Tutar (TL)"
              value={manualPayAmount}
              onChange={(e) => setManualPayAmount(e.target.value)}
              className="w-24 border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-2.5 py-2 text-sm font-bold"
            />
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl px-3 py-2 text-xs sm:text-sm cursor-pointer"
            >
              Kaydet
            </button>
          </div>
        </div>
      </form>

      <div className="bg-[var(--status-warning-bg)]/45 border border-amber-400/50 p-5 rounded-2xl space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="font-black text-[var(--text-primary)] text-sm">
              Geçmiş Aydan Ödemesi Kalanlara Toplu Bildirim &amp; Mesaj
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              <strong>{pastDueMonth}</strong> döneminde ödemesi henüz alınmamış{" "}
              <strong>{pastUnpaidPlayers.length} sporcu</strong> bulunuyor.
            </p>
          </div>
          <select
            value={pastDueMonth}
            onChange={(e) => setPastDueMonth(e.target.value)}
            className="border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl px-3 py-1.5 text-xs font-bold"
          >
            {DUE_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={2}
          value={pastDueCustomNote}
          onChange={(e) => setPastDueCustomNote(e.target.value)}
          placeholder={`Özel mesaj yaz (boş bırakırsan ${pastDueMonth} için otomatik aidat hatırlatma metni gönderilir)`}
          className="w-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl px-3 py-2 text-xs"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendBulkPastDueNotification}
            className="bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition"
          >
            Ödemeyenlere Toplu Kulüp Bildirimi Gönder (
            {pastUnpaidPlayers.length})
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              pastDueCustomNote.trim() ||
                `${pastDueMonth} Aidat Hatırlatması: Henüz ödemesini yapmayan sporcularımızın/velilerimizin aidatlarını tamamlamasını rica ederiz.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl"
          >
            WhatsApp Grubunda Hatırlat
          </a>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {DUE_MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedDueMonth(m)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                  selectedDueMonth === m
                    ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {["Tümü", ...AGE_GROUPS].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setDueGroupFilter(g)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                  dueGroupFilter === g
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
              </button>
            ))}
          </div>
        </div>

        {groupedMonthlyDues.map(({ group, rows, paidCount, paidTotal }) => (
          <div
            key={group}
            className="border border-[var(--border-subtle)] rounded-xl overflow-hidden"
          >
            <div className="bg-[var(--brand-navy)] text-white px-4 py-2 text-sm font-bold flex flex-wrap justify-between gap-2">
              <span>
                {group} — {selectedDueMonth}
              </span>
              <span>
                Ödeyen: {paidCount} / {rows.length} • Toplanan: {paidTotal} TL
              </span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {rows.map(({ player, due, isPaid }) => {
                const waPhone = cleanWaPhone(player.parent_phone);
                return (
                  <div
                    key={player.id}
                    className={`px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 text-sm ${
                      !isPaid
                        ? "bg-[var(--status-warning-bg)]/35"
                        : "bg-[var(--bg-surface)]"
                    }`}
                  >
                    <div>
                      <strong className="text-[var(--text-primary)]">
                        {player.full_name}
                      </strong>{" "}
                      <span className="text-xs text-[var(--text-muted)]">
                        ({due?.amount || monthlyFee} TL)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isPaid && waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                            `Merhaba, ${player.full_name} için ${selectedDueMonth} kulüp aidatı (${monthlyFee} TL) beklenmektedir. Bilginize sunarız.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[var(--bg-surface)] border border-emerald-500/40 text-[var(--status-success-text)] text-xs font-bold px-2.5 py-1 rounded-lg"
                        >
                          WP Hatırlat
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePlayerMonthDue(player, due)}
                        className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                          isPaid
                            ? "bg-emerald-600 text-white"
                            : "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                        }`}
                      >
                        {isPaid
                          ? `Ödendi (${due?.amount || monthlyFee} TL)`
                          : "Bekleniyor (Ödendi Yap)"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}