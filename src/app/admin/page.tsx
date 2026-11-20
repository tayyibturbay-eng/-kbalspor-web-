"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { InventoryManager } from "@/components/admin/InventoryManager";

interface Player {
  id: string;
  player_code: string;
  player_pin: string | null;
  pin_changed: boolean;
  full_name: string;
  birth_date: string | null;
  age_group: string;
  position: string;
  jersey_number: number | null;
  parent_phone: string | null;
  is_representative: boolean;
}

interface DueRow {
  id: string;
  player_id: string;
  month_label: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
  paid_at: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  task_type: "antrenman" | "mac" | "etkinlik";
  age_group: string;
  event_date: string;
  location: string | null;
}

interface PrayerSession {
  id: string;
  session_date: string;
  qr_token: string;
  mosque_name: string;
}

interface AttendanceRow {
  id: string;
  session_id: string;
  player_id: string;
  scanned_at: string;
}

const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19"];
const POSITIONS = ["Kaleci", "Defans", "Orta Saha", "Forvet"];

function calcAgeGroupFromBirthDate(birthDate: string): string {
  const year = new Date(birthDate).getFullYear();
  const age = 2026 - year;
  if (age <= 11) return "U11";
  if (age >= 19) return "U19";
  return `U${age}`;
}

function defaultPinFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "1234";
}

