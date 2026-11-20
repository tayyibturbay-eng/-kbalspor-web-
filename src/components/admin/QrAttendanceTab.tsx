"use client";

import { useMemo, useState } from "react";
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

  const activeSession = sessions.find((s) => s.is_active) || sessions[0];

  const checkedInIds = useMemo(
    () =>
      new Set(
        attendance
          .filter((a) => activeSession && a.session_id === activeSession.id)
          .map((a) => a.player_id)
      ),
    [attendance, activeSession]
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

  async function toggleManualAttendance(
    sessionId: string,
    player: Player,
    isPresent: boolean
  ) {
    if (isPresent) {
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
          <form onSubmit={createQrSession} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="Yoklama Başlığı"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#02274c] text-white text-xs font-bold px-4 py-2.5 rounded-lg"
            >
              Yeni QR Oluştur
            </button>
          </form>
          {activeSession ? (
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border">
              <p className="font-bold text-[#02274c]">{activeSession.title}</p>
              <p className="text-xs text-slate-500 mb-3">
                Tarih: {activeSession.session_date}
              </p>
              <QRCodeSVG value={activeSession.qr_token} size={200} />
              <p className="text-xs font-mono text-slate-500 mt-2">
                {activeSession.qr_token}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">
              Henüz aktif bir QR oturumu yok. Yukarıdan &ldquo;Yeni QR Oluştur&rdquo;
              butonuna basın.
            </p>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-bold text-[#02274c]">
              Yoklama Listesi ({checkedInIds.size} / {players.length})
            </h3>
            <input
              placeholder="İsim ara..."
              value={qrSearch}
              onChange={(e) => setQrSearch(e.target.value)}
              className="border rounded-lg px-2.5 py-1 text-xs"
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
                        ? "bg-emerald-100 text-emerald-900 font-bold"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>
                      {p.full_name} ({p.age_group})
                    </span>
                    {activeSession && (
                      <button
                        onClick={() =>
                          toggleManualAttendance(activeSession.id, p, ok)
                        }
                        className={`text-xs font-bold px-3 py-1 rounded-lg ${
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

      <AttendanceReport isAdmin={role === "admin"} onSessionDeleted={onRefreshQr} />
    </div>
  );
}