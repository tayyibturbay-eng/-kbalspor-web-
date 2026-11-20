"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient();

type Player = {
  id: string;
  full_name: string;
  age_group: string;
  birth_date: string | null;
  position: string | null;
  jersey_number: number | null;
  parent_phone: string | null;
  player_code: string | null;
  player_pin: string | null;
  pin_changed?: boolean;
  is_representative?: boolean;
  license_no?: string | null;
  bound_device_id?: string | null;
};

type Due = {
  id: string;
  player_id: string;
  month_label: string;
  amount: number;
  status: string;
  paid_at?: string | null;
};

type Training = {
  id: string;
  title: string;
  training_type: "duzenli" | "ekstra";
  age_groups: string[];
  day_of_week: string | null;
  training_date: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  extra_player_ids: string[];
  notes: string | null;
};

type TaskAssignment = {
  id: string;
  title: string;
  task_type: string;
  age_group: string;
  event_date: string;
  match_time?: string | null;
  has_shuttle?: boolean | null;
  squad_player_ids?: string[] | null;
  location: string;
  notes: string | null;
};

type PrayerSession = {
  id: string;
  title: string;
  qr_token: string;
  session_date: string;
  is_active: boolean;
};

type PrayerAttendance = {
  id: string;
  session_id: string;
  player_id: string;
  checked_in_at: string;
};

