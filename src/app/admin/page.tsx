"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InventoryManager } from "@/components/admin/InventoryManager";
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
};

type Due = {
  id: string;
  player_id: string;
  month_label: string;
  amount: number;
  status: string;
  players?: { full_name: string; age_group: string; parent_phone: string | null };
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

const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U19", "PGL Kadro"];
const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MATCH_FIELDS = ["İtfaiye Sahası", "Devane Sahası", "Mimarsinan Sahası", "Diğer"];
const NAZMI_AVLUCA =
  "Nazmi Avluca Spor Tesisi — Ulukavak Mah., Çiftlik Çayırı 2. Cad. (Çiftlik Çayırı - Küçük Evler Yolu civarı), Merkez / Çorum";

// 19 yaşından büyük oyuncular (2007 öncesi doğumlular) sadece PGL Kadro'da oynar
function calcAgeGroupFromBirthDate(birthDate: string): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.split("-")[0], 10);
  if (isNaN(year)) return "U15";
  if (year < 2007) return "PGL Kadro";
  if (year >= 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  return "U19"; // 2007-2008
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

export default function AdminPage() {
  const [role, setRole] = useState<"none" | "admin" | "coach" | "rep">("none");
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [activeRep, setActiveRep] = useState<Player | null>(null);
  const [loginMode, setLoginMode] = useState<"admin" | "coach" | "rep">("admin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [coachPin, setCoachPin] = useState("");
  const [repCode, setRepCode] = useState("");
  const [repPin, setRepPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [tab, setTab] = useState<
    "oyuncular" | "talepler" | "antrenmanlar" | "aidat" | "envanter" | "gorevler" | "namaz" | "antrenorler" | "islemler"
  >("oyuncular");

  const [players, setPlayers] = useState<Player[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
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

  // Aidat state
  const [newDue, setNewDue] = useState({ player_id: "", month_label: "Kasım 2026", amount: "500" });
  const [bulkDueGroup, setBulkDueGroup] = useState("U15");
  const [dueGroupFilter, setDueGroupFilter] = useState("Tümü");
  const [dueMonthFilter, setDueMonthFilter] = useState("Tümü");

  // Son işlemler filtre
  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");

  // Maç / Görev Formu
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "Mac",
    age_group: "U15",
    event_date: "",
    match_time: "14:00",
    field_choice: "İtfaiye Sahası",
    custom_location: "",
    has_shuttle: true,
    squad_player_ids: [] as string[],
    notes: "",
  });
  const [matchWaPreview, setMatchWaPreview] = useState<{ message: string; targets: Player[] } | null>(null);

  // QR Yoklama
  const [newSessionTitle, setNewSessionTitle] = useState("Kulüp Yoklaması");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
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
    extra_player_ids: [] as string[],
    notes: "",
  });
  const [extraPlayerSearch, setExtraPlayerSearch] = useState("");
  const [lastWaBroadcast, setLastWaBroadcast] = useState<{
    message: string;
    targetPlayers: Player[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setRole("admin");
        await loadAll();
      } else {
        const savedCoach = typeof window !== "undefined" ? localStorage.getItem("ikbal_coach") : null;
        const savedRep = typeof window !== "undefined" ? localStorage.getItem("ikbal_rep") : null;
        if (savedCoach) {
          try {
            setActiveCoach(JSON.parse(savedCoach) as Coach);
            setRole("coach");
            setTab("antrenmanlar");
            await loadAll();
          } catch {
            localStorage.removeItem("ikbal_coach");
          }
        } else if (savedRep) {
          try {
            setActiveRep(JSON.parse(savedRep) as Player);
            setRole("rep");
            setTab("namaz");
            await loadAll();
          } catch {
            localStorage.removeItem("ikbal_rep");
          }
        }
      }
      setCheckingAuth(false);
    })();
  }, []);

  async function logActivity(action: string, details: string) {
    const actor =
      role === "admin"
        ? "Yönetici"
        : role === "coach" && activeCoach
        ? `Antrenör (${activeCoach.full_name})`
        : role === "rep" && activeRep
        ? `Temsilci (${activeRep.full_name})`
        : "Sistem";
    await supabase.from("activity_logs").insert({ actor, action, details });
  }

  async function loadAll() {
    const [p, r, d, t, s, a, c, tr, lg] = await Promise.all([
      supabase.from("players").select("*").order("birth_date", { ascending: true, nullsFirst: false }),
      supabase.from("membership_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("dues").select("*, players(full_name, age_group, parent_phone)").order("created_at", { ascending: false }),
      supabase.from("tasks_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("coaches").select("*").order("full_name"),
      supabase.from("trainings").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
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
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError("Admin girişi başarısız: " + error.message);
      return;
    }
    setRole("admin");
    setTab("oyuncular");
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
    localStorage.setItem("ikbal_coach", JSON.stringify(data));
    setActiveCoach(data as Coach);
    setRole("coach");
    setTab("antrenmanlar");
    await loadAll();
  }

  async function handleRepLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("player_code", repCode.trim().toUpperCase())
      .eq("player_pin", repPin.trim())
      .eq("is_representative", true)
      .maybeSingle();

    if (error || !data) {
      setAuthError("Temsilci ID, şifre hatalı veya temsilci yetkisi tanımlı değil.");
      return;
    }
    localStorage.setItem("ikbal_rep", JSON.stringify(data));
    setActiveRep(data as Player);
    setRole("rep");
    setTab("namaz");
    await loadAll();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("ikbal_coach");
    localStorage.removeItem("ikbal_rep");
    setRole("none");
    setActiveCoach(null);
    setActiveRep(null);
  }

  async function approveRequest(req: MembershipRequest) {
    const code = `IKB-${Math.floor(1000 + Math.random() * 9000)}`;
    const pin = defaultPinFromPhone(req.parent_phone);
    const group = req.birth_date ? calcAgeGroupFromBirthDate(req.birth_date) : req.age_group;
    const { error } = await supabase.from("players").insert({
      full_name: req.full_name,
      birth_date: req.birth_date || null,
      age_group: group,
      position: req.position || "Orta Saha",
      parent_phone: req.parent_phone,
      player_code: code,
      player_pin: pin,
      pin_changed: false,
    });
    if (error) {
      setFeedback("Onay hatası: " + error.message);
      return;
    }
    await supabase.from("membership_requests").update({ status: "onaylandi" }).eq("id", req.id);
    await logActivity("Üyelik Onayı", `${req.full_name} (${group}) onaylandı — ID: ${code}`);
    setFeedback(`✅ ${req.full_name} onaylandı! ID: ${code} | Şifre: ${pin}`);
    loadAll();
  }

  async function deleteRequest(req: MembershipRequest) {
    await supabase.from("membership_requests").delete().eq("id", req.id);
    await logActivity("Üyelik Talebi Silme", `${req.full_name} talebi silindi.`);
    setFeedback("Üyelik talebi silindi.");
    loadAll();
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

    const authorName = role === "coach" && activeCoach ? `Antrenör ${activeCoach.full_name}` : "Yönetici";

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
        `${trainingForm.age_groups.join(", ")} — ${daysToSave[0]} ${trainingForm.start_time}`
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
        `${trainingForm.age_groups.join(", ")} — ${daysToSave.join(", ")} ${trainingForm.start_time}`
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
      extraNames.length > 0 ? `\nÖzel Çağrılan Oyuncular: ${extraNames.join(", ")}` : ""
    }\nZaman: ${whenText}\nYer: ${trainingForm.location}${trainingForm.notes ? `\nNot: ${trainingForm.notes}` : ""}`;

    await supabase.from("club_messages").insert({
      title: `${header} (${trainingForm.age_groups.join(", ")})`,
      body: fullMsg,
      target_group: trainingForm.age_groups.join(", ") || "Özel Grup",
      sender_name: authorName,
    });

    setLastWaBroadcast({ message: fullMsg, targetPlayers });
    setFeedback("✅ Antrenman kaydedildi ve bildirim gönderildi.");
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
      sender_name: role === "coach" && activeCoach ? `Antrenör ${activeCoach.full_name}` : "Yönetici",
    });

    await logActivity("Maç Ekleme", `${newTask.title} (${newTask.age_group}) — ${newTask.event_date} ${finalLocation}`);
    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    setFeedback("✅ Maç kaydedildi ve kadroya bildirim gönderildi!");
    setNewTask({
      title: "",
      task_type: "Mac",
      age_group: "U15",
      event_date: "",
      match_time: "14:00",
      field_choice: "İtfaiye Sahası",
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
    await logActivity("Maç Hatırlatma", `${t.title} (${t.age_group}) için 1 gün öncesi hatırlatma gönderildi.`);

    setMatchWaPreview({
      message: msg,
      targets: players.filter((p) => squadIds.includes(p.id)),
    });
    setFeedback("✅ 1 gün öncesi maç hatırlatma bildirimi yayınlandı!");
    loadAll();
  }

  async function createQrSession(e: React.FormEvent) {
    e.preventDefault();
    const token = `IKB-QR-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from("prayer_sessions").update({ is_active: false }).eq("is_active", true);
    await supabase.from("prayer_sessions").insert({
      title: newSessionTitle || "Kulüp Yoklaması",
      qr_token: token,
      session_date: newSessionDate || new Date().toISOString().slice(0, 10),
      is_active: true,
    });
    await logActivity("QR Yoklama Başlatma", `${newSessionTitle} (${newSessionDate})`);
    loadAll();
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

  async function addDue(e: React.FormEvent) {
    e.preventDefault();
    const p = players.find((x) => x.id === newDue.player_id);
    await supabase.from("dues").insert({
      player_id: newDue.player_id,
      month_label: newDue.month_label,
      amount: Number(newDue.amount) || 500,
      status: "Bekleniyor",
    });
    await logActivity("Aidat Açma", `${p?.full_name || "Oyuncu"} — ${newDue.month_label} (${newDue.amount}₺)`);
    loadAll();
  }

  async function createBulkDuesForGroup() {
    const groupPlayers = players.filter((p) => p.age_group === bulkDueGroup);
    if (groupPlayers.length === 0) {
      setFeedback(`${bulkDueGroup} grubunda oyuncu bulunamadı.`);
      return;
    }
    const existingIds = new Set(
      dues.filter((d) => d.month_label === newDue.month_label).map((d) => d.player_id)
    );
    const toInsert = groupPlayers
      .filter((p) => !existingIds.has(p.id))
      .map((p) => ({
        player_id: p.id,
        month_label: newDue.month_label,
        amount: Number(newDue.amount) || 500,
        status: "Bekleniyor",
      }));

    if (toInsert.length === 0) {
      setFeedback(`${bulkDueGroup} grubu için ${newDue.month_label} aidatları zaten açılmış.`);
      return;
    }
    await supabase.from("dues").insert(toInsert);
    await logActivity("Toplu Aidat Açma", `${bulkDueGroup} (${toInsert.length} oyuncu) — ${newDue.month_label}`);
    setFeedback(`✅ ${bulkDueGroup} grubundaki ${toInsert.length} oyuncuya ${newDue.month_label} aidatı açıldı.`);
    loadAll();
  }

  async function toggleDueStatus(due: Due) {
    const isPaid = due.status === "Ödendi" || due.status === "paid";
    const nextStatus = isPaid ? "Bekleniyor" : "Ödendi";
    await supabase.from("dues").update({ status: nextStatus }).eq("id", due.id);
    await logActivity(
      "Aidat Güncelleme",
      `${due.players?.full_name || "Oyuncu"} (${due.month_label}) → ${nextStatus}`
    );
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
          <p className="text-sm text-slate-600 text-center mb-5">Yönetim, Antrenör ve Temsilci Portalı</p>

          <div className="grid grid-cols-3 gap-1.5 mb-5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setLoginMode("admin");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition ${
                loginMode === "admin" ? "bg-[#02274c] text-white" : "text-slate-700"
              }`}
            >
              Yönetici
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("coach");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition ${
                loginMode === "coach" ? "bg-[#a60513] text-white" : "text-slate-700"
              }`}
            >
              Antrenör
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("rep");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition ${
                loginMode === "rep" ? "bg-emerald-700 text-white" : "text-slate-700"
              }`}
            >
              Temsilci
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{authError}</div>
          )}

          {loginMode === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Admin E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <input
                type="password"
                required
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <button type="submit" className="w-full bg-[#02274c] text-white font-bold py-2.5 rounded-lg">
                Admin Olarak Giriş Yap
              </button>
            </form>
          )}

          {loginMode === "coach" && (
            <form onSubmit={handleCoachLogin} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Antrenör Kodu (örn: ANT-1001)"
                value={coachCode}
                onChange={(e) => setCoachCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-500"
              />
              <input
                type="password"
                required
                placeholder="Antrenör Şifresi"
                value={coachPin}
                onChange={(e) => setCoachPin(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <button type="submit" className="w-full bg-[#a60513] text-white font-bold py-2.5 rounded-lg">
                Antrenör Olarak Giriş Yap
              </button>
            </form>
          )}

          {loginMode === "rep" && (
            <form onSubmit={handleRepLogin} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Temsilci Oyuncu ID (örn: IKB-1234)"
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-500"
              />
              <input
                type="password"
                required
                placeholder="Şifre"
                value={repPin}
                onChange={(e) => setRepPin(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <button type="submit" className="w-full bg-emerald-700 text-white font-bold py-2.5 rounded-lg">
                Temsilci Olarak Giriş Yap
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

  // Aidat gruplama
  const uniqueMonths = Array.from(new Set(dues.map((d) => d.month_label)));
  const filteredDues = dues.filter(
    (d) =>
      (dueGroupFilter === "Tümü" || d.players?.age_group === dueGroupFilter) &&
      (dueMonthFilter === "Tümü" || d.month_label === dueMonthFilter)
  );
  const groupedDues = AGE_GROUPS.map((g) => {
    const items = filteredDues.filter((d) => (d.players?.age_group || "") === g);
    const paidCount = items.filter((d) => d.status === "Ödendi" || d.status === "paid").length;
    const paidTotal = items
      .filter((d) => d.status === "Ödendi" || d.status === "paid")
      .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
    return { group: g, items, paidCount, paidTotal };
  }).filter((x) => x.items.length > 0);

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
          { id: "namaz", label: "QR Yoklama" },
          { id: "antrenorler", label: `Antrenörler (${coaches.length})` },
          { id: "islemler", label: "Son İşlemler" },
        ]
      : role === "coach"
      ? [
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "namaz", label: "QR Yoklama" },
        ]
      : [{ id: "namaz", label: "Temsilci QR & Yoklama" }];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <div className="bg-[#02274c] text-white px-4 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">
              {role === "admin"
                ? "Çorum İkbalspor — Yönetici Paneli"
                : role === "coach"
                ? `Antrenör Paneli (${activeCoach?.full_name})`
                : `Temsilci Paneli (${activeRep?.full_name})`}
            </h1>
            <p className="text-xs text-slate-300">
              {role === "coach"
                ? "Oyuncuları yaş grubuna göre görüntüleyebilir, antrenman ve maç ekleyebilirsiniz."
                : role === "rep"
                ? "QR Yoklama oluşturabilir ve telefonu olmayan oyuncuları işaretleyebilirsiniz."
                : "Tam Yetkili Kulüp Yönetimi (19+ yaş sadece PGL Kadro)"}
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

        {/* SON İŞLEMLER SEKMESİ (GÜN & SAAT BAZLI) */}
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
                {logDateFilter && (
                  <button onClick={() => setLogDateFilter("")} className="text-xs underline text-slate-500">
                    Tarihi Sıfırla
                  </button>
                )}
              </div>
            </div>

            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">Henüz kaydedilmiş işlem yok.</p>
            ) : (
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
            )}
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
                {requests.map((r) => (
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
                        Doğum: {r.birth_date || "-"} | Telefon: {r.parent_phone} | Mevki: {r.position || "-"}
                      </div>
                      {r.notes && <div className="text-xs text-slate-500 mt-1">Not: {r.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      {r.status === "bekliyor" && (
                        <button
                          onClick={() => approveRequest(r)}
                          className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                        >
                          Onayla & ID Aç
                        </button>
                      )}
                      <button
                        onClick={() => deleteRequest(r)}
                        className="bg-red-100 text-red-700 text-xs font-bold px-4 py-2 rounded-lg"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OYUNCULAR */}
        {tab === "oyuncular" && (role === "admin" || role === "coach") && (
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
                    <option>Kaleci</option>
                    <option>Defans</option>
                    <option>Orta Saha</option>
                    <option>Forvet</option>
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
                  <input
                    value={editingPlayer.license_no || ""}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, license_no: e.target.value })}
                    placeholder="TFF Lisans No"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
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
                    <option>Kaleci</option>
                    <option>Defans</option>
                    <option>Orta Saha</option>
                    <option>Forvet</option>
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
                      {g}
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
                                {p.position || "-"} {p.jersey_number ? `#${p.jersey_number}` : ""}
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
        {tab === "antrenmanlar" && (role === "admin" || role === "coach") && (
          <div className="space-y-6">
            <form onSubmit={saveTraining} className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <h2 className="text-lg font-extrabold text-[#02274c]">
                {trainingForm.id ? "Antrenman Düzenle" : "Toplu / Ekstra Antrenman Ekle"}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      {g}
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
                <div className="flex flex-wrap gap-2">
                  {lastWaBroadcast.targetPlayers
                    .filter((p) => cleanWaPhone(p.parent_phone))
                    .map((p) => (
                      <a
                        key={p.id}
                        href={`https://wa.me/${cleanWaPhone(p.parent_phone)}?text=${encodeURIComponent(
                          `Merhaba ${p.full_name},\n${lastWaBroadcast.message}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-lg"
                      >
                        WP: {p.full_name}
                      </a>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-3">
              {trainings.map((tr) => (
                <div key={tr.id} className="border rounded-xl p-4 space-y-2">
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
                  <div className="text-xs text-slate-500">{tr.location}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AİDATLAR (GRUPLANDIRILMIŞ & TOPLU AÇMA) */}
        {tab === "aidat" && role === "admin" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form onSubmit={addDue} className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
                <h3 className="font-bold text-[#02274c] text-sm">Tekil Oyuncuya Aidat Aç</h3>
                <select
                  required
                  value={newDue.player_id}
                  onChange={(e) => setNewDue({ ...newDue, player_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Oyuncu Seç...</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.age_group})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newDue.month_label}
                    onChange={(e) => setNewDue({ ...newDue, month_label: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={newDue.amount}
                    onChange={(e) => setNewDue({ ...newDue, amount: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="w-full bg-[#02274c] text-white font-bold rounded-lg px-4 py-2 text-sm">
                  Aidat Kaydı Aç
                </button>
              </form>

              <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
                <h3 className="font-bold text-[#a60513] text-sm">Tüm Gruba Toplu Aidat Aç</h3>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={bulkDueGroup}
                    onChange={(e) => setBulkDueGroup(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    {AGE_GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  <input
                    value={newDue.month_label}
                    onChange={(e) => setNewDue({ ...newDue, month_label: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={newDue.amount}
                    onChange={(e) => setNewDue({ ...newDue, amount: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={createBulkDuesForGroup}
                  className="w-full bg-[#a60513] text-white font-bold rounded-lg px-4 py-2 text-sm"
                >
                  {bulkDueGroup} Grubuna Toplu Aidat Oluştur
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {["Tümü", ...AGE_GROUPS].map((g) => (
                    <button
                      key={g}
                      onClick={() => setDueGroupFilter(g)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        dueGroupFilter === g ? "bg-[#02274c] text-white" : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <select
                  value={dueMonthFilter}
                  onChange={(e) => setDueMonthFilter(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-xs font-bold"
                >
                  <option value="Tümü">Tüm Aylar</option>
                  {uniqueMonths.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              {groupedDues.map(({ group, items, paidCount, paidTotal }) => (
                <div key={group} className="border rounded-xl overflow-hidden">
                  <div className="bg-[#02274c] text-white px-4 py-2 text-sm font-bold flex flex-wrap justify-between">
                    <span>{group} Aidatları</span>
                    <span>
                      Ödenen: {paidCount} / {items.length} • Toplanan: {paidTotal}₺
                    </span>
                  </div>
                  <div className="divide-y">
                    {items.map((d) => {
                      const isPaid = d.status === "Ödendi" || d.status === "paid";
                      const waPhone = cleanWaPhone(d.players?.parent_phone);
                      return (
                        <div key={d.id} className="px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 text-sm">
                          <div>
                            <strong className="text-[#02274c]">{d.players?.full_name}</strong> — {d.month_label} —{" "}
                            <span className="font-bold">{d.amount}₺</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isPaid && waPhone && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                  `Merhaba, ${d.players?.full_name} için ${d.month_label} kulüp aidatı (${d.amount}₺) henüz ödenmemiştir. Bilginize sunarız.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg"
                              >
                                WP Hatırlat
                              </a>
                            )}
                            <button
                              onClick={() => toggleDueStatus(d)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                isPaid ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isPaid ? "✓ Ödendi" : "Bekleniyor (Ödendi Yap)"}
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
        {tab === "gorevler" && (role === "admin" || role === "coach") && (
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
                <div className="flex flex-wrap gap-2">
                  {matchWaPreview.targets
                    .filter((p) => cleanWaPhone(p.parent_phone))
                    .map((p) => (
                      <a
                        key={p.id}
                        href={`https://wa.me/${cleanWaPhone(p.parent_phone)}?text=${encodeURIComponent(
                          matchWaPreview.message
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-lg"
                      >
                        WP: {p.full_name}
                      </a>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="border-b pb-3 text-sm flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <strong>{t.title}</strong> ({t.age_group}) — {t.event_date} {t.match_time || ""} — {t.location}
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100">
                      {t.has_shuttle ? "🚌 Servis Var" : "🚶 Servis Yok"}
                    </span>
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
              {activeSession && (
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border">
                  <p className="font-bold text-[#02274c]">{activeSession.title}</p>
                  <p className="text-xs text-slate-500 mb-3">Tarih: {activeSession.session_date}</p>
                  <QRCodeSVG value={activeSession.qr_token} size={200} />
                  <p className="text-xs font-mono text-slate-500 mt-2">{activeSession.qr_token}</p>
                </div>
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