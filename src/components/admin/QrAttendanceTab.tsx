"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Player,
  PrayerAttendance,
  PrayerSession,
  UserRole,
} from "@/types/club";
import { AttendanceReport } from "@/components/admin/AttendanceReport";
import { QRCodeSVG } from "qrcode.react";

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
  const [newSessionTitle, setNewSessionTitle] = useState("Kulüp Yoklaması");
  const [newSessionDate, setNewSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [qrSearch, setQrSearch] = useState("");
  const [liveAttendance, setLiveAttendance] =
    useState<PrayerAttendance[]>(attendance);
  const [liveSessions, setLiveSessions] = useState<PrayerSession[]>(sessions);
  const [closingSession, setClosingSession] = useState(false);

  useEffect(() => {
    setLiveAttendance(attendance);
  }, [attendance]);

  useEffect(() => {
    setLiveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    const channel = supabase
      .channel("qr-attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prayer_attendance" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const added = payload.new as PrayerAttendance;
            setLiveAttendance((prev) => {
              const exists = prev.some(
                (item) =>
                  item.id === added.id ||
                  (item.session_id === added.session_id &&
                    item.player_id === added.player_id)
              );
              return exists ? prev : [...prev, added];
            });
          } else if (payload.eventType === "DELETE" && payload.old) {
            const removed = payload.old as Partial<PrayerAttendance>;
            setLiveAttendance((prev) =>
              prev.filter(
                (item) =>
                  item.id !== removed.id &&
                  !(
                    removed.session_id &&
                    removed.player_id &&
                    item.session_id === removed.session_id &&
                    item.player_id === removed.player_id
                  )
              )
            );
          }
          onRefreshQr();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prayer_sessions" },
        () => {
          onRefreshQr();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefreshQr]);

  const activeSession = useMemo(
    () => liveSessions.find((s) => s.is_active) || null,
    [liveSessions]
  );

  const latestSession = activeSession || liveSessions[0] || null;

  const checkedInIds = useMemo(
    () =>
      new Set(
        liveAttendance
          .filter((a) => latestSession && a.session_id === latestSession.id)
          .map((a) => a.player_id)
      ),
    [liveAttendance, latestSession]
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
          `⏳ Güvenlik nedeniyle yeni QR kod oluşturmak için ${kalanDakika} dakika beklemelisiniz.`
        );
        return;
      }
    }

    const onay = confirm(
      "Yeni bir QR yoklama oturumu oluşturmak istediğinize emin misiniz? Mevcut aktif QR kodu kapatılacaktır."
    );
    if (!onay) return;

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

    await onLogActivity(
      "QR Yoklama Başlatma",
      `${newSessionTitle} (${chosenDate})`
    );
    onFeedback("✅ Yeni QR yoklama oturumu oluşturuldu!");
    await onRefreshQr();
  }

  async function closeActiveSession() {
    if (!activeSession) return;
    const confirmed = confirm(
      "Etkinliği sonlandırmak istediğinize emin misiniz?"
    );
    if (!confirmed) return;

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

    setLiveSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id ? { ...s, is_active: false } : s
      )
    );
    await onLogActivity(
      "QR Yoklama Kapatma",
      `${activeSession.title} (${activeSession.session_date}) sonlandırıldı.`
    );
    onFeedback("🔒 Yoklama oturumu sonlandırıldı.");
    await onRefreshQr();
  }

  async function toggleManualAttendance(
    sessionId: string,
    player: Player,
    isPresent: boolean
  ) {
    if (isPresent) {
      setLiveAttendance((prev) =>
        prev.filter(
          (a) => !(a.session_id === sessionId && a.player_id === player.id)
        )
      );
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
      setLiveAttendance((prev) => [
        ...prev,
        {
          id: `temp-${sessionId}-${player.id}`,
          session_id: sessionId,
          player_id: player.id,
          created_at: nowIso,
          checked_in_at: nowIso,
        } as PrayerAttendance,
      ]);
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
    <div className="space-y-6 text-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <form onSubmit={createQrSession} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="Yoklama Başlığı"
                className="flex-1 min-w-[180px] border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#02274c] hover:bg-[#033669] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
            >
              Yeni QR Oluştur
            </button>
          </form>

          {activeSession ? (
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="text-center">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-extrabold mb-1">
                  ● Aktif Yoklama
                </span>
                <p className="font-bold text-[#02274c]">
                  {activeSession.title}
                </p>
                <p className="text-xs text-slate-600">
                  Tarih: {activeSession.session_date}
                </p>
              </div>
              <QRCodeSVG value={activeSession.qr_token} size={200} />
              <p className="text-xs font-mono text-slate-600">
                {activeSession.qr_token}
              </p>
              <button
                type="button"
                disabled={closingSession}
                onClick={closeActiveSession}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-lg cursor-pointer"
              >
                {closingSession
                  ? "Kapatılıyor..."
                  : "🔒 Yoklamayı Kapat / Etkinliği Sonlandır"}
              </button>
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <p className="text-xs font-bold text-slate-700">
                Şu anda aktif bir QR yoklama oturumu bulunmuyor.
              </p>
              <p className="text-xs text-slate-500">
                Yeni oturum açmak için yukarıdan &ldquo;Yeni QR Oluştur&rdquo;
                butonuna basın.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-bold text-[#02274c]">
              Yoklama Listesi ({checkedInIds.size} / {players.length})
            </h3>
            <input
              placeholder="İsim ara..."
              value={qrSearch}
              onChange={(e) => setQrSearch(e.target.value)}
              className="border border-slate-300 bg-white text-slate-900 rounded-lg px-2.5 py-1 text-xs"
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
                    className={`px-3 py-2 rounded-lg text-sm flex justify-between items-center ${
                      ok
                        ? "bg-emerald-100 text-emerald-950 font-bold"
                        : "bg-slate-50 text-slate-800"
                    }`}
                  >
                    <span>
                      {p.full_name} ({p.age_group})
                    </span>
                    {activeSession && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleManualAttendance(activeSession.id, p, ok)
                        }
                        className={`text-xs font-bold px-3 py-1 rounded-lg cursor-pointer ${
                          ok
                            ? "bg-emerald-700 text-white"
                            : "bg-[#02274c] text-white"
                        }`}
                      >
                        {ok ? "✓ Geldi" : "Geldi İşaretle"}
                      </button>
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