function getOrCreateWebDeviceId(): string {
  if (typeof window === "undefined") return "web-ssr";
  const key = "ikbal_web_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    const rand =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    id = `web-${rand}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function SporcuPortalPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tab, setTab] = useState<"qr" | "program" | "aidat" | "profil">("qr");

  // Giriş Formu
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Veriler
  const [dues, setDues] = useState<Due[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [activeSessions, setActiveSessions] = useState<PrayerSession[]>([]);
  const [attendances, setAttendances] = useState<PrayerAttendance[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);

  // QR Okutma
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [qrStatus, setQrStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  // PIN Değiştirme
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Oturum kontrolü (sayfa yenilenince açık kalsın)
  useEffect(() => {
    const savedId = localStorage.getItem("ikbal_logged_player_id");
    if (savedId) {
      restoreSession(savedId);
    }
    return () => {
      stopScanner();
    };
  }, []);

  async function restoreSession(playerId: string) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .maybeSingle();
    if (!data) {
      localStorage.removeItem("ikbal_logged_player_id");
      return;
    }
    const p = data as Player;
    const deviceId = getOrCreateWebDeviceId();
    if (p.bound_device_id && p.bound_device_id !== deviceId) {
      localStorage.removeItem("ikbal_logged_player_id");
      return;
    }
    setPlayer(p);
    await loadPlayerData(p);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const cleanCode = code.trim().toUpperCase();
    const cleanPin = pin.trim();
    if (!cleanCode || !cleanPin) {
      setAuthError("Lütfen sporcu kodu ve PIN bilgisini girin.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .ilike("player_code", cleanCode)
      .maybeSingle();

    if (error || !data) {
      setAuthError("Sporcu kodu bulunamadı.");
      setAuthLoading(false);
      return;
    }

    const p = data as Player;
    if ((p.player_pin || "") !== cleanPin) {
      setAuthError("PIN kodu hatalı.");
      setAuthLoading(false);
      return;
    }

    // Cihaz kilidi kontrolü
    const deviceId = getOrCreateWebDeviceId();
    if (p.bound_device_id && p.bound_device_id !== deviceId) {
      setAuthError(
        "Bu hesap başka bir cihaza veya mobil uygulamaya tanımlı. Bu tarayıcıdan giriş için yöneticiden 'Cihaz Kilidini Sıfırla' işlemini isteyin."
      );
      setAuthLoading(false);
      return;
    }

    if (!p.bound_device_id) {
      await supabase
        .from("players")
        .update({ bound_device_id: deviceId })
        .eq("id", p.id);
      p.bound_device_id = deviceId;
    }

    localStorage.setItem("ikbal_logged_player_id", p.id);
    setPlayer(p);
    await loadPlayerData(p);
    setAuthLoading(false);
  }

  async function loadPlayerData(p: Player) {
    const [duesRes, trRes, taskRes, sessRes, attRes] = await Promise.all([
      supabase.from("dues").select("*").eq("player_id", p.id),
      supabase.from("trainings").select("*").order("start_time", { ascending: true }),
      supabase.from("tasks_assignments").select("*").order("event_date", { ascending: true }),
      supabase
        .from("prayer_sessions")
        .select("*")
        .eq("is_active", true)
        .order("session_date", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
    ]);

    if (duesRes.data) setDues(duesRes.data as Due[]);
    if (trRes.data) {
      const filtered = (trRes.data as Training[]).filter(
        (t) =>
          (t.age_groups || []).includes(p.age_group) ||
          (t.extra_player_ids || []).includes(p.id)
      );
      setTrainings(filtered);
    }
    if (taskRes.data) {
      const filteredTasks = (taskRes.data as TaskAssignment[]).filter(
        (t) =>
          t.age_group === p.age_group ||
          t.age_group === "Tümü" ||
          (t.squad_player_ids || []).includes(p.id)
      );
      setTasks(filteredTasks);
    }
    if (sessRes.data) setActiveSessions(sessRes.data as PrayerSession[]);
    if (attRes.data) setAttendances(attRes.data as PrayerAttendance[]);

    if (p.is_representative) {
      const { data: allP } = await supabase
        .from("players")
        .select("*")
        .order("full_name", { ascending: true });
      if (allP) setTeamPlayers(allP as Player[]);
    }
  }

  function handleLogout() {
    stopScanner();
    localStorage.removeItem("ikbal_logged_player_id");
    setPlayer(null);
    setCode("");
    setPin("");
    setQrStatus(null);
  }

  async function startScanner() {
    setQrStatus(null);
    setScanning(true);

    // DOM'un #qr-reader alanını render etmesi için kısa bekleme
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
    if (!player) return;
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
      setQrStatus({ ok: false, text: "Bu QR oturumu aktif değil veya bulunamadı." });
      return;
    }

    const already = attendances.some(
      (a) => a.session_id === sess.id && a.player_id === player.id
    );
    if (already) {
      setQrStatus({ ok: true, text: `"${sess.title}" için yoklamanız zaten kayıtlı.` });
      return;
    }

    const { data: inserted, error } = await supabase
      .from("prayer_attendance")
      .insert([{ session_id: sess.id, player_id: player.id }])
      .select()
      .single();

    if (error) {
      setQrStatus({ ok: false, text: "Yoklama kaydedilemedi: " + error.message });
      return;
    }

    if (inserted) {
      setAttendances((prev) => [...prev, inserted as PrayerAttendance]);
    }
    setManualToken("");
    setQrStatus({ ok: true, text: `Harika! "${sess.title}" yoklamanız başarıyla alındı.` });
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

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!player) return;
    const cleaned = newPin.trim();
    if (cleaned.length < 4) {
      setPinMsg({ ok: false, text: "Yeni PIN en az 4 karakter olmalıdır." });
      return;
    }
    const { error } = await supabase
      .from("players")
      .update({ player_pin: cleaned, pin_changed: true })
      .eq("id", player.id);

    if (error) {
      setPinMsg({ ok: false, text: "PIN güncellenemedi: " + error.message });
      return;
    }
    setPlayer({ ...player, player_pin: cleaned, pin_changed: true });
    setNewPin("");
    setPinMsg({ ok: true, text: "PIN kodunuz başarıyla güncellendi." });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {!player ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 rounded-full bg-[#02274c]/10 text-[#02274c] text-xs font-extrabold uppercase tracking-wider mb-2">
                Sporcu Portalı
              </span>
              <h1 className="text-2xl font-black text-[#02274c]">Sporcu Girişi</h1>
              <p className="text-sm text-slate-500 mt-1">
                Uygulama indirmeden tarayıcıdan QR yoklama verin, aidat ve programınızı görün.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Sporcu Kodu
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Örn: IKB-101"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  PIN Kodu
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white font-extrabold transition cursor-pointer disabled:opacity-60"
              >
                {authLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Üst Bilgi Kartı */}
            <div className="bg-gradient-to-r from-[#02274c] to-[#04376b] text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-extrabold">
                    {player.age_group}
                  </span>
                  {player.is_representative && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#a60513] text-xs font-extrabold">
                      Takım Temsilcisi
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-black mt-1">{player.full_name}</h1>
                <p className="text-xs text-slate-200 mt-0.5">
                  Kod: {player.player_code} • Mevki: {player.position || "-"} • Forma:{" "}
                  {player.jersey_number ?? "-"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-extrabold cursor-pointer transition"
              >
                Çıkış Yap
              </button>
            </div>

            {/* Sekmeler */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "qr", label: "QR Yoklama" },
                { key: "program", label: "Program & Maçlar" },
                { key: "aidat", label: "Aidatlarım" },
                { key: "profil", label: "Profil & PIN" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key !== "qr") stopScanner();
                    setTab(item.key as typeof tab);
                  }}
                  className={`py-3 px-4 rounded-2xl text-sm font-extrabold transition cursor-pointer border ${
                    tab === item.key
                      ? "bg-[#a60513] text-white border-[#a60513] shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* QR YOKLAMA SEKMESİ */}
            {tab === "qr" && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                  <h2 className="text-lg font-black text-[#02274c]">
                    Tarayıcıdan QR Yoklama Okut
                  </h2>
                  <p className="text-sm text-slate-600">
                    Kamerayı açıp hocanızın veya temsilcinin gösterdiği QR kodu okutun.
                  </p>

                  {!scanning ? (
                    <button
                      onClick={startScanner}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white font-extrabold cursor-pointer transition"
                    >
                      Kamerayı Aç ve QR Okut
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

                  {/* Yedek Manuel Kod Alanı */}
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

                {/* Temsilci Özel Bölümü */}
                {player.is_representative && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                    <h3 className="text-lg font-black text-[#a60513]">
                      Temsilci Yoklama Paneli
                    </h3>
                    {activeSessions.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Şu anda aktif bir QR oturumu bulunmuyor.
                      </p>
                    ) : (
                      activeSessions.map((sess) => {
                        const sessAtt = attendances.filter((a) => a.session_id === sess.id);
                        return (
                          <div
                            key={sess.id}
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div>
                                <div className="font-extrabold text-[#02274c]">{sess.title}</div>
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
                                    const ok = sessAtt.some((a) => a.player_id === tp.id);
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
                                            onClick={() => markTeammatePresent(sess.id, tp.id)}
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
            )}

            {/* PROGRAM & MAÇLAR SEKMESİ */}
            {tab === "program" && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                  <h2 className="text-lg font-black text-[#02274c]">Antrenman Programım</h2>
                  {trainings.length === 0 ? (
                    <p className="text-sm text-slate-500">Kayıtlı antrenman bulunamadı.</p>
                  ) : (
                    trainings.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="font-extrabold text-slate-900">{t.title}</div>
                        <div className="text-xs text-slate-600">
                          {t.training_type === "duzenli" ? t.day_of_week : t.training_date} •{" "}
                          {t.start_time}
                          {t.end_time ? ` - ${t.end_time}` : ""}
                        </div>
                        {t.location && (
                          <div className="text-xs text-slate-500">Saha: {t.location}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                  <h2 className="text-lg font-black text-[#a60513]">Maç & Görev Takvimi</h2>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-slate-500">Yaklaşan maç veya görev yok.</p>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="font-extrabold text-slate-900">{task.title}</div>
                        <div className="text-xs text-slate-600">
                          {task.event_date} {task.match_time ? `• ${task.match_time}` : ""}
                        </div>
                        <div className="text-xs text-slate-500">Yer: {task.location}</div>
                        {task.has_shuttle && (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                            Servis Var
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* AİDATLARIM SEKMESİ */}
            {tab === "aidat" && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-lg font-black text-[#02274c]">Aidat Durumum</h2>
                {dues.length === 0 ? (
                  <p className="text-sm text-slate-500">Henüz adınıza tanımlı aidat kaydı yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {dues.map((d) => {
                      const paid = d.status === "odendi" || d.status === "Ödendi";
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50"
                        >
                          <div>
                            <div className="font-extrabold text-slate-900">{d.month_label}</div>
                            <div className="text-xs text-slate-500">{d.amount} TL</div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                              paid
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {paid ? "Ödendi" : "Ödenmedi"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PROFİL & PIN SEKMESİ */}
            {tab === "profil" && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-lg font-black text-[#02274c]">Bilgilerim & PIN Değiştir</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block">Ad Soyad</span>
                    <span className="font-bold">{player.full_name}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block">Lisans No</span>
                    <span className="font-bold">{player.license_no || "Belirtilmemiş"}</span>
                  </div>
                </div>

                <form onSubmit={handlePinChange} className="space-y-3 max-w-sm">
                  <label className="block text-xs font-bold text-slate-600">
                    Yeni PIN Belirle (En az 4 hane)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Yeni PIN..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-[#02274c] text-white text-sm font-extrabold cursor-pointer"
                    >
                      Güncelle
                    </button>
                  </div>
                  {pinMsg && (
                    <div
                      className={`text-xs font-bold ${
                        pinMsg.ok ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {pinMsg.text}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}