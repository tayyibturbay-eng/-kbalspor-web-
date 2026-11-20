"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player, PrayerAttendance, PrayerSession } from "@/types/club";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient();

interface PlayerQrTabProps {
  player: Player;
  allSessions: PrayerSession[];
  attendances: PrayerAttendance[];
  setAttendances: React.Dispatch<React.SetStateAction<PrayerAttendance[]>>;
  teamPlayers: Player[];
  playerAttendedCount: number;
}

export function PlayerQrTab({
  player,
  allSessions,
  attendances,
  setAttendances,
  teamPlayers,
  playerAttendedCount,
}: PlayerQrTabProps) {
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [qrStatus, setQrStatus] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null
  );

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const activeSessions = useMemo(
    () => allSessions.filter((s) => s.is_active),
    [allSessions]
  );

  async function startScanner() {
    setQrStatus(null);
    setScanning(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const qr = new Html5Qrcode("qr-reader");
        scannerRef.current = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            await stopScanner();
            await submitQrCheckIn(decodedText);
          },
          () => {}
        );
      } catch {
        setScanning(false);
        setQrStatus({
          ok: false,
          text: "Kamera açılamadı. Tarayıcı kamera iznini onaylayın veya aşağıdaki alana QR kod metnini yazın.",
        });
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // yoksay
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function submitQrCheckIn(rawToken: string) {
    const token = rawToken.trim();
    if (!token) {
      setQrStatus({ ok: false, text: "Geçersiz QR kod." });
      return;
    }

    const { data: sess } = await supabase
      .from("prayer_sessions")
      .select("*")
      .eq("qr_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!sess) {
      setQrStatus({
        ok: false,
        text: "Bu QR oturumu aktif değil veya bulunamadı.",
      });
      return;
    }

    const already = attendances.some(
      (a) => a.session_id === sess.id && a.player_id === player.id
    );
    if (already) {
      setQrStatus({
        ok: true,
        text: `"${sess.title}" için yoklamanız zaten kayıtlı.`,
      });
      return;
    }

    const { data: inserted, error } = await supabase
      .from("prayer_attendance")
      .insert([{ session_id: sess.id, player_id: player.id }])
      .select()
      .single();

    if (error) {
      setQrStatus({
        ok: false,
        text: "Yoklama kaydedilemedi: " + error.message,
      });
      return;
    }

    if (inserted) {
      setAttendances((prev) => [...prev, inserted as PrayerAttendance]);
    }
    setManualToken("");
    setQrStatus({
      ok: true,
      text: `Harika! "${sess.title}" yoklamanız başarıyla alındı.`,
    });
  }

  async function markTeammatePresent(sessionId: string, targetPlayerId: string) {
    const exists = attendances.some(
      (a) => a.session_id === sessionId && a.player_id === targetPlayerId
    );
    if (exists) return;

    const { data: inserted } = await supabase
      .from("prayer_attendance")
      .insert([{ session_id: sessionId, player_id: targetPlayerId }])
      .select()
      .single();

    if (inserted) {
      setAttendances((prev) => [...prev, inserted as PrayerAttendance]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <h2 className="text-lg font-black text-[#02274c]">
          Tarayıcıdan QR Yoklama Okut
        </h2>
        <p className="text-sm text-slate-600">
          Kamerayı açıp hocanızın veya temsilcinin gösterdiği QR kodu okutun.
        </p>

        {!scanning ? (
          <button
            onClick={startScanner}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white font-extrabold cursor-pointer transition shadow-sm"
          >
            📷 Kamerayı Aç ve QR Okut
          </button>
        ) : (
          <div className="space-y-3">
            <div
              id="qr-reader"
              className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border border-slate-300"
            />
            <button
              onClick={stopScanner}
              className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold cursor-pointer"
            >
              Kamerayı Kapat
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            Kamera açılmazsa QR kod metnini buraya yazabilirsiniz:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="QR kod metni..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={() => submitQrCheckIn(manualToken)}
              className="px-4 py-2.5 rounded-xl bg-[#a60513] text-white text-sm font-extrabold cursor-pointer"
            >
              Onayla
            </button>
          </div>
        </div>

        {qrStatus && (
          <div
            className={`p-3.5 rounded-xl text-sm font-bold border ${
              qrStatus.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {qrStatus.text}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-[#02274c]">
            Geçmiş Etkinlik Katılım Durumum
          </h3>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-extrabold text-[#02274c]">
            Katılım: {playerAttendedCount} / {allSessions.length} Etkinlik
          </span>
        </div>

        {allSessions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Henüz kayıtlı etkinlik bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {allSessions.map((sess) => {
              const attended = attendances.some(
                (a) => a.session_id === sess.id && a.player_id === player.id
              );
              return (
                <div
                  key={sess.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                    attended
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-red-50/50 border-red-200"
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {sess.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      Tarih: {sess.session_date}{" "}
                      {sess.is_active ? "• (Aktif)" : ""}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      attended
                        ? "bg-emerald-600 text-white"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {attended ? "✓ Katıldı" : "✗ Katılmadı"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {player.is_representative && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h3 className="text-lg font-black text-[#a60513]">
            Temsilci Yoklama Paneli
          </h3>
          {activeSessions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Şu anda aktif bir QR oturumu bulunmuyor.
            </p>
          ) : (
            activeSessions.map((sess) => {
              const sessAtt = attendances.filter(
                (a) => a.session_id === sess.id
              );
              return (
                <div
                  key={sess.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-extrabold text-[#02274c]">
                        {sess.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        Tarih: {sess.session_date} • Gelen: {sessAtt.length} kişi
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 self-start">
                      <QRCodeSVG value={sess.qr_token} size={140} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-extrabold text-slate-600 mb-2">
                      Manuel Geldi İşaretle ({player.age_group}):
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {teamPlayers
                        .filter((tp) => tp.age_group === player.age_group)
                        .map((tp) => {
                          const ok = sessAtt.some(
                            (a) => a.player_id === tp.id
                          );
                          return (
                            <div
                              key={tp.id}
                              className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs"
                            >
                              <span className="font-bold text-slate-800">
                                {tp.full_name}
                              </span>
                              {ok ? (
                                <span className="text-emerald-600 font-extrabold">
                                  Geldi ✓
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    markTeammatePresent(sess.id, tp.id)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#02274c] text-white font-bold cursor-pointer"
                                >
                                  Geldi İşaretle
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}