function waLink(phone: string | null | undefined, text: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export default function IkbalAdminPage() {
  const [checked, setChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");

  const [tab, setTab] = useState<"players" | "dues" | "equipment" | "tasks" | "prayer">("players");

  const [players, setPlayers] = useState<Player[]>([]);
  const [dues, setDues] = useState<DueRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  const [pName, setPName] = useState("");
  const [pBirthDate, setPBirthDate] = useState("2015-01-01");
  const [pPos, setPPos] = useState("Orta Saha");
  const [pNum, setPNum] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pRep, setPRep] = useState(false);

  // ID ve Şifre Düzenleme
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editPin, setEditPin] = useState("");

  const [duePlayerId, setDuePlayerId] = useState("");
  const [dueMonth, setDueMonth] = useState("Kasım 2026");
  const [dueAmount, setDueAmount] = useState("500");

  const [tTitle, setTTitle] = useState("");
  const [tType, setTType] = useState<"antrenman" | "mac" | "etkinlik">("antrenman");
  const [tAge, setTAge] = useState("U11");
  const [tDate, setTDate] = useState("");
  const [tLoc, setTLoc] = useState("");

  const [prayerDate, setPrayerDate] = useState("");
  const [mosqueName, setMosqueName] = useState("Kulüp Sabah Namazı Buluşması");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadAll = async () => {
    const supabase = createClient();
    const [pRes, dRes, tRes, sRes, aRes] = await Promise.all([
      supabase.from("players").select("*").order("age_group", { ascending: true }),
      supabase.from("dues").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks_assignments").select("*").order("event_date", { ascending: true }),
      supabase.from("prayer_sessions").select("*").order("session_date", { ascending: false }),
      supabase.from("prayer_attendance").select("*").order("scanned_at", { ascending: false }),
    ]);
    if (pRes.data) {
      setPlayers(pRes.data as Player[]);
      if (pRes.data.length > 0) setDuePlayerId((prev) => prev || pRes.data[0].id);
    }
    if (dRes.data) setDues(dRes.data as DueRow[]);
    if (tRes.data) setTasks(tRes.data as TaskRow[]);
    if (sRes.data) {
      setSessions(sRes.data as PrayerSession[]);
      if (sRes.data.length > 0) setActiveSessionId((prev) => prev || sRes.data[0].id);
    }
    if (aRes.data) setAttendance(aRes.data as AttendanceRow[]);
  };

  useEffect(() => {
    setPrayerDate(new Date().toISOString().split("T")[0]);
    const init = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setUserEmail(data.user.email ?? "Yönetici");
          loadAll();
        }
      } finally {
        setChecked(true);
      }
    };
    init();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthErr("E-posta veya şifre hatalı.");
      return;
    }
    setUserEmail(data.user?.email ?? "Yönetici");
    loadAll();
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoAgeGroup = calcAgeGroupFromBirthDate(pBirthDate);
    const autoPin = defaultPinFromPhone(pPhone);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("players")
      .insert({
        player_code: code,
        player_pin: autoPin,
        pin_changed: false,
        full_name: pName.trim(),
        birth_date: pBirthDate,
        age_group: autoAgeGroup,
        position: pPos,
        jersey_number: pNum ? Number(pNum) : null,
        parent_phone: pPhone.trim() || null,
        is_representative: pRep,
      })
      .select()
      .single();
    if (!error && data) {
      setPlayers((prev) => [...prev, data as Player]);
      setPName(""); setPNum(""); setPPhone(""); setPRep(false);
    }
  };

  const startEditCredentials = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditCode(p.player_code);
    setEditPin(p.player_pin || "1234");
  };

  const saveEditCredentials = async (id: string) => {
    if (!editCode.trim() || !editPin.trim()) return;
    const supabase = createClient();
    const cleanCode = editCode.trim().toUpperCase();
    const cleanPin = editPin.trim();
    const { error } = await supabase
      .from("players")
      .update({ player_code: cleanCode, player_pin: cleanPin })
      .eq("id", id);

    if (error) {
      alert("Güncellenemedi (ID başka oyuncuda kullanılıyor olabilir): " + error.message);
      return;
    }
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, player_code: cleanCode, player_pin: cleanPin } : p))
    );
    setEditingPlayerId(null);
  };

  const toggleRep = async (p: Player) => {
    const next = !p.is_representative;
    const supabase = createClient();
    const { error } = await supabase.from("players").update({ is_representative: next }).eq("id", p.id);
    if (!error) setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_representative: next } : x)));
  };

  const handleDeletePlayer = async (id: string) => {
    if (!window.confirm("Oyuncuyu silmek istediğinize emin misiniz?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (!error) setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duePlayerId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dues")
      .insert({ player_id: duePlayerId, month_label: dueMonth.trim(), amount: Number(dueAmount) || 500, status: "pending" })
      .select()
      .single();
    if (!error && data) setDues((prev) => [data as DueRow, ...prev]);
  };

  const toggleDueStatus = async (d: DueRow, status: DueRow["status"]) => {
    const supabase = createClient();
    const paid_at = status === "paid" ? new Date().toISOString().split("T")[0] : null;
    const { error } = await supabase.from("dues").update({ status, paid_at }).eq("id", d.id);
    if (!error) setDues((prev) => prev.map((x) => (x.id === d.id ? { ...x, status, paid_at } : x)));
  };

  const sendDueNotification = async (d: DueRow, pl: Player | undefined) => {
    if (!pl) return;
    const supabase = createClient();
    await supabase.from("club_messages").insert({
      sender_name: "Yönetim (Aidat Takip)",
      age_group: pl.age_group,
      message_text: `${pl.full_name} için ${d.month_label} dönemi ${d.amount} ₺ aidat ödemesi beklenmektedir.`,
    });
    alert(`${pl.full_name} için bildirim mesajı gönderildi.`);
  };

  const sendBulkDueNotifications = async () => {
    const unpaid = dues.filter((d) => d.status !== "paid");
    if (unpaid.length === 0) {
      alert("Ödenmemiş aidat bulunmuyor.");
      return;
    }
    const supabase = createClient();
    const rows = unpaid.map((d) => {
      const pl = players.find((p) => p.id === d.player_id);
      return {
        sender_name: "Yönetim (Aidat Hatırlatma)",
        age_group: pl?.age_group || "Tümü",
        message_text: `${pl?.full_name || "Oyuncu"} için ${d.month_label} dönemi ${d.amount} ₺ aidat ödemesi beklenmektedir.`,
      };
    });
    await supabase.from("club_messages").insert(rows);
    alert(`${rows.length} ödenmemiş aidat için bildirim gönderildi.`);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tDate) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks_assignments")
      .insert({
        title: tTitle.trim(),
        task_type: tType,
        age_group: tAge,
        event_date: new Date(tDate).toISOString(),
        location: tLoc.trim() || null,
      })
      .select()
      .single();
    if (!error && data) {
      setTasks((prev) => [...prev, data as TaskRow]);
      setTTitle(""); setTLoc("");
    }
  };

  const handleCreatePrayerSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = `IKB-NAMAZ-${prayerDate}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("prayer_sessions")
      .insert({ session_date: prayerDate, qr_token: token, mosque_name: mosqueName.trim() || "Kulüp Sabah Namazı Buluşması" })
      .select()
      .single();
    if (!error && data) {
      setSessions((prev) => [data as PrayerSession, ...prev]);
      setActiveSessionId(data.id);
    }
  };

  if (!checked) return <div className="min-h-screen flex items-center justify-center font-bold text-[#02274c]">Kontrol ediliyor...</div>;

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#02274c] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md space-y-5 shadow-xl">
          <h1 className="text-2xl font-black text-[#02274c]">İkbalspor Yönetim Paneli</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" required placeholder="Yönetici E-posta" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300" />
            <input type="password" required placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300" />
            {authErr && <p className="text-[#a60513] font-bold text-sm">{authErr}</p>}
            <button type="submit" className="w-full min-h-[50px] rounded-xl bg-[#a60513] text-white font-extrabold">Giriş Yap</button>
          </form>
          <Link href="/" className="block text-center text-sm font-bold text-slate-500">← Ana Sayfaya Dön</Link>
        </div>
      </div>
    );
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const attendedIds = new Set(
    attendance.filter((a) => a.session_id === activeSessionId).map((a) => a.player_id)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <header className="bg-[#02274c] text-white border-b-4 border-[#a60513]">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-300">{userEmail}</span>
            <h1 className="text-xl font-black">Çorum İkbalspor — Yönetim Paneli</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="px-4 py-2 rounded-xl bg-white/10 text-sm font-bold">Siteye Dön</Link>
            <button type="button" onClick={loadAll} className="px-4 py-2 rounded-xl bg-white/10 text-sm font-bold">Yenile</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          {[
            { k: "players", l: `Oyuncular (${players.length})` },
            { k: "dues", l: `Aidat Takibi (${dues.length})` },
            { k: "equipment", l: "Forma & Malzeme Takibi" },
            { k: "tasks", l: `Görev Atama (${tasks.length})` },
            { k: "prayer", l: "QR Yoklama" },
          ].map((item) => (
            <button
              key={item.k}
              type="button"
              onClick={() => setTab(item.k as typeof tab)}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-sm ${
                tab === item.k ? "bg-[#a60513] text-white" : "bg-white border border-slate-300 text-[#02274c]"
              }`}
            >
              {item.l}
            </button>
          ))}
        </div>

        {/* 1. OYUNCULAR */}
        {tab === "players" && (
          <div className="space-y-6">
            <form onSubmit={handleAddPlayer} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-6 gap-3">
              <input type="text" required placeholder="Oyuncu Adı Soyadı" value={pName} onChange={(e) => setPName(e.target.value)} className="sm:col-span-2 min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <div>
                <label className="block text-[10px] font-bold text-slate-500">Doğum Tarihi ({calcAgeGroupFromBirthDate(pBirthDate)})</label>
                <input type="date" required value={pBirthDate} onChange={(e) => setPBirthDate(e.target.value)} className="w-full min-h-[40px] px-2 rounded-xl border-2 border-slate-300 text-sm font-bold" />
              </div>
              <select value={pPos} onChange={(e) => setPPos(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <input type="number" placeholder="Forma No" value={pNum} onChange={(e) => setPNum(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <input type="tel" placeholder="Veli Tel (Son 4 hane şifre olur)" value={pPhone} onChange={(e) => setPPhone(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <label className="sm:col-span-3 flex items-center gap-2 text-sm font-bold text-[#02274c]">
                <input type="checkbox" checked={pRep} onChange={(e) => setPRep(e.target.checked)} className="h-4 w-4" />
                Bu oyuncuyu Yoklama Temsilcisi olarak yetkilendir
              </label>
              <button type="submit" className="sm:col-span-3 min-h-[46px] rounded-xl bg-[#02274c] text-white font-extrabold">Oyuncu Ekle & ID/Şifre Üret</button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
              {players.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="px-2.5 py-1 rounded bg-[#02274c] text-white text-xs font-extrabold mr-2">{p.age_group}</span>
                      <span className="px-2.5 py-1 rounded bg-red-50 text-[#a60513] text-xs font-extrabold mr-2">ID: {p.player_code}</span>
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-extrabold mr-2">
                        Şifre: {p.player_pin || "1234"}
                      </span>
                      <strong className="text-[#02274c]">#{p.jersey_number ?? "-"} {p.full_name}</strong>
                      <span className="text-sm text-slate-500 ml-2">({p.position}{p.birth_date ? ` • ${p.birth_date}` : ""})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditCredentials(p)}
                        className="px-3 py-1.5 rounded-lg border border-[#02274c] text-[#02274c] text-xs font-extrabold"
                      >
                        ID / Şifre Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRep(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold ${
                          p.is_representative ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-600"
                        }`}
                      >
                        {p.is_representative ? "Temsilci ✓" : "Temsilci Yap"}
                      </button>
                      <button type="button" onClick={() => handleDeletePlayer(p.id)} className="text-red-600 font-bold text-sm">Sil</button>
                    </div>
                  </div>

                  {editingPlayerId === p.id && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Oyuncu ID</label>
                        <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-sm uppercase" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Şifre</label>
                        <input type="text" value={editPin} onChange={(e) => setEditPin(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-sm" />
                      </div>
                      <button type="button" onClick={() => saveEditCredentials(p.id)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-extrabold mt-3">Kaydet</button>
                      <button type="button" onClick={() => setEditingPlayerId(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold mt-3">İptal</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. AİDAT TAKİBİ */}
        {tab === "dues" && (
          <div className="space-y-6">
            <form onSubmit={handleAddDue} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-4 gap-3">
              <select value={duePlayerId} onChange={(e) => setDuePlayerId(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                {players.map((p) => <option key={p.id} value={p.id}>{p.age_group} - {p.full_name}</option>)}
              </select>
              <input type="text" required placeholder="Dönem" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <input type="number" required placeholder="Tutar (₺)" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold" />
              <button type="submit" className="min-h-[46px] rounded-xl bg-[#02274c] text-white font-extrabold">Aidat Ekle (500₺)</button>
            </form>

            <div className="flex justify-end">
              <button type="button" onClick={sendBulkDueNotifications} className="px-4 py-2 rounded-xl bg-[#a60513] text-white text-xs font-extrabold">
                Tüm Ödemeyenlere Toplu Bildirim Gönder
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
              {dues.map((d) => {
                const pl = players.find((p) => p.id === d.player_id);
                const wa = waLink(pl?.parent_phone, `Sayın Veli, İkbalspor ${pl?.full_name || ""} (${d.month_label}) dönemi ${d.amount} ₺ aidat ödemesi beklenmektedir.`);
                return (
                  <div key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="text-[#02274c]">{pl?.full_name || "Oyuncu"}</strong>
                      <span className="text-sm text-slate-600 ml-2">{d.month_label} • <strong>{d.amount} ₺</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => toggleDueStatus(d, "paid")} className={`px-3 py-1.5 rounded-lg text-xs font-extrabold ${d.status === "paid" ? "bg-emerald-600 text-white" : "border border-slate-300"}`}>Ödendi</button>
                      <button type="button" onClick={() => toggleDueStatus(d, "pending")} className={`px-3 py-1.5 rounded-lg text-xs font-extrabold ${d.status === "pending" ? "bg-amber-500 text-white" : "border border-slate-300"}`}>Bekliyor</button>
                      {d.status !== "paid" && (
                        <>
                          <button type="button" onClick={() => sendDueNotification(d, pl)} className="px-3 py-1.5 rounded-lg bg-[#02274c] text-white text-xs font-extrabold">Bildirim Gönder</button>
                          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">WhatsApp Hatırlat</a>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. FORMA & MALZEME TAKİBİ */}
        {tab === "equipment" && <InventoryManager players={players} />}

        {/* 4. GÖREV ATAMA */}
        {tab === "tasks" && (
          <div className="space-y-6">
            <form onSubmit={handleAddTask} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-3 gap-3">
              <input type="text" required placeholder="Başlık (Örn: U11 Akşam Antrenmanı)" value={tTitle} onChange={(e) => setTTitle(e.target.value)} className="sm:col-span-2 min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <select value={tType} onChange={(e) => setTType(e.target.value as typeof tType)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                <option value="antrenman">Antrenman</option>
                <option value="mac">Maç</option>
                <option value="etkinlik">Etkinlik</option>
              </select>
              <select value={tAge} onChange={(e) => setTAge(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300 font-bold">
                <option value="Tümü">Tümü</option>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="datetime-local" required value={tDate} onChange={(e) => setTDate(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <input type="text" placeholder="Saha / Konum" value={tLoc} onChange={(e) => setTLoc(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <button type="submit" className="sm:col-span-3 min-h-[46px] rounded-xl bg-[#a60513] text-white font-extrabold">Görev / Maç Ata</button>
            </form>
          </div>
        )}

        {/* 5. QR YOKLAMA */}
        {tab === "prayer" && (
          <div className="space-y-6">
            <form onSubmit={handleCreatePrayerSession} className="bg-white rounded-2xl border border-slate-200 p-6 grid sm:grid-cols-3 gap-3">
              <input type="date" required value={prayerDate} onChange={(e) => setPrayerDate(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <input type="text" placeholder="Etkinlik / Buluşma Yeri" value={mosqueName} onChange={(e) => setMosqueName(e.target.value)} className="min-h-[46px] px-3 rounded-xl border-2 border-slate-300" />
              <button type="submit" className="min-h-[46px] rounded-xl bg-[#02274c] text-white font-extrabold">Yeni QR Oluştur</button>
            </form>

            {activeSession && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 grid md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <QRCodeSVG value={activeSession.qr_token} size={200} />
                  <p className="text-xs font-bold text-slate-600 mt-3 text-center">{activeSession.session_date} • {activeSession.mosque_name}</p>
                </div>
                <div className="md:col-span-8 space-y-3">
                  <h3 className="text-xl font-extrabold text-[#02274c]">
                    Katılım Durumu ({attendedIds.size} / {players.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p) => {
                      const ok = attendedIds.has(p.id);
                      return (
                        <span
                          key={p.id}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${
                            ok
                              ? "bg-emerald-500 border-emerald-600 text-white"
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}
                        >
                          {ok ? "✓ " : ""}{p.age_group} - {p.full_name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}