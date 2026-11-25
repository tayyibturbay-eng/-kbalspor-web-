"use client";

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS, Due, Player } from "@/types/club";
import { EASE, SPRING } from "@/lib/motion";

const supabase = createClient();

interface DuesTabProps {
  adminName?: string;
  players: Player[];
  dues?: Due[];
  setDues?: React.Dispatch<React.SetStateAction<Due[]>>;
  monthlyFee?: string;
  setMonthlyFee?: React.Dispatch<React.SetStateAction<string>>;
  onAddPayment?: (payload: {
    player_id: string;
    amount: number;
    payment_date: string;
    note?: string;
  }) => Promise<void> | void;
  onSendReminder?: (
    targetGroup: string,
    message: string
  ) => Promise<void> | void;
  onFeedback?: (msg: string) => void;
  onLogActivity?: (action: string, details: string) => Promise<void> | void;
  onRefreshDues?: () => Promise<void> | void;
}

export function DuesTab({
  adminName,
  players,
  dues = [],
  setDues,
  monthlyFee,
  onAddPayment,
  onSendReminder,
  onFeedback,
  onLogActivity,
  onRefreshDues,
}: DuesTabProps) {
  const azaltilmis = useReducedMotion();

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    players[0]?.id || ""
  );
  const [amount, setAmount] = useState<string>(monthlyFee || "500");
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  const [reminderGroup, setReminderGroup] = useState<string>("Tümü");
  const [reminderText, setReminderText] = useState<string>(
    "Değerli velimiz/sporcunun bilgisine; aylık aidat ödemelerinizi en kısa sürede güncelleyebilirsiniz."
  );
  const [sendingReminder, setSendingReminder] = useState<boolean>(false);

  const groupedPlayers = useMemo(() => {
    const map = new Map<string, Player[]>();
    for (const g of AGE_GROUPS) map.set(g, []);
    for (const p of players) {
      const grp = p.age_group || "Diğer";
      const list = map.get(grp) || [];
      list.push(p);
      map.set(grp, list);
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0);
  }, [players]);

  const paidPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of dues) {
      const record = d as Due & { player_id?: string; status?: string };
      if (
        record.player_id &&
        (String(record.status || "").toLowerCase() === "ödendi" ||
          String(record.status || "").toLowerCase() === "paid" ||
          String(record.status || "").toLowerCase() === "güncel")
      ) {
        set.add(record.player_id);
      }
    }
    return set;
  }, [dues]);

  const summaryStats = useMemo(() => {
    const totalCount = players.length;
    const paidCount = players.filter((p) => {
      const pDue = p as Player & { due_status?: string | null };
      return (
        paidPlayerIds.has(p.id) ||
        String(pDue.due_status || "").toLowerCase() === "ödendi" ||
        String(pDue.due_status || "").toLowerCase() === "güncel"
      );
    }).length;
    const pendingCount = Math.max(0, totalCount - paidCount);
    const totalCollected = dues.reduce(
      (sum, d) => sum + Number((d as Due & { amount?: number }).amount || 0),
      0
    );
    return { totalCount, paidCount, pendingCount, totalCollected };
  }, [players, dues, paidPlayerIds]);

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pid = selectedPlayerId || players[0]?.id;
    const numAmount = Number(amount);
    if (!pid || !numAmount || numAmount <= 0 || savingPayment) return;

    setSavingPayment(true);
    try {
      if (onAddPayment) {
        await onAddPayment({
          player_id: pid,
          amount: numAmount,
          payment_date: paymentDate,
          note: note.trim() || undefined,
        });
      } else {
        const { data, error } = await supabase
          .from("dues")
          .insert({
            player_id: pid,
            amount: numAmount,
            payment_date: paymentDate,
            status: "Ödendi",
            note: note.trim() || null,
            created_by: adminName || "Yönetici",
          })
          .select("*")
          .single();

        if (error) {
          onFeedback?.("Ödeme kaydedilemedi: " + error.message);
          return;
        }
        if (data && setDues) {
          setDues((prev) => [data as Due, ...prev]);
        }
        await onLogActivity?.(
          "Aidat Ödemesi",
          `${numAmount} TL ödeme kaydedildi (${paymentDate}).`
        );
        onFeedback?.("Aidat ödemesi kaydedildi.");
      }

      setNote("");
      await onRefreshDues?.();
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleReminderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderText.trim() || sendingReminder) return;
    setSendingReminder(true);
    try {
      if (onSendReminder) {
        await onSendReminder(reminderGroup, reminderText.trim());
      } else {
        await supabase.from("club_messages").insert({
          body: `AİDAT HATIRLATMA (${reminderGroup})\n${reminderText.trim()}`,
          message_text: `AİDAT HATIRLATMA (${reminderGroup})\n${reminderText.trim()}`,
          age_group: reminderGroup,
          sender_name: adminName || "Yönetici",
          created_at: new Date().toISOString(),
        });
        await onLogActivity?.(
          "Aidat Hatırlatması",
          `${reminderGroup} grubuna hatırlatma gönderildi.`
        );
        onFeedback?.("Aidat hatırlatması gönderildi.");
      }
    } finally {
      setSendingReminder(false);
    }
  }

  const statCards = [
    {
      label: "Güncel / Ödeyen",
      value: `${summaryStats.paidCount} Sporcu`,
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Bekleyen Aidat",
      value: `${summaryStats.pendingCount} Sporcu`,
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      label: "Toplam Kayıtlı Tahsilat",
      value: `${summaryStats.totalCollected.toLocaleString("tr-TR")} TL`,
      tone: "border-[var(--brand-navy)]/30 bg-[var(--brand-navy-soft)] text-[var(--brand-ink)]",
    },
  ];

  return (
    <div className="flex flex-col space-y-6 text-[var(--text-primary)] tabular-nums min-w-0">
      {/* 1. Ödeme Ekle (Her zaman üstte) */}
      <form
        onSubmit={handlePaymentSubmit}
        className="order-1 k-artik p-4 sm:p-6 space-y-4 min-w-0"
      >
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">AİDAT TAHSİLATI</span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Ödeme Ekle
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={selectedPlayerId || players[0]?.id || ""}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="k-alan font-bold min-h-[42px]"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.age_group})
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Tutar (TL)"
            className="k-alan font-black min-h-[42px]"
          />

          <div className="min-w-0">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-[var(--text-secondary)] mb-1">
              <span>Ödeme Tarihi</span>
              <span className="font-mono text-[var(--brand-ink)]">
                gg.aa.yyyy
              </span>
            </div>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="k-alan font-bold min-h-[42px]"
            />
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Açıklama / Ay (Ops.)"
            className="k-alan font-semibold min-h-[42px]"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={savingPayment}
          className="k-buton k-buton--lacivert w-full sm:w-auto min-h-[42px] !px-6 !py-2.5 text-xs sm:text-sm"
        >
          {savingPayment ? "Kaydediliyor..." : "+ Ödeme Ekle"}
        </motion.button>
      </form>

      {/* Animasyonlu Kutucuklar: Masaüstünde üst kısımda (order-2 md:order-2), Mobilde Hatırlatma Merkezinin hemen üstünde (order-3 md:order-2) */}
      <div className="order-3 md:order-2 grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={azaltilmis ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              ...SPRING.yumusak,
              delay: azaltilmis ? 0 : i * 0.06,
              ease: EASE.yumusak,
            }}
            whileHover={azaltilmis ? undefined : { y: -2 }}
            className={`k-artik p-4 border rounded-2xl space-y-1 transition ${card.tone}`}
          >
            <div className="k-koz text-[10px] opacity-90">{card.label}</div>
            <div className="k-posta text-lg sm:text-xl font-black">
              {card.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Kategori Bazlı Sporcular: Masaüstünde ortada (order-3 md:order-3), Mobilde kutucukların altında/üstünde akışa uyumlu */}
      <div className="order-2 md:order-3 space-y-4 min-w-0">
        {groupedPlayers.map(([groupName, groupList]) => (
          <section
            key={groupName}
            className="k-artik p-4 sm:p-5 space-y-3 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="k-posta text-base sm:text-lg text-[var(--text-primary)]">
                {groupName}
              </h3>
              <span className="k-etiket k-etiket--lacivert shrink-0">
                {groupList.length} Sporcu
              </span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {groupList.map((p) => {
                const pDue = p as Player & { due_status?: string | null };
                const isPaid =
                  paidPlayerIds.has(p.id) ||
                  String(pDue.due_status || "").toLowerCase() === "ödendi" ||
                  String(pDue.due_status || "").toLowerCase() === "güncel";

                return (
                  <div
                    key={p.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerId(p.id)}
                      className="font-bold text-left text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                    >
                      {p.full_name}
                    </button>
                    <span
                      className={`k-etiket shrink-0 ${
                        isPaid ? "k-etiket--lacivert" : "k-etiket--uyari"
                      }`}
                    >
                      {isPaid ? "Güncel" : pDue.due_status || "Beklemede"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* 4. Hatırlatma Merkezi (En altta, mobilde animasyonlu kutucukların hemen altında) */}
      <form
        onSubmit={handleReminderSubmit}
        className="order-4 k-artik p-4 sm:p-6 space-y-3.5 min-w-0"
      >
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">BİLDİRİM &amp; UYARI</span>
          <h3 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Hatırlatma Merkezi
          </h3>
        </div>

        <select
          value={reminderGroup}
          onChange={(e) => setReminderGroup(e.target.value)}
          className="k-alan font-bold min-h-[42px]"
        >
          <option value="Tümü">Tüm Yaş Grupları</option>
          {AGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <textarea
          rows={3}
          value={reminderText}
          onChange={(e) => setReminderText(e.target.value)}
          className="k-alan text-xs sm:text-sm font-medium"
          placeholder="Aidat hatırlatma mesajını yazın..."
        />

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={sendingReminder}
          className="k-buton k-buton--kirmizi w-full sm:w-auto min-h-[42px] !px-6 !py-2.5 text-xs sm:text-sm"
        >
          {sendingReminder ? "Gönderiliyor..." : "Hatırlatma Gönder"}
        </motion.button>
      </form>
    </div>
  );
}