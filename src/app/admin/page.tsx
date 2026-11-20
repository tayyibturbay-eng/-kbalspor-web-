"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { AttendanceReport } from "@/components/admin/AttendanceReport";
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

type Coach = {
  id: string;
  full_name: string;
  coach_code: string;
  pin: string;
  phone: string | null;
  assigned_groups: string[];
  is_active: boolean;
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
  coach_id?: string | null;
  coach_name?: string | null;
  extra_player_ids: string[];
  notes: string | null;
  created_by: string | null;
};

type MembershipRequest = {
  id: string;
  full_name: string;
  birth_date: string | null;
  age_group: string;
  parent_phone: string;
  position: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type ActivityLog = {
  id: string;
  actor: string;
  action: string;
  details: string;
  created_at: string;
};

const POSITIONS = ["Kaleci", "Defans", "Orta Saha", "Forvet"];
const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U19", "Çorum Süper Amatör Ligi"];
const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MATCH_FIELDS = [
  "Nazmi Avluca Spor Tesisi",
  "İtfaiye Sahası",
  "Devane Sahası",
  "Mimarsinan Sahası",
  "Diğer",
];
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function buildDueMonths(): string[] {
  const startDate = new Date(2026, 10, 1);
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const list: string[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    list.push(`${TR_MONTHS[cur.getMonth()]} ${cur.getFullYear()}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return list;
}

const DUE_MONTHS = buildDueMonths();
const NAZMI_AVLUCA =
  "Nazmi Avluca Spor Tesisi — Ulukavak Mah., Çiftlik Çayırı 2. Cad. (Çiftlik Çayırı - Küçük Evler Yolu civarı), Merkez / Çorum";

function calcAgeGroupFromBirthDate(birthDate: string): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.split("-")[0], 10);
  if (isNaN(year)) return "U15";
  if (year < 2007) return "Çorum Süper Amatör Ligi";
  if (year >= 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  return "U19";
}

function subtractHours(timeStr: string, hours: number): string {
  const [hStr, mStr] = (timeStr || "14:00").split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return timeStr || "14:00";
  const newH = (h - hours + 24) % 24;
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeTr(s: string): string {
  return (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWaPhone(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return "9" + digits;
  return "90" + digits;
}

function defaultPinFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "1234";
}

async function sendPushViaApi(
  ageGroups: string[],
  title: string,
  body: string
): Promise<{ sentCount: number; error?: string }> {
  try {
    const res = await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageGroups, title, body }),
    });
    const data = await res.json();
    return { sentCount: Number(data.sentCount) || 0, error: data.error };
  } catch (err) {
    return { sentCount: 0, error: err instanceof Error ? err.message : "Ağ hatası" };
  }
}

export default function AdminPage() {
  const [role, setRole] = useState<"none" | "admin" | "coach">("none");
  const [adminName, setAdminName] = useState("");
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [loginMode, setLoginMode] = useState<"admin" | "coach">("admin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [coachPin, setCoachPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [tab, setTab] = useState<
    | "oyuncular"
    | "talepler"
    | "antrenmanlar"
    | "aidat"
    | "envanter"
    | "gorevler"
    | "bildirim"
    | "namaz"
    | "antrenorler"
    | "islemler"
  >("oyuncular");

  const [players, setPlayers] = useState<Player[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [requestPositions, setRequestPositions] = useState<Record<string, string>>({});
  const [dues, setDues] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendance, setAttendance] = useState<PrayerAttendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [feedback, setFeedback] = useState("");

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("Tümü");
  const [newPlayer, setNewPlayer] = useState({
    full_name: "",
    birth_date: "",
    position: "Orta Saha",
    jersey_number: "",
    parent_phone: "",
    player_code: "",
    player_pin: "",
  });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const [selectedDueMonth, setSelectedDueMonth] = useState("Kasım 2026");
  const [dueGroupFilter, setDueGroupFilter] = useState("Tümü");
  const [monthlyFee, setMonthlyFee] = useState("500");
  const [feeWaMsg, setFeeWaMsg] = useState<string | null>(null);
  const [manualPayPlayerId, setManualPayPlayerId] = useState("");
  const [manualPayMonth, setManualPayMonth] = useState("Kasım 2026");
  const [manualPayAmount, setManualPayAmount] = useState("500");
  const [pastDueMonth, setPastDueMonth] = useState("Kasım 2026");
  const [pastDueCustomNote, setPastDueCustomNote] = useState("");

  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");

  // İsteğe bağlı bildirim gönderme state'leri
  const [notifTargetGroups, setNotifTargetGroups] = useState<string[]>(["Tümü"]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifSaveAnnouncement, setNotifSaveAnnouncement] = useState(true);
  const [notifSending, setNotifSending] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "Mac",
    age_group: "U15",
    event_date: "",
    match_time: "14:00",
    field_choice: "Nazmi Avluca Spor Tesisi",
    custom_location: "",
    has_shuttle: true,
    squad_player_ids: [] as string[],
    notes: "",
  });
  const [matchWaPreview, setMatchWaPreview] = useState<{ message: string; targets: Player[] } | null>(null);

  const [newSessionTitle, setNewSessionTitle] = useState("Kulüp Yoklaması");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [qrSearch, setQrSearch] = useState("");

  const [newCoach, setNewCoach] = useState({
    full_name: "",
    coach_code: "",
    pin: "1234",
    phone: "",
    assigned_groups: ["U13", "U14", "U15"] as string[],
  });

  const [trainingForm, setTrainingForm] = useState({
    id: "",
    title: "",
    training_type: "duzenli" as "duzenli" | "ekstra",
    age_groups: ["U15"] as string[],
    selected_days: ["Çarşamba"] as string[],
    training_date: "",
    start_time: "17:00",
    end_time: "18:30",
    location: NAZMI_AVLUCA,
    coach_id: "",
    extra_player_ids: [] as string[],
    notes: "",
  });
  const [extraPlayerSearch, setExtraPlayerSearch] = useState("");
  const [lastWaBroadcast, setLastWaBroadcast] = useState<{
    message: string;
    targetPlayers: Player[];
  } | null>(null);

  useEffect(() => {
    setNewSessionDate(new Date().toISOString().slice(0, 10));
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setRole("admin");
        setAdminName((data.session.user.user_metadata?.full_name as string) || "");
        await loadAll();
      } else {
        const savedCoach = typeof window !== "undefined" ? localStorage.getItem("ikbal_coach") : null;
        if (savedCoach) {
          try {
            const parsedCoach = JSON.parse(savedCoach) as Coach;
            setActiveCoach(parsedCoach);
            setRole("coach");
            setTab("antrenmanlar");
            setTrainingForm((prev) => ({ ...prev, coach_id: parsedCoach.id }));
            await loadAll();
          } catch {
            localStorage.removeItem("ikbal_coach");
          }
        }
      }
      setCheckingAuth(false);
    })();
  }, []);

  async function logActivity(action: string, details: string) {
    const actor =
      role === "admin"
        ? adminName || "Yönetici"
        : role === "coach" && activeCoach
        ? `Antrenör (${activeCoach.full_name})`
        : "Sistem";
    await supabase.from("activity_logs").insert({ actor, action, details });
  }

  async function loadAll() {
    const [p, r, d, t, s, a, c, tr, lg, st] = await Promise.all([
      supabase.from("players").select("*").order("birth_date", { ascending: true, nullsFirst: false }),
      supabase.from("membership_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("dues").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("coaches").select("*").order("full_name"),
      supabase.from("trainings").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("club_settings").select("*").eq("key", "monthly_fee").maybeSingle(),
    ]);
    if (p.data) setPlayers(p.data);
    if (r.data) setRequests(r.data as MembershipRequest[]);
    if (d.data) setDues(d.data as Due[]);
    if (t.data) setTasks(t.data as TaskAssignment[]);
    if (s.data) setSessions(s.data);
    if (a.data) setAttendance(a.data);
    if (c.data) setCoaches(c.data);
    if (tr.data) setTrainings(tr.data as Training[]);
    if (lg.data) setLogs(lg.data as ActivityLog[]);
    if (st.data?.value) {
      setMonthlyFee(st.data.value);
      setManualPayAmount(st.data.value);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError("Admin girişi başarısız: " + error.message);
      return;
    }
    setRole("admin");
    setAdminName((data.user?.user_metadata?.full_name as string) || "");
    setTab("oyuncular");
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    await loadAll();
  }

  async function handleCoachLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase
      .from("coaches")
      .select("*")
      .eq("coach_code", coachCode.trim().toUpperCase())
      .eq("pin", coachPin.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      setAuthError("Antrenör kodu veya şifre hatalı.");
      return;
    }
    const c = data as Coach;
    localStorage.setItem("ikbal_coach", JSON.stringify(c));
    setActiveCoach(c);
    setRole("coach");
    setTab("antrenmanlar");
    setTrainingForm((prev) => ({ ...prev, coach_id: c.id }));
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    await loadAll();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("ikbal_coach");
    setRole("none");
    setAdminName("");
    setActiveCoach(null);
    window.dispatchEvent(new Event("ikbal-auth-changed"));
  }

  async function handleSendCustomPush(e: React.FormEvent) {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      setFeedback("Lütfen bildirim başlığı ve mesajını yazın.");
      return;
    }
    setNotifSending(true);
    const groups = notifTargetGroups.length === 0 ? ["Tümü"] : notifTargetGroups;
    const pushRes = await sendPushViaApi(groups, notifTitle.trim(), notifBody.trim());

    if (notifSaveAnnouncement) {
      await supabase.from("club_messages").insert({
        title: notifTitle.trim(),
        body: notifBody.trim(),
        target_group: groups.join(", "),
        sender_name: role === "coach" && activeCoach ? activeCoach.full_name : adminName || "Yönetici",
      });
    }

    await logActivity("Bildirim Gönderimi", `[${groups.join(", ")}] ${notifTitle.trim()} (${pushRes.sentCount} cihaz)`);
    setNotifSending(false);

    if (pushRes.error) {
      setFeedback(`⚠️ Bildirim hatası: ${pushRes.error}`);
    } else if (pushRes.sentCount === 0) {
      setFeedback(
        "ℹ️ Kayıtlı telefon token'ı bulunamadı (sporcuların mobil uygulamaya giriş yapması gerekir)." +
          (notifSaveAnnouncement ? " Duyuru siteye/uygulamaya kaydedildi." : "")
      );
    } else {
      setFeedback(`✅ ${pushRes.sentCount} cihaza anlık bildirim gönderildi!`);
      setNotifTitle("");
      setNotifBody("");
    }
  }

  async function approveRequest(req: MembershipRequest) {
    const code = `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const pin = defaultPinFromPhone(req.parent_phone);
    const group = req.birth_date ? calcAgeGroupFromBirthDate(req.birth_date) : req.age_group;
    const chosenPosition = requestPositions[req.id] || req.position || "Orta Saha";

    const { error } = await supabase.from("players").insert({
      full_name: req.full_name,
      birth_date: req.birth_date || null,
      age_group: group,
      position: chosenPosition,
      parent_phone: req.parent_phone,
      player_code: code,
      player_pin: pin,
      pin_changed: false,
    });
    if (error) {
      setFeedback("Onay hatası: " + error.message);
      return;
    }
    await supabase
      .from("membership_requests")
      .update({ status: "onaylandi", position: chosenPosition })
      .eq("id", req.id);
    await logActivity("Üyelik Onayı", `${req.full_name} (${group} - ${chosenPosition}) onaylandı — ID: ${code}`);
    setFeedback(`✅ ${req.full_name} (${chosenPosition}) onaylandı! ID: ${code} | Şifre: ${pin}`);
    loadAll();
  }

  async function deleteRequest(req: MembershipRequest) {
    await supabase.from("membership_requests").delete().eq("id", req.id);
    await logActivity("Üyelik Talebi Silme", `${req.full_name} talebi silindi.`);
    setFeedback("Üyelik talebi silindi.");
    loadAll();
  }

  async function updatePlayerPosition(player: Player, newPosition: string) {
    const { error } = await supabase
      .from("players")
      .update({ position: newPosition })
      .eq("id", player.id);
    if (error) {
      setFeedback("Mevki güncellenemedi: " + error.message);
      return;
    }
    setPlayers((prev) =>
      prev.map((x) => (x.id === player.id ? { ...x, position: newPosition } : x))
    );
    await logActivity("Mevki Güncelleme", `${player.full_name} mevkisi "${newPosition}" yapıldı.`);
    setFeedback(`✅ ${player.full_name} mevkisi "${newPosition}" olarak güncellendi.`);
  }

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    players.forEach((p) => {
      if (!p.birth_date) return;
      const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [players]);

  function getPlayerWarnings(p: Player): string[] {
    const warnings: string[] = [];
    if (!p.birth_date) {
      warnings.push("Doğum tarihi eksik");
    } else {
      const yr = parseInt(p.birth_date.split("-")[0], 10);
      if (isNaN(yr) || yr < 1990 || yr > 2020) warnings.push("Doğum tarihi şüpheli");
    }
    const cleanName = (p.full_name || "").trim();
    if (cleanName.length < 4 || !cleanName.includes(" ") || /\d/.test(cleanName)) {
      warnings.push("İsim/Soyisim kontrol et");
    }
    if (p.birth_date) {
      const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
      if ((duplicateKeys.get(key) || 0) > 1) {
        warnings.push("Çift kayıt");
      }
    }
    return warnings;
  }

  const flaggedPlayersCount = useMemo(
    () => players.filter((p) => getPlayerWarnings(p).length > 0).length,
    [players, duplicateKeys]
  );

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const ageGroup = calcAgeGroupFromBirthDate(newPlayer.birth_date);
    const autoCode = newPlayer.player_code.trim().toUpperCase() || `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const autoPin = newPlayer.player_pin.trim() || defaultPinFromPhone(newPlayer.parent_phone);

    const { error } = await supabase.from("players").insert({
      full_name: newPlayer.full_name.trim(),
      birth_date: newPlayer.birth_date || null,
      age_group: ageGroup,
      position: newPlayer.position,
      jersey_number: newPlayer.jersey_number ? Number(newPlayer.jersey_number) : null,
      parent_phone: newPlayer.parent_phone.trim() || null,
      player_code: autoCode,
      player_pin: autoPin,
      pin_changed: false,
    });

    if (error) {
      setFeedback("Hata: " + error.message);
      return;
    }
    await logActivity("Oyuncu Ekleme", `${newPlayer.full_name} (${ageGroup}) eklendi — ID: ${autoCode}`);
    setFeedback(`✅ ${newPlayer.full_name} (${ageGroup}) eklendi. ID: ${autoCode} | Şifre: ${autoPin}`);
    setNewPlayer({
      full_name: "",
      birth_date: "",
      position: "Orta Saha",
      jersey_number: "",
      parent_phone: "",
      player_code: "",
      player_pin: "",
    });
    loadAll();
  }

  async function savePlayerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
    const updatedAgeGroup = editingPlayer.birth_date
      ? calcAgeGroupFromBirthDate(editingPlayer.birth_date)
      : editingPlayer.age_group;

    const { error } = await supabase
      .from("players")
      .update({
        full_name: editingPlayer.full_name.trim(),
        birth_date: editingPlayer.birth_date || null,
        age_group: updatedAgeGroup,
        position: editingPlayer.position,
        jersey_number: editingPlayer.jersey_number ? Number(editingPlayer.jersey_number) : null,
        parent_phone: editingPlayer.parent_phone?.trim() || null,
        player_code: editingPlayer.player_code?.trim().toUpperCase() || null,
        player_pin: editingPlayer.player_pin?.trim() || "1234",
        is_representative: Boolean(editingPlayer.is_representative),
        license_no: editingPlayer.license_no?.trim() || null,
        bound_device_id: editingPlayer.bound_device_id,
      })
      .eq("id", editingPlayer.id);

    if (error) {
      setFeedback("Güncelleme hatası: " + error.message);
      return;
    }
    await logActivity("Oyuncu Düzenleme", `${editingPlayer.full_name} (${updatedAgeGroup}) bilgileri güncellendi.`);
    setFeedback(`✅ ${editingPlayer.full_name} bilgileri güncellendi (${updatedAgeGroup}).`);
    setEditingPlayer(null);
    loadAll();
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`${name} adlı oyuncuyu silmek istediğinize emin misiniz?`)) return;
    await supabase.from("players").delete().eq("id", id);
    await logActivity("Oyuncu Silme", `${name} kadrodan silindi.`);
    loadAll();
  }

  async function updateMonthlyFee() {
    const feeNum = Number(monthlyFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      setFeedback("Geçerli bir aidat tutarı girin.");
      return;
    }
    const { error: setErr } = await supabase
      .from("club_settings")
      .upsert({ key: "monthly_fee", value: String(feeNum) }, { onConflict: "key" });
    if (setErr) {
      setFeedback("Aidat ücreti kaydedilemedi: " + setErr.message);
      return;
    }
    const msg = `📢 AİDAT ÜCRETİ GÜNCELLEMESİ\nDeğerli velilerimiz ve sporcularımız, Çorum İkbalspor aylık kulüp aidat ücreti ${feeNum}₺ olarak güncellenmiştir. Bilginize sunarız. 🔴🔵`;
    await supabase.from("club_messages").insert({
      title: `📢 Aidat Ücreti Güncellendi (${feeNum}₺)`,
      body: msg,
      target_group: "Tüm Kulüp",
      sender_name: adminName || "Yönetici",
    });
    await logActivity("Aidat Ücreti Güncelleme", `Aylık aidat ücreti ${feeNum}₺ yapıldı ve duyuru gönderildi.`);
    setFeeWaMsg(msg);
    setManualPayAmount(String(feeNum));
    setFeedback(`✅ Aidat ücreti ${feeNum}₺ olarak güncellendi ve bildirim yayınlandı.`);
    loadAll();
  }

  async function handleManualDuePayment(e: React.FormEvent) {
    e.preventDefault();
    const target = players.find((p) => p.id === manualPayPlayerId);
    if (!target) {
      setFeedback("Lütfen ödeme yapan oyuncuyu seçin.");
      return;
    }
    const amountNum = Number(manualPayAmount) || Number(monthlyFee) || 500;
    const existing = dues.find((d) => d.player_id === target.id && d.month_label === manualPayMonth);

    if (existing) {
      const { error } = await supabase
        .from("dues")
        .update({ status: "Ödendi", amount: amountNum, paid_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        setFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      setDues((prev) =>
        prev.map((d) => (d.id === existing.id ? { ...d, status: "Ödendi", amount: amountNum } : d))
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
        setFeedback("Aidat kaydedilemedi: " + error.message);
        return;
      }
      if (data) setDues((prev) => [data as Due, ...prev]);
    }

    await logActivity("Aidat Tahsilatı", `${target.full_name} — ${manualPayMonth} (${amountNum}₺) Ödendi`);
    setSelectedDueMonth(manualPayMonth);
    setFeedback(`✅ ${target.full_name} için ${manualPayMonth} ödemesi (${amountNum}₺) Ödendi olarak kaydedildi.`);
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
        setFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      if (data) setDues((prev) => [data as Due, ...prev]);
      await logActivity("Aidat Tahsilatı", `${player.full_name} — ${selectedDueMonth} (${feeNum}₺) Ödendi`);
      setFeedback(`✅ ${player.full_name} (${selectedDueMonth}) Ödendi olarak işaretlendi.`);
    } else {
      const isPaid = existingDue.status === "Ödendi" || existingDue.status === "paid";
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
        setFeedback("Aidat güncellenemedi: " + error.message);
        return;
      }
      setDues((prev) =>
        prev.map((d) => (d.id === existingDue.id ? { ...d, status: nextStatus, amount: nextAmount } : d))
      );
      await logActivity("Aidat Güncelleme", `${player.full_name} — ${selectedDueMonth} → ${nextStatus}`);
      setFeedback(`✅ ${player.full_name} (${selectedDueMonth}) durumu: ${nextStatus}`);
    }
  }

  async function sendBulkPastDueNotification(unpaidPlayers: Player[]) {
    if (unpaidPlayers.length === 0) {
      setFeedback(`${pastDueMonth} için ödemesi kalan oyuncu bulunmuyor.`);
      return;
    }
    const bodyText =
      pastDueCustomNote.trim() ||
      `📢 AİDAT HATIRLATMA (${pastDueMonth})\nSayın velilerimiz ve sporcularımız, ${pastDueMonth} dönemine ait kulüp aidat ödemesini henüz gerçekleştirmeyen sporcularımızın ödemelerini en kısa sürede tamamlamalarını rica ederiz. 🔴🔵`;

    const { error } = await supabase.from("club_messages").insert({
      title: `⚠️ ${pastDueMonth} Aidat Hatırlatması (${unpaidPlayers.length} Sporcu)`,
      body: bodyText,
      target_group: "Aidat Bekleyenler",
      sender_name: adminName || "Yönetici",
    });

    if (error) {
      setFeedback("Bildirim gönderilemedi: " + error.message);
      return;
    }

    await sendPushViaApi(["Tümü"], `⚠️ ${pastDueMonth} Aidat Hatırlatması`, bodyText);
    await logActivity(
      "Toplu Aidat Hatırlatma",
      `${pastDueMonth} dönemi için ödemesi kalan ${unpaidPlayers.length} sporcuya kulüp bildirimi gönderildi.`
    );
    setFeedback(`✅ ${pastDueMonth} ödemesi kalan ${unpaidPlayers.length} sporcu için toplu kulüp bildirimi gönderildi!`);
  }

  async function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    if (trainingForm.age_groups.length === 0 && trainingForm.extra_player_ids.length === 0) {
      setFeedback("En az 1 yaş grubu veya bireysel oyuncu seçmelisiniz.");
      return;
    }

    const isEdit = Boolean(trainingForm.id);
    const oldTraining = isEdit ? trainings.find((t) => t.id === trainingForm.id) : null;
    const daysToSave = isEdit
      ? [trainingForm.selected_days[0] || "Çarşamba"]
      : trainingForm.training_type === "ekstra"
      ? ["Ekstra"]
      : trainingForm.selected_days.length > 0
      ? trainingForm.selected_days
      : ["Çarşamba"];

    const authorName =
      role === "coach" && activeCoach ? `Antrenör ${activeCoach.full_name}` : adminName || "Yönetici";
    const selectedCoachObj = coaches.find((c) => c.id === trainingForm.coach_id);
    const assignedCoachId = selectedCoachObj ? selectedCoachObj.id : null;
    const assignedCoachName = selectedCoachObj ? selectedCoachObj.full_name : null;

    if (isEdit) {
      const { error } = await supabase
        .from("trainings")
        .update({
          title: trainingForm.title || `${trainingForm.age_groups.join("-")} Antrenmanı`,
          training_type: trainingForm.training_type,
          age_groups: trainingForm.age_groups,
          day_of_week: trainingForm.training_type === "duzenli" ? daysToSave[0] : null,
          training_date: trainingForm.training_date || null,
          start_time: trainingForm.start_time,
          end_time: trainingForm.end_time || null,
          location: trainingForm.location,
          coach_id: assignedCoachId,
          coach_name: assignedCoachName,
          extra_player_ids: trainingForm.extra_player_ids,
          notes: trainingForm.notes || null,
        })
        .eq("id", trainingForm.id);

      if (error) {
        setFeedback("Antrenman güncellenemedi: " + error.message);
        return;
      }
      await logActivity(
        "Antrenman Güncelleme",
        `${trainingForm.age_groups.join(", ")} — ${daysToSave[0]} ${trainingForm.start_time}${assignedCoachName ? ` (Antrenör: ${assignedCoachName})` : ""}`
      );
    } else {
      const rows = daysToSave.map((day) => ({
        title:
          trainingForm.title.trim() ||
          `${trainingForm.age_groups.join("-")} ${trainingForm.training_type === "ekstra" ? "Ekstra" : day} Antrenmanı`,
        training_type: trainingForm.training_type,
        age_groups: trainingForm.age_groups,
        day_of_week: trainingForm.training_type === "duzenli" ? day : null,
        training_date: trainingForm.training_date || null,
        start_time: trainingForm.start_time,
        end_time: trainingForm.end_time || null,
        location: trainingForm.location,
        coach_id: assignedCoachId,
        coach_name: assignedCoachName,
        extra_player_ids: trainingForm.extra_player_ids,
        notes: trainingForm.notes || null,
        created_by: authorName,
      }));
      const { error } = await supabase.from("trainings").insert(rows);
      if (error) {
        setFeedback("Antrenman eklenemedi: " + error.message);
        return;
      }
      await logActivity(
        "Antrenman Ekleme",
        `${trainingForm.age_groups.join(", ")} — ${daysToSave.join(", ")} ${trainingForm.start_time}${assignedCoachName ? ` (Antrenör: ${assignedCoachName})` : ""}`
      );
    }

    const targetPlayers = players.filter(
      (p) => trainingForm.age_groups.includes(p.age_group) || trainingForm.extra_player_ids.includes(p.id)
    );
    const extraNames = players
      .filter((p) => trainingForm.extra_player_ids.includes(p.id) && !trainingForm.age_groups.includes(p.age_group))
      .map((p) => p.full_name);

    const timeChanged =
      oldTraining &&
      (oldTraining.start_time !== trainingForm.start_time ||
        oldTraining.day_of_week !== daysToSave[0] ||
        oldTraining.training_date !== (trainingForm.training_date || null));

    const header = isEdit
      ? timeChanged
        ? "⚠️ ANTRENMAN SAAT / GÜN DEĞİŞİKLİĞİ"
        : "📢 ANTRENMAN GÜNCELLEMESİ"
      : trainingForm.training_type === "ekstra"
      ? "⚡ EKSTRA ANTRENMAN DUYURUSU"
      : "⚽ DÜZENLİ ANTRENMAN PROGRAMI";

    const whenText =
      trainingForm.training_type === "ekstra" && trainingForm.training_date
        ? `${trainingForm.training_date} Saat ${trainingForm.start_time}`
        : `${daysToSave.join(", ")} Saat ${trainingForm.start_time}${trainingForm.end_time ? `-${trainingForm.end_time}` : ""}`;

    const fullMsg = `${header}\nGruplar: ${trainingForm.age_groups.join(", ") || "-"}${
      assignedCoachName ? `\nAntrenör: ${assignedCoachName}` : ""
    }${
      extraNames.length > 0 ? `\nÖzel Çağrılan Oyuncular: ${extraNames.join(", ")}` : ""
    }\nZaman: ${whenText}\nYer: ${trainingForm.location}${trainingForm.notes ? `\nNot: ${trainingForm.notes}` : ""}`;

    await supabase.from("club_messages").insert({
      title: `${header} (${trainingForm.age_groups.join(", ")})`,
      body: fullMsg,
      target_group: trainingForm.age_groups.join(", ") || "Özel Grup",
      sender_name: authorName,
    });

    const pushRes = await sendPushViaApi(
      trainingForm.age_groups,
      "⚽ Antrenman Programı Güncellendi",
      `${trainingForm.age_groups.join(", ")} • ${whenText}`
    );

    setLastWaBroadcast({ message: fullMsg, targetPlayers });
    setFeedback(`✅ Antrenman kaydedildi (${pushRes.sentCount} telefona bildirim gönderildi).`);
    setTrainingForm({
      id: "",
      title: "",
      training_type: "duzenli",
      age_groups: ["U15"],
      selected_days: ["Çarşamba"],
      training_date: "",
      start_time: "17:00",
      end_time: "18:30",
      location: NAZMI_AVLUCA,
      coach_id: role === "coach" && activeCoach ? activeCoach.id : "",
      extra_player_ids: [],
      notes: "",
    });
    loadAll();
  }

  function startEditTraining(tr: Training) {
    setTrainingForm({
      id: tr.id,
      title: tr.title,
      training_type: tr.training_type,
      age_groups: tr.age_groups || [],
      selected_days: tr.day_of_week ? [tr.day_of_week] : ["Çarşamba"],
      training_date: tr.training_date || "",
      start_time: tr.start_time,
      end_time: tr.end_time || "",
      location: tr.location || NAZMI_AVLUCA,
      coach_id: tr.coach_id || "",
      extra_player_ids: tr.extra_player_ids || [],
      notes: tr.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTraining(tr: Training) {
    await supabase.from("trainings").delete().eq("id", tr.id);
    await logActivity("Antrenman Silme", `${tr.title} silindi.`);
    loadAll();
  }

  function buildSympatheticMatchMessage(t: {
    title: string;
    event_date: string;
    match_time: string;
    location: string;
    has_shuttle: boolean;
    age_group: string;
  }): string {
    if (t.has_shuttle) {
      const meetTime = subtractHours(t.match_time, 2);
      return `⚽ Selam şampiyonlar! ${t.event_date} tarihindeki ${t.title} (${t.age_group}) maçımız saat ${t.match_time}'da ${t.location} sahasında. Servisimiz kalkacağı için maçtan 2 saat önce (saat ${meetTime}'da) Nazmi Avluca Spor Tesisi'nde buluşuyoruz! Kramponları ve enerjini unutma 💪🔴🔵`;
    }
    const meetTime = subtractHours(t.match_time, 1);
    return `⚽ Selam şampiyonlar! ${t.event_date} tarihindeki ${t.title} (${t.age_group}) maçımız saat ${t.match_time}'da ${t.location} sahasında. Bu maçta servis olmayacağı için maçtan 1 saat önce (saat ${meetTime}'da) doğrudan ${t.location} sahasında buluşuyoruz! Kramponları ve enerjini unutma 💪🔴🔵`;
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const finalLocation =
      newTask.field_choice === "Diğer" ? newTask.custom_location.trim() || "Özel Saha" : newTask.field_choice;
    const squadIds =
      newTask.squad_player_ids.length > 0
        ? newTask.squad_player_ids
        : players.filter((p) => p.age_group === newTask.age_group).map((p) => p.id);

    const { error } = await supabase.from("tasks_assignments").insert({
      title: newTask.title,
      task_type: newTask.task_type,
      age_group: newTask.age_group,
      event_date: newTask.event_date,
      match_time: newTask.match_time,
      has_shuttle: newTask.has_shuttle,
      squad_player_ids: squadIds,
      location: finalLocation,
      notes: newTask.notes || null,
    });

    if (error) {
      setFeedback("Maç eklenemedi: " + error.message);
      return;
    }

    const msg = buildSympatheticMatchMessage({
      title: newTask.title,
      event_date: newTask.event_date,
      match_time: newTask.match_time,
      location: finalLocation,
      has_shuttle: newTask.has_shuttle,
      age_group: newTask.age_group,
    });

    await supabase.from("club_messages").insert({
      title: `⚽ MAÇ BİLGİLENDİRMESİ: ${newTask.title} (${newTask.age_group})`,
      body: msg,
      target_group: newTask.age_group,
      sender_name: role === "coach" && activeCoach ? `Antrenör ${activeCoach.full_name}` : adminName || "Yönetici",
    });

    const pushRes = await sendPushViaApi(
      [newTask.age_group],
      `⚽ Yeni Maç: ${newTask.title}`,
      `${newTask.event_date} ${newTask.match_time} • ${finalLocation}`
    );

    await logActivity("Maç Ekleme", `${newTask.title} (${newTask.age_group}) — ${newTask.event_date} ${finalLocation}`);
    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    setFeedback(`✅ Maç kaydedildi ve kadroya bildirim gönderildi (${pushRes.sentCount} telefon)!`);
    setNewTask({
      title: "",
      task_type: "Mac",
      age_group: "U15",
      event_date: "",
      match_time: "14:00",
      field_choice: "Nazmi Avluca Spor Tesisi",
      custom_location: "",
      has_shuttle: true,
      squad_player_ids: [],
      notes: "",
    });
    loadAll();
  }

  async function sendOneDayBeforeReminder(t: TaskAssignment) {
    const msg = buildSympatheticMatchMessage({
      title: t.title,
      event_date: t.event_date,
      match_time: t.match_time || "14:00",
      location: t.location,
      has_shuttle: t.has_shuttle ?? true,
      age_group: t.age_group,
    });
    const squadIds =
      t.squad_player_ids && t.squad_player_ids.length > 0
        ? t.squad_player_ids
        : players.filter((p) => p.age_group === t.age_group).map((p) => p.id);

    await supabase.from("club_messages").insert({
      title: `⏰ YARIN MAÇ VAR! ${t.title}`,
      body: msg,
      target_group: t.age_group,
      sender_name: "Maç Hatırlatma",
    });
    const pushRes = await sendPushViaApi(
      [t.age_group],
      `⏰ YARIN MAÇ VAR! ${t.title}`,
      `${t.event_date} ${t.match_time || "14:00"} • ${t.location}`
    );
    await logActivity("Maç Hatırlatma", `${t.title} (${t.age_group}) için 1 gün öncesi hatırlatma gönderildi.`);

    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    setFeedback(`✅ 1 gün öncesi maç hatırlatma bildirimi yayınlandı (${pushRes.sentCount} telefon)!`);
    loadAll();
  }

  async function createQrSession(e: React.FormEvent) {
    e.preventDefault();

    if (role !== "admin") {
      const lastTs = Number(localStorage.getItem("ikbal_last_qr_created_at") || "0");
      const diffMs = Date.now() - lastTs;
      const oneHourMs = 60 * 60 * 1000;
      if (lastTs > 0 && diffMs < oneHourMs) {
        const kalanDakika = Math.ceil((oneHourMs - diffMs) / 60000);
        setFeedback(`⏳ Güvenlik nedeniyle yeni QR kod oluşturmak için ${kalanDakika} dakika beklemelisiniz.`);
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
      setFeedback("Eski QR oturumu kapatılamadı: " + deactErr.message);
      return;
    }

    const { error: insErr } = await supabase.from("prayer_sessions").insert({
      title: newSessionTitle.trim() || "Kulüp Yoklaması",
      qr_token: token,
      session_date: chosenDate,
      is_active: true,
    });

    if (insErr) {
      setFeedback("QR oluşturma hatası: " + insErr.message);
      return;
    }

    if (role !== "admin") {
      localStorage.setItem("ikbal_last_qr_created_at", String(Date.now()));
    }

    await logActivity("QR Yoklama Başlatma", `${newSessionTitle} (${chosenDate})`);
    setFeedback("✅ Yeni QR yoklama oturumu oluşturuldu!");
    await loadAll();
  }

  async function toggleManualAttendance(sessionId: string, player: Player, isPresent: boolean) {
    if (isPresent) {
      await supabase.from("prayer_attendance").delete().eq("session_id", sessionId).eq("player_id", player.id);
      await logActivity("Yoklama İptal", `${player.full_name} yoklamadan çıkarıldı.`);
    } else {
      await supabase.from("prayer_attendance").insert({ session_id: sessionId, player_id: player.id });
      await logActivity("Yoklama İşaretleme", `${player.full_name} Geldi olarak işaretlendi.`);
    }
    loadAll();
  }

  async function addCoach(e: React.FormEvent) {
    e.preventDefault();
    const code = newCoach.coach_code.trim().toUpperCase() || `ANT-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from("coaches").insert({
      full_name: newCoach.full_name.trim(),
      coach_code: code,
      pin: newCoach.pin.trim() || "1234",
      phone: newCoach.phone.trim() || null,
      assigned_groups: newCoach.assigned_groups,
      is_active: true,
    });
    if (error) {
      setFeedback("Antrenör eklenemedi: " + error.message);
      return;
    }
    await logActivity("Antrenör Ekleme", `${newCoach.full_name} (${code}) eklendi.`);
    setFeedback(`✅ Antrenör ${newCoach.full_name} eklendi (Kod: ${code}, Şifre: ${newCoach.pin}).`);
    setNewCoach({ full_name: "", coach_code: "", pin: "1234", phone: "", assigned_groups: ["U13", "U14", "U15"] });
    loadAll();
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-[#02274c] font-bold">Yükleniyor...</div>;
  }

  if (role === "none") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border-t-4 border-[#a60513]">
          <h1 className="text-2xl font-extrabold text-[#02274c] text-center mb-1">Çorum İkbalspor</h1>
          <p className="text-sm text-slate-600 text-center mb-5">Yönetim ve Antrenör Portalı</p>

          <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setLoginMode("admin");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-sm font-bold transition ${
                loginMode === "admin" ? "bg-[#02274c] text-white" : "text-slate-700"
              }`}
            >
              Yönetici (Admin)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("coach");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-sm font-bold transition ${
                loginMode === "coach" ? "bg-[#a60513] text-white" : "text-slate-700"
              }`}
            >
              Antrenör Girişi
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{authError}</div>
          )}

          {loginMode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Admin E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
              />
              <input
                type="password"
                required
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
              />
              <button type="submit" className="w-full bg-[#02274c] text-white font-bold py-2.5 rounded-lg">
                Admin Olarak Giriş Yap
              </button>
            </form>
          ) : (
            <form onSubmit={handleCoachLogin} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Antrenör Kodu (örn: ANT-1001)"
                value={coachCode}
                onChange={(e) => setCoachCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase text-slate-900 bg-white placeholder:text-slate-500"
              />
              <input
                type="password"
                required
                placeholder="Antrenör Şifresi"
                value={coachPin}
                onChange={(e) => setCoachPin(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
              />
              <button type="submit" className="w-full bg-[#a60513] text-white font-bold py-2.5 rounded-lg">
                Antrenör Olarak Giriş Yap
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const filteredPlayers = players.filter(
    (p) =>
      (selectedGroupFilter === "Tümü" || p.age_group === selectedGroupFilter) &&
      (p.full_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
        (p.player_code || "").toLowerCase().includes(playerSearch.toLowerCase()) ||
        p.age_group.toLowerCase().includes(playerSearch.toLowerCase()))
  );

  const groupedPlayers = AGE_GROUPS.map((g) => ({
    group: g,
    items: filteredPlayers.filter((p) => p.age_group === g),
  })).filter((x) => x.items.length > 0);

  const monthDuesMap = new Map<string, Due>();
  dues.filter((d) => d.month_label === selectedDueMonth).forEach((d) => monthDuesMap.set(d.player_id, d));

  const groupedMonthlyDues = AGE_GROUPS.filter((g) => dueGroupFilter === "Tümü" || dueGroupFilter === g)
    .map((g) => {
      const groupPlayers = players.filter((p) => p.age_group === g);
      const rows = groupPlayers
        .map((p) => {
          const due = monthDuesMap.get(p.id);
          const isPaid = Boolean(due && (due.status === "Ödendi" || due.status === "paid"));
          return { player: p, due, isPaid };
        })
        .sort((a, b) => Number(a.isPaid) - Number(b.isPaid));
      const paidCount = rows.filter((r) => r.isPaid).length;
      const paidTotal = rows.reduce((sum, r) => sum + (r.isPaid ? Number(r.due?.amount || monthlyFee) : 0), 0);
      return { group: g, rows, paidCount, paidTotal };
    })
    .filter((x) => x.rows.length > 0);

  const pastDuePaidIds = new Set(
    dues
      .filter((d) => d.month_label === pastDueMonth && (d.status === "Ödendi" || d.status === "paid"))
      .map((d) => d.player_id)
  );
  const pastUnpaidPlayers = players.filter((p) => !pastDuePaidIds.has(p.id));

  const pendingRequests = requests.filter((r) => r.status === "bekliyor");
  const activeSession = sessions.find((s) => s.is_active) || sessions[0];
  const checkedInIds = new Set(
    attendance.filter((a) => activeSession && a.session_id === activeSession.id).map((a) => a.player_id)
  );

  const availableTabs: Array<{ id: typeof tab; label: string }> =
    role === "admin"
      ? [
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "talepler", label: `Üyelik Talepleri (${pendingRequests.length})` },
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "aidat", label: "Aidatlar" },
          { id: "envanter", label: "Forma & Ekipman" },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "bildirim", label: "🔔 Bildirim Gönder" },
          { id: "namaz", label: "QR Yoklama" },
          { id: "antrenorler", label: `Antrenörler (${coaches.length})` },
          { id: "islemler", label: "Son İşlemler" },
        ]
      : [
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "bildirim", label: "🔔 Bildirim Gönder" },
          { id: "namaz", label: "QR Yoklama" },
        ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <div className="bg-[#02274c] text-white px-4 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">
              {role === "admin"
                ? `Çorum İkbalspor — Yönetici Paneli${adminName ? ` (${adminName})` : ""}`
                : `Antrenör Paneli (${activeCoach?.full_name})`}
            </h1>
            <p className="text-xs text-slate-300">
              {role === "coach"
                ? "Oyuncuları yaş grubuna göre görüntüleyebilir, mevkilerini düzenleyebilir, antrenman ve maç ekleyebilirsiniz."
                : "Tam Yetkili Kulüp Yönetimi (19+ yaş sadece Çorum Süper Amatör Ligi)"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#a60513] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-5">
        {feedback && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex justify-between items-center">
            <span>{feedback}</span>
            <button onClick={() => setFeedback("")} className="text-xs font-bold underline ml-3">
              Kapat
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {availableTabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                tab === item.id ? "bg-[#a60513] text-white shadow" : "bg-white text-[#02274c] border"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* İSTEĞE BAĞLI BİLDİRİM GÖNDERME */}
        {tab === "bildirim" && (
          <form onSubmit={handleSendCustomPush} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4 max-w-2xl">
            <div>
              <h2 className="text-lg font-extrabold text-[#02274c]">🔔 İsteğe Bağlı Anlık Bildirim Gönder</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Seçtiğiniz yaş gruplarındaki sporcuların telefonuna anında bildirim gönderin.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#02274c] mb-2">Hedef Kitle:</label>
              <div className="flex flex-wrap gap-1.5">
                {["Tümü", ...AGE_GROUPS].map((g) => {
                  const selected = notifTargetGroups.includes(g);
                  return (
                    <button
                      type="button"
                      key={g}
                      onClick={() => {
                        if (g === "Tümü") {
                          setNotifTargetGroups(["Tümü"]);
                        } else {
                          const withoutAll = notifTargetGroups.filter((x) => x !== "Tümü");
                          const next = selected ? withoutAll.filter((x) => x !== g) : [...withoutAll, g];
                          setNotifTargetGroups(next.length === 0 ? ["Tümü"] : next);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        selected ? "bg-[#02274c] text-white border-[#02274c]" : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Bildirim Başlığı</label>
              <input
                type="text"
                required
                placeholder="Örn: Antrenman Saati Değişikliği"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Bildirim Mesajı</label>
              <textarea
                rows={4}
                required
                placeholder="Sporculara iletmek istediğiniz mesajı yazın..."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-[#02274c]">
              <input
                type="checkbox"
                checked={notifSaveAnnouncement}
                onChange={(e) => setNotifSaveAnnouncement(e.target.checked)}
              />
              Uygulama ve web sitesindeki Duyurular bölümüne de kaydet
            </label>

            <button
              type="submit"
              disabled={notifSending}
              className="bg-[#a60513] hover:bg-[#8a0410] text-white font-extrabold px-6 py-3 rounded-xl text-sm cursor-pointer disabled:opacity-60"
            >
              {notifSending ? "Gönderiliyor..." : "🔔 Bildirimi Gönder"}
            </button>
          </form>
        )}

        {/* SON İŞLEMLER */}
        {tab === "islemler" && role === "admin" && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-extrabold text-[#02274c]">Son İşlemler (Gün & Saat Kayıtları)</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={logDateFilter}
                  onChange={(e) => setLogDateFilter(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-xs"
                />
                <input
                  placeholder="İşlem, kişi veya detay ara..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-xs w-56"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-[#02274c] text-xs">
                  <tr>
                    <th className="p-2.5">Tarih & Saat</th>
                    <th className="p-2.5">Yapan</th>
                    <th className="p-2.5">İşlem</th>
                    <th className="p-2.5">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {logs
                    .filter(
                      (l) =>
                        (!logDateFilter || l.created_at.startsWith(logDateFilter)) &&
                        (l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
                          l.details.toLowerCase().includes(logSearch.toLowerCase()) ||
                          l.actor.toLowerCase().includes(logSearch.toLowerCase()))
                    )
                    .map((l) => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="p-2.5 text-xs font-mono whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </td>
                        <td className="p-2.5 text-xs font-bold text-[#02274c]">{l.actor}</td>
                        <td className="p-2.5">
                          <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded">
                            {l.action}
                          </span>
                        </td>
                        <td className="p-2.5 text-xs text-slate-700">{l.details}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ÜYELİK TALEPLERİ */}
        {tab === "talepler" && role === "admin" && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
            <h2 className="text-lg font-extrabold text-[#02274c]">Gelen Üyelik Talepleri</h2>
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">Henüz üyelik talebi yok.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const selectedPos = requestPositions[r.id] || r.position || "Orta Saha";
                  return (
                    <div
                      key={r.id}
                      className={`border rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 ${
                        r.status === "bekliyor" ? "bg-amber-50 border-amber-300" : "bg-slate-50"
                      }`}
                    >
                      <div className="text-sm">
                        <div className="font-bold text-[#02274c]">
                          {r.full_name} ({r.age_group})
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white border">
                            {r.status === "bekliyor" ? "Onay Bekliyor" : "Onaylandı"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Doğum: {r.birth_date || "-"} | Telefon: {r.parent_phone}
                          {r.status !== "bekliyor" && ` | Mevki: ${r.position || "-"}`}
                        </div>
                        {r.notes && (
                          <div className="text-xs text-slate-500 mt-0.5">Not: {r.notes}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === "bekliyor" && (
                          <>
                            <select
                              value={selectedPos}
                              onChange={(e) =>
                                setRequestPositions((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              className="border border-slate-300 bg-white rounded-lg px-2.5 py-2 text-xs font-bold text-[#02274c]"
                            >
                              {POSITIONS.map((pos) => (
                                <option key={pos} value={pos}>
                                  Mevki: {pos}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => approveRequest(r)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
                            >
                              Onayla & ID Aç
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteRequest(r)}
                          className="bg-red-100 text-red-700 text-xs font-bold px-4 py-2 rounded-lg"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* OYUNCULAR */}
        {tab === "oyuncular" && (
          <div className="space-y-6">
            {role === "admin" && flaggedPlayersCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                <strong>⚠️ Kontrol Edilmesi Gereken {flaggedPlayersCount} Oyuncu Var:</strong> Doğum tarihi eksik, isim
                hatalı veya çift kayıtlar aşağıda işaretlendi.
              </div>
            )}

            {role === "admin" && editingPlayer && (
              <form
                onSubmit={savePlayerEdit}
                className="bg-white p-5 rounded-2xl shadow-md border-2 border-[#a60513] space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold text-[#02274c]">Oyuncu Bilgilerini Düzenle</h2>
                  <button type="button" onClick={() => setEditingPlayer(null)} className="text-sm text-slate-500 underline">
                    Vazgeç
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    required
                    value={editingPlayer.full_name}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, full_name: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={editingPlayer.birth_date || ""}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, birth_date: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={editingPlayer.parent_phone || ""}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, parent_phone: e.target.value })}
                    placeholder="Telefon"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={editingPlayer.position || "Orta Saha"}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, position: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos}>{pos}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Forma No"
                    value={editingPlayer.jersey_number ?? ""}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        jersey_number: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    value={editingPlayer.player_code || ""}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, player_code: e.target.value })}
                    placeholder="Oyuncu ID"
                    className="border rounded-lg px-3 py-2 text-sm uppercase"
                  />
                  <input
                    value={editingPlayer.player_pin || ""}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, player_pin: e.target.value })}
                    placeholder="Şifre"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingPlayer({ ...editingPlayer, bound_device_id: null })}
                    className="border border-amber-400 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-xs font-bold"
                  >
                    {editingPlayer.bound_device_id ? "📱 Cihaz Kilidini Sıfırla" : "📱 Cihaz Bağlı Değil"}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-[#02274c]">
                    <input
                      type="checkbox"
                      checked={Boolean(editingPlayer.is_representative)}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, is_representative: e.target.checked })}
                    />
                    Temsilci Yetkisi Ver
                  </label>
                  <button type="submit" className="bg-[#02274c] text-white font-bold px-6 py-2 rounded-lg text-sm">
                    Değişiklikleri Kaydet
                  </button>
                </div>
              </form>
            )}

            {role === "admin" && (
              <form onSubmit={addPlayer} className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
                <h2 className="font-bold text-[#02274c]">Yeni Oyuncu Ekle</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    required
                    placeholder="Ad Soyad"
                    value={newPlayer.full_name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, full_name: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    required
                    value={newPlayer.birth_date}
                    onChange={(e) => setNewPlayer({ ...newPlayer, birth_date: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Veli Telefon (05xx...)"
                    value={newPlayer.parent_phone}
                    onChange={(e) => setNewPlayer({ ...newPlayer, parent_phone: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos}>{pos}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Forma No"
                    value={newPlayer.jersey_number}
                    onChange={(e) => setNewPlayer({ ...newPlayer, jersey_number: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Özel ID (Boşsa IKB-XXXX)"
                    value={newPlayer.player_code}
                    onChange={(e) => setNewPlayer({ ...newPlayer, player_code: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm uppercase"
                  />
                  <input
                    placeholder="Şifre (Boşsa Tel Son 4)"
                    value={newPlayer.player_pin}
                    onChange={(e) => setNewPlayer({ ...newPlayer, player_pin: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <button type="submit" className="bg-[#a60513] text-white font-bold rounded-lg px-4 py-2 text-sm">
                    Oyuncu Ekle
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {["Tümü", ...AGE_GROUPS].map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGroupFilter(g)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        selectedGroupFilter === g ? "bg-[#02274c] text-white" : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                    </button>
                  ))}
                </div>
                <input
                  placeholder="İsim veya ID ara..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full md:w-64"
                />
              </div>

              {groupedPlayers.map(({ group, items }) => (
                <div key={group} className="border rounded-xl overflow-hidden">
                  <div className="bg-[#02274c] text-white px-4 py-2 font-bold text-sm flex justify-between">
                    <span>{group} Kategorisi</span>
                    <span>{items.length} Oyuncu</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-[#02274c] text-xs">
                        <tr>
                          <th className="p-2.5">Ad Soyad</th>
                          <th className="p-2.5">Doğum Tarihi</th>
                          <th className="p-2.5">Mevki / Forma</th>
                          {role === "admin" && <th className="p-2.5">ID / Şifre</th>}
                          <th className="p-2.5">Telefon</th>
                          {role === "admin" && <th className="p-2.5">İşlem</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const warnings = role === "admin" ? getPlayerWarnings(p) : [];
                          return (
                            <tr
                              key={p.id}
                              className={`border-b ${warnings.length > 0 ? "bg-amber-50/70" : "hover:bg-slate-50"}`}
                            >
                              <td className="p-2.5 font-bold text-[#02274c]">
                                {p.full_name}
                                {p.is_representative && (
                                  <span className="ml-2 text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    Temsilci
                                  </span>
                                )}
                                {warnings.map((w) => (
                                  <span
                                    key={w}
                                    className="inline-block ml-1 text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded"
                                  >
                                    ⚠️ {w}
                                  </span>
                                ))}
                              </td>
                              <td className="p-2.5 text-xs">{p.birth_date || "Eksik"}</td>
                              <td className="p-2.5 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={p.position || "Orta Saha"}
                                    onChange={(e) => updatePlayerPosition(p, e.target.value)}
                                    className="border border-slate-300 bg-white rounded-lg px-2 py-1 text-xs font-bold text-[#02274c]"
                                  >
                                    {POSITIONS.map((pos) => (
                                      <option key={pos} value={pos}>
                                        {pos}
                                      </option>
                                    ))}
                                  </select>
                                  {p.jersey_number ? (
                                    <span className="font-bold text-slate-600">#{p.jersey_number}</span>
                                  ) : null}
                                </div>
                              </td>
                              {role === "admin" && (
                                <td className="p-2.5 font-mono text-xs">
                                  {p.player_code} / {p.player_pin || "1234"}
                                </td>
                              )}
                              <td className="p-2.5 text-xs">{p.parent_phone || "-"}</td>
                              {role === "admin" && (
                                <td className="p-2.5 flex gap-2">
                                  <button
                                    onClick={() => setEditingPlayer(p)}
                                    className="bg-[#02274c] text-white text-xs font-bold px-3 py-1 rounded-lg"
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => deletePlayer(p.id, p.full_name)}
                                    className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-lg"
                                  >
                                    Sil
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANTRENMANLAR */}
        {tab === "antrenmanlar" && (
          <div className="space-y-6">
            <form onSubmit={saveTraining} className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <h2 className="text-lg font-extrabold text-[#02274c]">
                {trainingForm.id ? "Antrenman Düzenle" : "Toplu / Ekstra Antrenman Ekle"}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={trainingForm.training_type}
                  onChange={(e) =>
                    setTrainingForm({ ...trainingForm, training_type: e.target.value as "duzenli" | "ekstra" })
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="duzenli">Düzenli Haftalık Antrenman</option>
                  <option value="ekstra">Ekstra Antrenman / Özel Çalışma</option>
                </select>
                <input
                  placeholder="Başlık (Örn: U13-U14-U15 Taktik İdman)"
                  value={trainingForm.title}
                  onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={trainingForm.coach_id}
                  onChange={(e) => setTrainingForm({ ...trainingForm, coach_id: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm font-bold text-[#02274c]"
                >
                  <option value="">-- Çalıştıracak Antrenörü Seç --</option>
                  {coaches
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Antrenör: {c.full_name}
                      </option>
                    ))}
                </select>
                <input
                  value={trainingForm.location}
                  onChange={(e) => setTrainingForm({ ...trainingForm, location: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((g) => {
                  const checked = trainingForm.age_groups.includes(g);
                  return (
                    <button
                      type="button"
                      key={g}
                      onClick={() =>
                        setTrainingForm({
                          ...trainingForm,
                          age_groups: checked
                            ? trainingForm.age_groups.filter((x) => x !== g)
                            : [...trainingForm.age_groups, g],
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        checked ? "bg-[#02274c] text-white" : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      {checked ? "✓ " : ""}
                      {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {trainingForm.training_type === "duzenli" ? (
                  <div className="md:col-span-2 flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const checked = trainingForm.selected_days.includes(d);
                      return (
                        <button
                          type="button"
                          key={d}
                          onClick={() =>
                            setTrainingForm({
                              ...trainingForm,
                              selected_days: trainingForm.id
                                ? [d]
                                : checked
                                ? trainingForm.selected_days.filter((x) => x !== d)
                                : [...trainingForm.selected_days, d],
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                            checked ? "bg-[#a60513] text-white" : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="date"
                    required
                    value={trainingForm.training_date}
                    onChange={(e) => setTrainingForm({ ...trainingForm, training_date: e.target.value })}
                    className="md:col-span-2 border rounded-lg px-3 py-2 text-sm"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    required
                    value={trainingForm.start_time}
                    onChange={(e) => setTrainingForm({ ...trainingForm, start_time: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={trainingForm.end_time}
                    onChange={(e) => setTrainingForm({ ...trainingForm, end_time: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border">
                <label className="text-xs font-bold text-[#02274c] block mb-1.5">
                  Grup Dışından Bireysel Oyuncu Ekle (Seçili: {trainingForm.extra_player_ids.length})
                </label>
                <input
                  placeholder="Oyuncu ismi ara..."
                  value={extraPlayerSearch}
                  onChange={(e) => setExtraPlayerSearch(e.target.value)}
                  className="w-full md:w-72 border rounded-lg px-3 py-1.5 text-xs mb-2 bg-white"
                />
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {players
                    .filter((p) => p.full_name.toLowerCase().includes(extraPlayerSearch.toLowerCase()))
                    .slice(0, 30)
                    .map((p) => {
                      const selected = trainingForm.extra_player_ids.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() =>
                            setTrainingForm({
                              ...trainingForm,
                              extra_player_ids: selected
                                ? trainingForm.extra_player_ids.filter((id) => id !== p.id)
                                : [...trainingForm.extra_player_ids, p.id],
                            })
                          }
                          className={`px-2.5 py-1 rounded-full text-xs border ${
                            selected ? "bg-emerald-600 text-white" : "bg-white text-slate-700"
                          }`}
                        >
                          {selected ? "✓ " : "+ "}
                          {p.full_name} ({p.age_group})
                        </button>
                      );
                    })}
                </div>
              </div>

              <button type="submit" className="bg-[#02274c] text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                Antrenmanı Kaydet & Gruba Bildir
              </button>
            </form>

            {lastWaBroadcast && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(lastWaBroadcast.message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  📲 WhatsApp Grubunda Paylaş
                </a>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-3">
              {trainings.map((tr) => (
                <div key={tr.id} className="border rounded-xl p-4 space-y-1.5">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-[#02274c]">{tr.title}</h3>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEditTraining(tr)}
                        className="bg-[#02274c] text-white text-xs px-2.5 py-1 rounded-lg font-bold"
                      >
                        Değiştir
                      </button>
                      <button
                        onClick={() => deleteTraining(tr)}
                        className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-lg font-bold"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    {(tr.age_groups || []).join(", ")} • {tr.day_of_week || tr.training_date} {tr.start_time}
                  </div>
                  {tr.coach_name && (
                    <div className="text-xs font-bold text-[#a60513]">👨‍🏫 Antrenör: {tr.coach_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AİDATLAR */}
        {tab === "aidat" && role === "admin" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-[#02274c]">Aylık Aidat Ücreti & Dönem Seçimi</h2>
                <p className="text-xs text-slate-500">
                  Kasım 2026 itibarıyla her yeni ayda 3 ay sonrası otomatik açılır; ödemeyenler her zaman en üstte gösterilir.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Güncel Ücret (₺):</span>
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  className="w-24 border rounded-lg px-3 py-2 text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={updateMonthlyFee}
                  className="bg-[#a60513] text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Ücreti Güncelle & Bildir
                </button>
              </div>
            </div>

            {feeWaMsg && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-emerald-900 font-bold">{feeWaMsg}</span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(feeWaMsg)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  📲 WhatsApp Grubunda Paylaş
                </a>
              </div>
            )}

            <form onSubmit={handleManualDuePayment} className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              <h3 className="font-extrabold text-[#02274c] text-sm">
                Ödeme Ekle (Kişi, Ay ve Verilen Tutarı Seç)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  required
                  value={manualPayPlayerId}
                  onChange={(e) => setManualPayPlayerId(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Ödeme Yapan Oyuncuyu Seç --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.age_group})
                    </option>
                  ))}
                </select>
                <select
                  value={manualPayMonth}
                  onChange={(e) => setManualPayMonth(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {DUE_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  placeholder="Verilen Tutar (₺)"
                  value={manualPayAmount}
                  onChange={(e) => setManualPayAmount(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm font-bold"
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg px-4 py-2 text-sm">
                  ✓ Ödendi Olarak Kaydet
                </button>
              </div>
            </form>

            <div className="bg-amber-50 border border-amber-300 p-5 rounded-2xl space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="font-extrabold text-amber-950 text-sm">
                    📢 Geçmiş Aydan Ödemesi Kalanlara Toplu Bildirim & Mesaj
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    <strong>{pastDueMonth}</strong> döneminde ödemesi henüz alınmamış{" "}
                    <strong>{pastUnpaidPlayers.length} sporcu</strong> bulunuyor.
                  </p>
                </div>
                <select
                  value={pastDueMonth}
                  onChange={(e) => setPastDueMonth(e.target.value)}
                  className="border border-amber-400 bg-white rounded-lg px-3 py-1.5 text-xs font-bold"
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
                className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => sendBulkPastDueNotification(pastUnpaidPlayers)}
                  className="bg-[#02274c] hover:bg-[#033669] text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  🔔 Ödemeyenlere Toplu Kulüp Bildirimi Gönder ({pastUnpaidPlayers.length})
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    pastDueCustomNote.trim() ||
                      `📢 ${pastDueMonth} Aidat Hatırlatması: Henüz ödemesini yapmayan sporcularımızın/velilerimizin aidatlarını tamamlamasını rica ederiz. 🔴🔵`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  📲 WhatsApp Grubunda Hatırlat
                </a>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {DUE_MONTHS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedDueMonth(m)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                        selectedDueMonth === m ? "bg-[#a60513] text-white" : "bg-slate-50 text-[#02274c]"
                      }`}
                    >
                      📅 {m}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {["Tümü", ...AGE_GROUPS].map((g) => (
                    <button
                      key={g}
                      onClick={() => setDueGroupFilter(g)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        dueGroupFilter === g ? "bg-[#02274c] text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                    </button>
                  ))}
                </div>
              </div>

              {groupedMonthlyDues.map(({ group, rows, paidCount, paidTotal }) => (
                <div key={group} className="border rounded-xl overflow-hidden">
                  <div className="bg-[#02274c] text-white px-4 py-2 text-sm font-bold flex flex-wrap justify-between">
                    <span>
                      {group} — {selectedDueMonth}
                    </span>
                    <span>
                      Ödeyen: {paidCount} / {rows.length} • Toplanan: {paidTotal}₺
                    </span>
                  </div>
                  <div className="divide-y">
                    {rows.map(({ player, due, isPaid }) => {
                      const waPhone = cleanWaPhone(player.parent_phone);
                      return (
                        <div
                          key={player.id}
                          className={`px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 text-sm ${
                            !isPaid ? "bg-amber-50/60" : "bg-white"
                          }`}
                        >
                          <div>
                            <strong className="text-[#02274c]">{player.full_name}</strong>{" "}
                            <span className="text-xs text-slate-500">({due?.amount || monthlyFee}₺)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isPaid && waPhone && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                  `Merhaba, ${player.full_name} için ${selectedDueMonth} kulüp aidatı (${monthlyFee}₺) beklenmektedir. Bilginize sunarız.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-white border border-emerald-300 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg"
                              >
                                WP Hatırlat
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePlayerMonthDue(player, due)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                isPaid ? "bg-emerald-600 text-white" : "bg-amber-200 text-amber-950"
                              }`}
                            >
                              {isPaid ? `✓ Ödendi (${due?.amount || monthlyFee}₺)` : "Bekleniyor (Ödendi Yap)"}
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
        )}

        {tab === "envanter" && role === "admin" && <InventoryManager players={players} />}

        {/* MAÇ & GÖREVLER */}
        {tab === "gorevler" && (
          <div className="space-y-6">
            <form onSubmit={addTask} className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <h2 className="text-lg font-extrabold text-[#02274c]">Yeni Maç / Görev Ekle</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="Başlık (Örn: İkbalspor - Çorumspor)"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={newTask.age_group}
                  onChange={(e) => setNewTask({ ...newTask, age_group: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {AGE_GROUPS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={newTask.event_date}
                  onChange={(e) => setNewTask({ ...newTask, event_date: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  required
                  value={newTask.match_time}
                  onChange={(e) => setNewTask({ ...newTask, match_time: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <select
                  value={newTask.field_choice}
                  onChange={(e) => setNewTask({ ...newTask, field_choice: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {MATCH_FIELDS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>

                {newTask.field_choice === "Diğer" && (
                  <input
                    required
                    placeholder="Saha adını yazın..."
                    value={newTask.custom_location}
                    onChange={(e) => setNewTask({ ...newTask, custom_location: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                )}

                <label className="flex items-center gap-2 text-sm font-bold text-[#02274c] bg-slate-50 p-2.5 rounded-lg border">
                  <input
                    type="checkbox"
                    checked={newTask.has_shuttle}
                    onChange={(e) => setNewTask({ ...newTask, has_shuttle: e.target.checked })}
                  />
                  {newTask.has_shuttle
                    ? "🚌 Servis Var (2 saat önce Nazmi Avluca'da)"
                    : "🚶 Servis Yok (1 saat önce maç sahasında)"}
                </label>
              </div>

              <button type="submit" className="bg-[#a60513] text-white font-bold rounded-lg px-6 py-2.5 text-sm">
                Maçı Kaydet & Bildirim Gönder
              </button>
            </form>

            {matchWaPreview && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-bold text-emerald-900">📲 Maç Kadrosu WhatsApp Mesajı</h3>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(matchWaPreview.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    WhatsApp Grubunda Paylaş
                  </a>
                </div>
                <pre className="text-xs bg-white p-3 rounded-lg border whitespace-pre-wrap">{matchWaPreview.message}</pre>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="border-b pb-3 text-sm flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <strong>{t.title}</strong> ({t.age_group}) — {t.event_date} {t.match_time || ""} — {t.location}
                  </div>
                  <button
                    onClick={() => sendOneDayBeforeReminder(t)}
                    className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    ⏰ 1 Gün Önce Bildirim & WP Gönder
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR YOKLAMA */}
        {tab === "namaz" && (
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
                  <button type="submit" className="w-full bg-[#02274c] text-white text-xs font-bold px-4 py-2.5 rounded-lg">
                    Yeni QR Oluştur
                  </button>
                </form>
                {activeSession ? (
                  <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border">
                    <p className="font-bold text-[#02274c]">{activeSession.title}</p>
                    <p className="text-xs text-slate-500 mb-3">Tarih: {activeSession.session_date}</p>
                    <QRCodeSVG value={activeSession.qr_token} size={200} />
                    <p className="text-xs font-mono text-slate-500 mt-2">{activeSession.qr_token}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Henüz aktif bir QR oturumu yok. Yukarıdan &ldquo;Yeni QR Oluştur&rdquo; butonuna basın.
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
                    .filter((p) => p.full_name.toLowerCase().includes(qrSearch.toLowerCase()))
                    .map((p) => {
                      const ok = checkedInIds.has(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`px-3 py-2 rounded-lg text-sm flex justify-between items-center ${
                            ok ? "bg-emerald-100 text-emerald-900 font-bold" : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span>
                            {p.full_name} ({p.age_group})
                          </span>
                          {activeSession && (
                            <button
                              onClick={() => toggleManualAttendance(activeSession.id, p, ok)}
                              className={`text-xs font-bold px-3 py-1 rounded-lg ${
                                ok ? "bg-emerald-700 text-white" : "bg-[#02274c] text-white"
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

            <AttendanceReport isAdmin={role === "admin"} onSessionDeleted={loadAll} />
          </div>
        )}

        {/* ANTRENÖRLER */}
        {tab === "antrenorler" && role === "admin" && (
          <div className="space-y-6">
            <form onSubmit={addCoach} className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              <h2 className="font-bold text-[#02274c]">Yeni Antrenör Ekle</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="Antrenör Ad Soyad"
                  value={newCoach.full_name}
                  onChange={(e) => setNewCoach({ ...newCoach, full_name: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="Antrenör Kodu (Boşsa ANT-XXXX)"
                  value={newCoach.coach_code}
                  onChange={(e) => setNewCoach({ ...newCoach, coach_code: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm uppercase"
                />
                <input
                  placeholder="Giriş Şifresi (PIN)"
                  value={newCoach.pin}
                  onChange={(e) => setNewCoach({ ...newCoach, pin: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="Telefon"
                  value={newCoach.phone}
                  onChange={(e) => setNewCoach({ ...newCoach, phone: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="bg-[#02274c] text-white font-bold px-5 py-2 rounded-lg text-sm">
                Antrenörü Kaydet
              </button>
            </form>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {coaches.map((c) => (
                <div key={c.id} className="flex justify-between items-center border-b pb-2 text-sm">
                  <div>
                    <strong>{c.full_name}</strong> — Kod: <span className="font-mono">{c.coach_code}</span> | Şifre:{" "}
                    <span className="font-mono">{c.pin}</span>
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from("coaches").delete().eq("id", c.id);
                      await logActivity("Antrenör Silme", `${c.full_name} silindi.`);
                      loadAll();
                    }}
                    className="text-xs text-red-700 font-bold"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}