// PlayerQrTab.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player, PrayerAttendance, PrayerSession } from "@/types/club";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient();

type RepPlayer = Player & {
  representative_group?: string | null;
  secondary_age_group?: string | null;
};

interface PlayerQrTabProps {
  player: RepPlayer;
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
  const [qrStatus, setQrStatus] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, []);

  const activeSessions = useMemo(
    () => allSessions.filter((s) => s.is_active),
    [allSessions]
  );

  const representativePlayers = useMemo(() => {
    const repScope = player.representative_group || player.age_group;
    if (!repScope || repScope === "Tümü") {
      return teamPlayers;
    }
    return teamPlayers.filter((tp) => {
      const ext = tp as RepPlayer;
      return tp.age_group === repScope || ext.secondary_age_group === repScope;
    });
  }, [teamPlayers, player]);

  async function stopScanner() {
    if (scannerRef.current) {
      const currentScanner = scannerRef.current;
      scannerRef.current = null;
      try {
        await currentScanner.stop();
        currentScanner.clear();
      } catch {
        // yoksay
      }
    }
    if (mountedRef.current) {
      setScanning(false);
    }
  }

  async function startScanner() {
    setQrStatus(null);
    setScanning(true);
    setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mountedRef.current) return;
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
        if (mountedRef.current) {
          setScanning(false);
          setQrStatus({
            ok: false,
            text: "Kamera açılamadı. Tarayıcı kamera iznini onaylayın veya aşağıdaki alana QR kod metnini yazın.",
          });
        }
      }
    }, 100);
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

    const { data: inserted, error } = await supabase
      .from("prayer_attendance")
      .insert([{ session_id: sessionId, player_id: targetPlayerId }])
      .select()
      .single();

    if (error) {
      setQrStatus({
        ok: false,
        text: "Oyuncu yoklaması kaydedilemedi: " + error.message,
      });
      return;
    }

    if (inserted) {
      setAttendances((prev) => [...prev, inserted as PrayerAttendance]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Tarayıcıdan QR Yoklama Okut
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Kamerayı açıp hocanızın veya temsilcinin gösterdiği QR kodu okutun.
        </p>

        {!scanning ? (
          <button
            type="button"
            onClick={startScanner}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold cursor-pointer transition shadow-sm"
          >
            Kamerayı Aç ve QR Okut
          </button>
        ) : (
          <div className="space-y-3">
            <div
              id="qr-reader"
              className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border border-[var(--border-strong)]"
            />
            <button
              type="button"
              onClick={stopScanner}
              className="px-5 py-2.5 rounded-xl bg-[var(--bg-subtle)] hover:opacity-85 border border-[var(--border-strong)] text-[var(--text-primary)] text-sm font-bold cursor-pointer"
            >
              Kamerayı Kapat
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-[var(--border-subtle)]">
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
            Kamera açılmazsa QR kod metnini buraya yazabilirsiniz:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="QR kod metni..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="button"
              onClick={() => submitQrCheckIn(manualToken)}
              className="px-4 py-2.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-extrabold cursor-pointer"
            >
              Onayla
            </button>
          </div>
        </div>

        {qrStatus && (
          <div
            className={`p-3.5 rounded-xl text-sm font-bold ${
              qrStatus.ok
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
            }`}
          >
            {qrStatus.text}
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-[var(--text-primary)]">
            Geçmiş Etkinlik Katılım Durumum
          </h3>
          <span className="px-3 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] tabular-nums">
            Katılım: {playerAttendedCount} / {allSessions.length} Etkinlik
          </span>
        </div>

        {allSessions.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center space-y-1">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              Henüz kayıtlı etkinlik bulunmuyor.
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Katılım alınan oturumlar burada listelenecek.
            </p>
          </div>
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
                      ? "bg-[var(--status-success-bg)]/50 border-[var(--status-success-text)]/25"
                      : "bg-[var(--status-danger-bg)]/45 border-[var(--status-danger-text)]/25"
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-sm text-[var(--text-primary)]">
                      {sess.title}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                      Tarih: {sess.session_date}{" "}
                      {sess.is_active ? "• (Aktif)" : ""}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      attended
                        ? "bg-[var(--status-success-text)] text-white"
                        : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                    }`}
                  >
                    {attended ? "Katıldı" : "Katılmadı"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {player.is_representative && (
        <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-4 shadow-xs">
          <h3 className="text-lg font-black text-[var(--brand-red)]">
            Temsilci Yoklama Paneli (
            {player.representative_group || "Tüm Takım"})
          </h3>
          {activeSessions.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center">
              <p className="text-sm font-bold text-[var(--text-secondary)]">
                Şu anda aktif bir QR oturumu bulunmuyor.
              </p>
            </div>
          ) : (
            activeSessions.map((sess) => {
              const sessAtt = attendances.filter(
                (a) => a.session_id === sess.id
              );
              return (
                <div
                  key={sess.id}
                  className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">
                        {sess.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                        Tarih: {sess.session_date} • Gelen: {sessAtt.length} kişi
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 self-start">
                      <QRCodeSVG value={sess.qr_token} size={140} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-extrabold text-[var(--text-secondary)] mb-2">
                      Manuel Geldi İşaretle (
                      {player.representative_group || "Tüm Takım"}):
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {representativePlayers.map((tp) => {
                        const ok = sessAtt.some((a) => a.player_id === tp.id);
                        return (
                          <div
                            key={tp.id}
                            className="flex items-center justify-between bg-[var(--bg-surface)] px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs"
                          >
                            <span className="font-bold text-[var(--text-primary)]">
                              {tp.full_name} ({tp.age_group})
                            </span>
                            {ok ? (
                              <span className="text-[var(--status-success-text)] font-extrabold">
                                Geldi
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  markTeammatePresent(sess.id, tp.id)
                                }
                                className="px-2.5 py-1 rounded-lg bg-[var(--brand-navy)] text-white font-bold cursor-pointer"
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