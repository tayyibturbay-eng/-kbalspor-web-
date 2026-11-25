"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Player,
  PrayerAttendance,
  PrayerSession,
  UserRole,
} from "@/types/club";
import { AttendanceReport } from "@/components/admin/AttendanceReport";
import { QRCodeSVG } from "qrcode.react";
import { useOnay } from "@/components/ui/OnayDialog";

const supabase = createClient();

interface QrAttendanceTabProps {
  role: UserRole;
  players: Player[];
  sessions: PrayerSession[];
  attendance: PrayerAttendance[];
  onFeedback: (msg: string) => void;
  onLogActivity: (action: string, details: string) => Promise<void>;
  onRefreshQr: () => Promise<void>;
}

export function QrAttendanceTab({
  role,
  players,
  sessions,
  attendance,
  onFeedback,
  onLogActivity,
  onRefreshQr,
}: QrAttendanceTabProps) {
  const { onay } = useOnay();
  const [newSessionTitle, setNewSessionTitle] = useState("Kulüp Yoklaması");
  const [newSessionDate, setNewSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [qrSearch, setQrSearch] = useState("");
  const [localAttendanceDelta, setLocalAttendanceDelta] = useState<{
    added: PrayerAttendance[];
    removedKeys: string[];
  }>({ added: [], removedKeys: [] });
  const [closedSessionIds, setClosedSessionIds] = useState<string[]>([]);
  const [closingSession, setClosingSession] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("qr-attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prayer_attendance" },
        () => {
          void onRefreshQr();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prayer_sessions" },
        () => {
          void onRefreshQr();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefreshQr]);

  const effectiveAttendance = useMemo(() => {
    const removed = new Set(localAttendanceDelta.removedKeys);
    const base = attendance.filter(
      (a) => !removed.has(`${a.session_id}:${a.player_id}`)
    );
    const merged = [...base];
    for (const item of localAttendanceDelta.added) {
      const exists = merged.some(
        (x) => x.session_id === item.session_id && x.player_id === item.player_id
      );
      if (!exists && !removed.has(`${item.session_id}:${item.player_id}`)) {
        merged.push(item);
      }
    }
    return merged;
  }, [attendance, localAttendanceDelta]);

  const effectiveSessions = useMemo(
    () =>
      sessions.map((s) =>
        closedSessionIds.includes(s.id) ? { ...s, is_active: false } : s
      ),
    [sessions, closedSessionIds]
  );

  const activeSession = useMemo(
    () => effectiveSessions.find((s) => s.is_active) || null,
    [effectiveSessions]
  );

  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => {
      void onRefreshQr();
    }, 3000);
    return () => clearInterval(timer);
  }, [activeSession, onRefreshQr]);

  const latestSession = activeSession || effectiveSessions[0] || null;

  const checkedInIds = useMemo(
    () =>
      new Set(
        effectiveAttendance
          .filter((a) => latestSession && a.session_id === latestSession.id)
          .map((a) => a.player_id)
      ),
    [effectiveAttendance, latestSession]
  );

  async function createQrSession(e: React.FormEvent) {
    e.preventDefault();

    if (role !== "admin") {
      const lastTs = Number(
        localStorage.getItem("ikbal_last_qr_created_at") || "0"
      );
      const diffMs = Date.now() - lastTs;
      const oneHourMs = 60 * 60 * 1000;
      if (lastTs > 0 && diffMs < oneHourMs) {
        const kalanDakika = Math.ceil((oneHourMs - diffMs) / 60000);
        onFeedback(
          `Güvenlik nedeniyle yeni QR kod oluşturmak için ${kalanDakika} dakika beklemelisiniz.`
        );
        return;
      }
    }

    if (
      !(await onay(
        "Yeni bir QR yoklama oturumu oluşturmak istediğinize emin misiniz? Mevcut aktif QR kodu kapatılacaktır.",
        {
          baslik: "Yeni Yoklama Oturumu",
          olumluMetin: "Evet, Oluştur",
          tehlikeli: false,
        }
      ))
    )
      return;

    const token = `IKB-QR-${Date.now().toString(36).toUpperCase()}`;
    const chosenDate = newSessionDate || new Date().toISOString().slice(0, 10);

    const { error: deactErr } = await supabase
      .from("prayer_sessions")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactErr) {
      onFeedback("Eski QR oturumu kapatılamadı: " + deactErr.message);
      return;
    }

    const { error: insErr } = await supabase.from("prayer_sessions").insert({
      title: newSessionTitle.trim() || "Kulüp Yoklaması",
      qr_token: token,
      session_date: chosenDate,
      is_active: true,
    });

    if (insErr) {
      onFeedback("QR oluşturma hatası: " + insErr.message);
      return;
    }

    if (role !== "admin") {
      localStorage.setItem("ikbal_last_qr_created_at", String(Date.now()));
    }

    setClosedSessionIds([]);
    await onLogActivity(
      "QR Yoklama Başlatma",
      `${newSessionTitle} (${chosenDate})`
    );
    onFeedback("Yeni QR yoklama oturumu oluşturuldu.");
    await onRefreshQr();
  }

  async function closeActiveSession() {
    if (!activeSession) return;
    if (
      !(await onay("Etkinliği sonlandırmak istediğinize emin misiniz?", {
        baslik: "Yoklamayı Sonlandır",
        olumluMetin: "Evet, Sonlandır",
      }))
    )
      return;

    setClosingSession(true);
    const { error } = await supabase
      .from("prayer_sessions")
      .update({ is_active: false })
      .eq("id", activeSession.id);
    setClosingSession(false);

    if (error) {
      onFeedback("Yoklama kapatılamadı: " + error.message);
      return;
    }

    setClosedSessionIds((prev) =>
      prev.includes(activeSession.id) ? prev : [...prev, activeSession.id]
    );
    await onLogActivity(
      "QR Yoklama Kapatma",
      `${activeSession.title} (${activeSession.session_date}) sonlandırıldı.`
    );
    onFeedback("Yoklama oturumu sonlandırıldı.");
    await onRefreshQr();
  }

  async function toggleManualAttendance(
    sessionId: string,
    player: Player,
    isPresent: boolean
  ) {
    const key = `${sessionId}:${player.id}`;
    if (isPresent) {
      setLocalAttendanceDelta((prev) => ({
        added: prev.added.filter(
          (a) => !(a.session_id === sessionId && a.player_id === player.id)
        ),
        removedKeys: prev.removedKeys.includes(key)
          ? prev.removedKeys
          : [...prev.removedKeys, key],
      }));
      await supabase
        .from("prayer_attendance")
        .delete()
        .eq("session_id", sessionId)
        .eq("player_id", player.id);
      await onLogActivity(
        "Yoklama İptal",
        `${player.full_name} yoklamadan çıkarıldı.`
      );
    } else {
      const nowIso = new Date().toISOString();
      setLocalAttendanceDelta((prev) => ({
        added: [
          ...prev.added,
          {
            id: `temp-${sessionId}-${player.id}`,
            session_id: sessionId,
            player_id: player.id,
            checked_in_at: nowIso,
          },
        ],
        removedKeys: prev.removedKeys.filter((k) => k !== key),
      }));
      await supabase
        .from("prayer_attendance")
        .insert({ session_id: sessionId, player_id: player.id });
      await onLogActivity(
        "Yoklama İşaretleme",
        `${player.full_name} Geldi olarak işaretlendi.`
      );
    }
    await onRefreshQr();
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="k-artik p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">CANLI QR OTURUMU</span>
            <h2 className="k-posta text-lg text-[var(--text-primary)]">
              Yoklama Kodu Oluştur &amp; Yönet
            </h2>
          </div>

          <form onSubmit={createQrSession} className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <input
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="Yoklama Başlığı"
                className="k-alan flex-1 min-w-[180px] font-bold"
              />
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="k-alan !w-auto font-bold"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="k-buton k-buton--lacivert w-full !py-2.5"
            >
              Yeni QR Oluştur
            </motion.button>
          </form>

          {activeSession ? (
            <div className="flex flex-col items-center p-5 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-subtle)] space-y-3">
              <div className="text-center space-y-1">
                <span className="k-etiket k-etiket--basari">Aktif Yoklama</span>
                <p className="font-black text-base text-[var(--text-primary)]">
                  {activeSession.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Tarih: {activeSession.session_date}
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <QRCodeSVG value={activeSession.qr_token} size={200} />
              </div>
              <p className="text-xs font-mono font-bold text-[var(--text-muted)]">
                {activeSession.qr_token}
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={closingSession}
                onClick={closeActiveSession}
                className="k-buton k-buton--kirmizi w-full !py-2.5"
              >
                {closingSession
                  ? "Kapatılıyor..."
                  : "Yoklamayı Kapat / Etkinliği Sonlandır"}
              </motion.button>
            </div>
          ) : (
            <div className="text-center py-8 px-4 bg-[var(--bg-subtle)] rounded-2xl border border-dashed border-[var(--border-strong)] space-y-1">
              <p className="text-xs font-extrabold text-[var(--text-primary)]">
                Şu anda aktif bir QR yoklama oturumu bulunmuyor.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Yeni oturum açmak için yukarıdan &ldquo;Yeni QR Oluştur&rdquo;
                butonuna basın.
              </p>
            </div>
          )}
        </div>

        <div className="k-artik p-5 sm:p-6 space-y-3.5">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="k-koz text-[10px] block">ANLIK LİSTE</span>
              <h3 className="k-posta text-lg text-[var(--text-primary)]">
                Yoklama Listesi ({checkedInIds.size} / {players.length})
              </h3>
            </div>
            <input
              placeholder="İsim ara..."
              value={qrSearch}
              onChange={(e) => setQrSearch(e.target.value)}
              className="k-alan !w-44 !py-1.5 text-xs"
            />
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {players
              .filter((p) =>
                p.full_name.toLowerCase().includes(qrSearch.toLowerCase())
              )
              .map((p) => {
                const ok = checkedInIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm flex justify-between items-center transition-colors ${
                      ok
                        ? "bg-[var(--status-success-bg)]/65 text-[var(--text-primary)] font-extrabold"
                        : "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    }`}
                  >
                    <span>
                      {p.full_name}{" "}
                      <span className="text-xs text-[var(--text-muted)] font-semibold">
                        ({p.age_group})
                      </span>
                    </span>
                    {activeSession && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() =>
                          toggleManualAttendance(activeSession.id, p, ok)
                        }
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                          ok
                            ? "bg-emerald-700 text-white"
                            : "bg-[var(--brand-navy)] text-white"
                        }`}
                      >
                        {ok ? "✓ Geldi" : "Geldi İşaretle"}
                      </motion.button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <AttendanceReport
        isAdmin={role === "admin"}
        onSessionDeleted={onRefreshQr}
      />
    </div>
  );
}