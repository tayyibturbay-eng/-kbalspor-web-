"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
import InventoryManager from "@/components/admin/InventoryManager";
import { QRCodeSVG } from "qrcode.react";

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
  tff_kisi_id?: string | null;
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

type TffResult = {
  tff_kisi_id: string;
  full_name: string;
  birth_date: string;
  license_no: string;
  club: string;
  birth_place?: string;
  profile_url?: string;
};

const AGE_GROUPS = ["U11", "U12", "U13", "U14", "U15", "U16", "U17", "U19", "PGL Kadro"];
const DAYS_OF_WEEK = ["Pazartesi", "SalÄ±", "Ã‡arÅŸamba", "PerÅŸembe", "Cuma", "Cumartesi", "Pazar"];

function calcAgeGroupFromBirthDate(birthDate: string): string {
  if (!birthDate) return "U15";
  const year = parseInt(birthDate.split("-")[0], 10);
  if (isNaN(year)) return "U15";
  if (year >= 2015) return "U11";
  if (year === 2014) return "U12";
  if (year === 2013) return "U13";
  if (year === 2012) return "U14";
  if (year === 2011) return "U15";
  if (year === 2010) return "U16";
  if (year === 2009) return "U17";
  if (year === 2007 || year === 2008) return "U19";
  return "PGL Kadro";
}

function normalizeTr(s: string): string {
  return (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ÄŸ/g, "g")
    .replace(/Ã¼/g, "u")
    .replace(/ÅŸ/g, "s")
    .replace(/Ä±/g, "i")
    .replace(/Ã¶/g, "o")
    .replace(/Ã§/g, "c")
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
  // Auth state (Admin veya AntrenÃ¶r)
  const [role, setRole] = useState<"none" | "admin" | "coach">("none");
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [loginMode, setLoginMode] = useState<"admin" | "coach">("admin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [coachPin, setCoachPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Tabs
  const [tab, setTab] = useState<
    "oyuncular" | "antrenmanlar" | "tff" | "aidat" | "envanter" | "gorevler" | "namaz" | "antrenorler"
  >("oyuncular");

  // Data
  const [players, setPlayers] = useState<Player[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendance, setAttendance] = useState<PrayerAttendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [feedback, setFeedback] = useState("");

  // Oyuncu ekleme & dÃ¼zenleme
  const [playerSearch, setPlayerSearch] = useState("");
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

  // Aidat form
  const [newDue, setNewDue] = useState({ player_id: "", month_label: "KasÄ±m 2026", amount: "500" });

  // GÃ¶rev form
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "Mac",
    age_group: "U15",
    event_date: "",
    location: "",
    notes: "",
  });

  // QR Yoklama form
  const [newSessionTitle, setNewSessionTitle] = useState("HaftalÄ±k KulÃ¼p YoklamasÄ±");

  // AntrenÃ¶r ekleme form
  const [newCoach, setNewCoach] = useState({
    full_name: "",
    coach_code: "",
    pin: "1234",
    phone: "",
    assigned_groups: ["U13", "U14", "U15"] as string[],
  });

  // Antrenman ProgramÄ± form (Toplu & Ekstra + Grup DÄ±ÅŸÄ± Oyuncular)
  const [trainingForm, setTrainingForm] = useState({
    id: "",
    title: "",
    training_type: "duzenli" as "duzenli" | "ekstra",
    age_groups: ["U15"] as string[],
    selected_days: ["Ã‡arÅŸamba"] as string[],
    training_date: "",
    start_time: "17:00",
    end_time: "18:30",
    location: "Ã‡orum Ä°kbalspor Tesisleri",
    extra_player_ids: [] as string[],
    notes: "",
  });
  const [extraPlayerSearch, setExtraPlayerSearch] = useState("");
  const [lastWaBroadcast, setLastWaBroadcast] = useState<{
    message: string;
    targetPlayers: Player[];
  } | null>(null);

  // TFF AjanÄ± state
  const [tffQuery, setTffQuery] = useState("");
  const [tffUrlOrId, setTffUrlOrId] = useState("");
  const [tffPasteText, setTffPasteText] = useState("");
  const [tffLoading, setTffLoading] = useState(false);
  const [tffError, setTffError] = useState("");
  const [tffResults, setTffResults] = useState<TffResult[]>([]);
  const [tffDraft, setTffDraft] = useState<{
    full_name: string;
    birth_date: string;
    age_group: string;
    license_no: string;
    tff_kisi_id: string;
    parent_phone: string;
    position: string;
    jersey_number: string;
    player_code: string;
    player_pin: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setRole("admin");
        await loadAll();
      } else {
        const savedCoach = typeof window !== "undefined" ? localStorage.getItem("ikbal_coach") : null;
        if (savedCoach) {
          try {
            const parsed = JSON.parse(savedCoach) as Coach;
            setActiveCoach(parsed);
            setRole("coach");
            setTab("antrenmanlar");
            await loadAll();
          } catch {
            localStorage.removeItem("ikbal_coach");
          }
        }
      }
      setCheckingAuth(false);
    })();
  }, []);

  async function loadAll() {
    const [p, d, t, s, a, c, tr] = await Promise.all([
      supabase.from("players").select("*").order("full_name"),
      supabase.from("dues").select("*, players(full_name, age_group, parent_phone)").order("created_at", { ascending: false }),
      supabase.from("tasks_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("coaches").select("*").order("full_name"),
      supabase.from("trainings").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setPlayers(p.data);
    if (d.data) setDues(d.data as Due[]);
    if (t.data) setTasks(t.data);
    if (s.data) setSessions(s.data);
    if (a.data) setAttendance(a.data);
    if (c.data) setCoaches(c.data);
    if (tr.data) setTrainings(tr.data as Training[]);
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError("Admin giriÅŸi baÅŸarÄ±sÄ±z: " + error.message);
      return;
    }
    setRole("admin");
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
      setAuthError("AntrenÃ¶r kodu veya ÅŸifre hatalÄ±.");
      return;
    }
    localStorage.setItem("ikbal_coach", JSON.stringify(data));
    setActiveCoach(data as Coach);
    setRole("coach");
    setTab("antrenmanlar");
    await loadAll();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("ikbal_coach");
    setRole("none");
    setActiveCoach(null);
  }

  // Oyuncu hata & Ã§ift kayÄ±t analizi
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
      warnings.push("DoÄŸum tarihi eksik");
    } else {
      const yr = parseInt(p.birth_date.split("-")[0], 10);
      if (isNaN(yr) || yr < 1995 || yr > 2020) warnings.push("DoÄŸum tarihi ÅŸÃ¼pheli");
    }
    const cleanName = (p.full_name || "").trim();
    if (cleanName.length < 4 || !cleanName.includes(" ") || /\d/.test(cleanName)) {
      warnings.push("Ä°sim/Soyisim kontrol et");
    }
    if (p.birth_date) {
      const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
      if ((duplicateKeys.get(key) || 0) > 1) {
        warnings.push("AynÄ± isim + doÄŸum tarihli Ã§ift kayÄ±t");
      }
    }
    return warnings;
  }

  const flaggedPlayersCount = useMemo(
    () => players.filter((p) => getPlayerWarnings(p).length > 0).length,
    [players, duplicateKeys]
  );

  // Oyuncu Ekle
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
    setFeedback(`âœ… ${newPlayer.full_name} (${ageGroup}) eklendi. ID: ${autoCode} | Åifre: ${autoPin}`);
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

  // Oyuncu Tam DÃ¼zenleme Kaydet
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
      setFeedback("GÃ¼ncelleme hatasÄ±: " + error.message);
      return;
    }
    setFeedback(`âœ… ${editingPlayer.full_name} bilgileri gÃ¼ncellendi (${updatedAgeGroup}).`);
    setEditingPlayer(null);
    loadAll();
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`${name} adlÄ± oyuncuyu silmek istediÄŸinize emin misiniz?`)) return;
    await supabase.from("players").delete().eq("id", id);
    loadAll();
  }

  // Antrenman ProgramÄ± Kaydet / GÃ¼ncelle + Bildirim & WhatsApp
  async function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    if (trainingForm.age_groups.length === 0 && trainingForm.extra_player_ids.length === 0) {
      setFeedback("En az 1 yaÅŸ grubu veya bireysel oyuncu seÃ§melisiniz.");
      return;
    }

    const isEdit = Boolean(trainingForm.id);
    const oldTraining = isEdit ? trainings.find((t) => t.id === trainingForm.id) : null;
    const daysToSave = isEdit
      ? [trainingForm.selected_days[0] || "Ã‡arÅŸamba"]
      : trainingForm.training_type === "ekstra"
      ? ["Ekstra"]
      : trainingForm.selected_days.length > 0
      ? trainingForm.selected_days
      : ["Ã‡arÅŸamba"];

    const authorName = role === "coach" && activeCoach ? `AntrenÃ¶r ${activeCoach.full_name}` : "YÃ¶netici";

    if (isEdit) {
      const { error } = await supabase
        .from("trainings")
        .update({
          title: trainingForm.title || `${trainingForm.age_groups.join("-")} AntrenmanÄ±`,
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
        setFeedback("Antrenman gÃ¼ncellenemedi: " + error.message);
        return;
      }
    } else {
      const rows = daysToSave.map((day) => ({
        title:
          trainingForm.title.trim() ||
          `${trainingForm.age_groups.join("-")} ${trainingForm.training_type === "ekstra" ? "Ekstra" : day} AntrenmanÄ±`,
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
    }

    // Hedef oyuncular (SeÃ§ilen gruplar + grup dÄ±ÅŸÄ± ekstra oyuncular)
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
        ? "âš ï¸ ANTRENMAN SAAT / GÃœN DEÄÄ°ÅÄ°KLÄ°ÄÄ°"
        : "ğŸ“¢ ANTRENMAN GÃœNCELLEMESÄ°"
      : trainingForm.training_type === "ekstra"
      ? "âš¡ EKSTRA ANTRENMAN DUYURUSU"
      : "âš½ DÃœZENLÄ° ANTRENMAN PROGRAMI";

    const whenText =
      trainingForm.training_type === "ekstra" && trainingForm.training_date
        ? `${trainingForm.training_date} Saat ${trainingForm.start_time}`
        : `${daysToSave.join(", ")} Saat ${trainingForm.start_time}${trainingForm.end_time ? `-${trainingForm.end_time}` : ""}`;

    const fullMsg = `${header}\nGruplar: ${trainingForm.age_groups.join(", ") || "-"}${
      extraNames.length > 0 ? `\nÃ–zel Ã‡aÄŸrÄ±lan Oyuncular: ${extraNames.join(", ")}` : ""
    }\nZaman: ${whenText}\nYer: ${trainingForm.location}${trainingForm.notes ? `\nNot: ${trainingForm.notes}` : ""}`;

    // KulÃ¼p bildirimlerine otomatik yaz
    await supabase.from("club_messages").insert({
      title: `${header} (${trainingForm.age_groups.join(", ")})`,
      body: fullMsg,
      target_group: trainingForm.age_groups.join(", ") || "Ã–zel Grup",
      sender_name: authorName,
    });

    setLastWaBroadcast({ message: fullMsg, targetPlayers });
    setFeedback(
      isEdit
        ? "âœ… Antrenman gÃ¼ncellendi ve bildirim yayÄ±nlandÄ±. AÅŸaÄŸÄ±dan WhatsApp mesajÄ± gÃ¶nderebilirsiniz."
        : "âœ… Antrenman(lar) eklendi ve gruba bildirim gÃ¶nderildi. WhatsApp paylaÅŸÄ±mÄ± hazÄ±r!"
    );

    setTrainingForm({
      id: "",
      title: "",
      training_type: "duzenli",
      age_groups: ["U15"],
      selected_days: ["Ã‡arÅŸamba"],
      training_date: "",
      start_time: "17:00",
      end_time: "18:30",
      location: "Ã‡orum Ä°kbalspor Tesisleri",
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
      selected_days: tr.day_of_week ? [tr.day_of_week] : ["Ã‡arÅŸamba"],
      training_date: tr.training_date || "",
      start_time: tr.start_time,
      end_time: tr.end_time || "",
      location: tr.location || "Ã‡orum Ä°kbalspor Tesisleri",
      extra_player_ids: tr.extra_player_ids || [],
      notes: tr.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTraining(id: string) {
    await supabase.from("trainings").delete().eq("id", id);
    loadAll();
  }

  // TFF AjanÄ± FonksiyonlarÄ±
  async function runTffAgent(mode: "search" | "profile") {
    setTffLoading(true);
    setTffError("");
    setTffResults([]);
    try {
      const res = await fetch("/api/tff-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "search" ? { action: "search", query: tffQuery } : { action: "profile", kisiIdOrUrl: tffUrlOrId }
        ),
      });
      const data = await res.json();
      if (!data.ok) {
        setTffError(data.error || "TFF verisi Ã§ekilemedi.");
      } else {
        setTffResults(data.results || []);
        if (data.results?.length === 1) {
          selectTffPlayerToDraft(data.results[0]);
        }
      }
    } catch {
      setTffError("TFF baÄŸlantÄ± hatasÄ± oluÅŸtu.");
    } finally {
      setTffLoading(false);
    }
  }

  function parseTffPastedText() {
    setTffError("");
    const text = tffPasteText.trim();
    if (!text) return;

    const birthMatch = text.match(/DoÄŸum Tarihi\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i) || text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
    let isoBirth = "";
    if (birthMatch) {
      const [, d, mo, y] = birthMatch[1].match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) || [];
      if (d && mo && y) isoBirth = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    const licenseMatch = text.match(/Lisans No\s*:?\s*(\d{5,12})/i);
    const nameMatch =
      text.match(/AdÄ± SoyadÄ±\s*:?\s*([A-ZÃ‡ÄÄ°Ã–ÅÃœa-zÃ§ÄŸÄ±Ã¶ÅŸÃ¼\s]+)/i) ||
      text.split("\n").find((line) => line.trim().length > 4 && !line.includes("DoÄŸum") && !line.includes("Lisans"));

    const extractedName = (typeof nameMatch === "string" ? nameMatch : nameMatch?.[1] || "").trim();
    selectTffPlayerToDraft({
      tff_kisi_id: "",
      full_name: extractedName,
      birth_date: isoBirth,
      license_no: licenseMatch?.[1] || "",
      club: "",
    });
  }

  function selectTffPlayerToDraft(item: TffResult) {
    const ageGroup = calcAgeGroupFromBirthDate(item.birth_date);
    setTffDraft({
      full_name: item.full_name || "",
      birth_date: item.birth_date || "",
      age_group: ageGroup,
      license_no: item.license_no || "",
      tff_kisi_id: item.tff_kisi_id || "",
      parent_phone: "",
      position: "Orta Saha",
      jersey_number: "",
      player_code: `IKB-${Math.floor(1000 + Math.random() * 9000)}`,
      player_pin: "1234",
    });
  }

  const tffDuplicateMatch = useMemo(() => {
    if (!tffDraft || !tffDraft.full_name || !tffDraft.birth_date) return null;
    return players.find(
      (p) => normalizeTr(p.full_name) === normalizeTr(tffDraft.full_name) && p.birth_date === tffDraft.birth_date
    );
  }, [tffDraft, players]);

  async function importTffDraftToSquad(e: React.FormEvent) {
    e.preventDefault();
    if (!tffDraft) return;
    const finalAgeGroup = tffDraft.birth_date ? calcAgeGroupFromBirthDate(tffDraft.birth_date) : tffDraft.age_group;
    const finalPin = tffDraft.player_pin.trim() || defaultPinFromPhone(tffDraft.parent_phone);

    const { error } = await supabase.from("players").insert({
      full_name: tffDraft.full_name.trim(),
      birth_date: tffDraft.birth_date || null,
      age_group: finalAgeGroup,
      position: tffDraft.position,
      jersey_number: tffDraft.jersey_number ? Number(tffDraft.jersey_number) : null,
      parent_phone: tffDraft.parent_phone.trim() || null,
      player_code: tffDraft.player_code.trim().toUpperCase(),
      player_pin: finalPin,
      pin_changed: false,
      tff_kisi_id: tffDraft.tff_kisi_id || null,
      license_no: tffDraft.license_no || null,
    });

    if (error) {
      setFeedback("TFF oyuncusu eklenemedi: " + error.message);
      return;
    }
    setFeedback(`âœ… TFF AjanÄ± ile ${tffDraft.full_name} (${finalAgeGroup}) kadroya eklendi!`);
    setTffDraft(null);
    loadAll();
  }

  // AntrenÃ¶r Ekle / Sil
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
      setFeedback("AntrenÃ¶r eklenemedi: " + error.message);
      return;
    }
    setFeedback(`âœ… AntrenÃ¶r ${newCoach.full_name} eklendi (Kod: ${code}, Åifre: ${newCoach.pin}).`);
    setNewCoach({ full_name: "", coach_code: "", pin: "1234", phone: "", assigned_groups: ["U13", "U14", "U15"] });
    loadAll();
  }

  // Aidat, GÃ¶rev, QR Yoklama
  async function addDue(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("dues").insert({
      player_id: newDue.player_id,
      month_label: newDue.month_label,
      amount: Number(newDue.amount) || 500,
      status: "Bekliyor",
    });
    loadAll();
  }

  async function toggleDueStatus(due: Due) {
    const nextStatus = due.status === "Ã–dendi" ? "Bekliyor" : "Ã–dendi";
    await supabase.from("dues").update({ status: nextStatus }).eq("id", due.id);
    loadAll();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("tasks_assignments").insert(newTask);
    setNewTask({ title: "", task_type: "Mac", age_group: "U15", event_date: "", location: "", notes: "" });
    loadAll();
  }

  async function createQrSession(e: React.FormEvent) {
    e.preventDefault();
    const token = `IKB-QR-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from("prayer_sessions").update({ is_active: false }).eq("is_active", true);
    await supabase.from("prayer_sessions").insert({
      title: newSessionTitle || "HaftalÄ±k KulÃ¼p YoklamasÄ±",
      qr_token: token,
      session_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    });
    loadAll();
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-[#02274c] font-bold">YÃ¼kleniyor...</div>;
  }

  if (role === "none") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border-t-4 border-[#a60513]">
          <h1 className="text-2xl font-extrabold text-[#02274c] text-center mb-1">Ã‡orum Ä°kbalspor</h1>
          <p className="text-sm text-slate-500 text-center mb-5">YÃ¶netim ve AntrenÃ¶r PortalÄ±</p>

          <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setLoginMode("admin");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-sm font-bold transition ${
                loginMode === "admin" ? "bg-[#02274c] text-white" : "text-slate-600"
              }`}
            >
              YÃ¶netici (Admin)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("coach");
                setAuthError("");
              }}
              className={`py-2 rounded-lg text-sm font-bold transition ${
                loginMode === "coach" ? "bg-[#a60513] text-white" : "text-slate-600"
              }`}
            >
              AntrenÃ¶r GiriÅŸi
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
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Åifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button type="submit" className="w-full bg-[#02274c] text-white font-bold py-2.5 rounded-lg">
                Admin Olarak GiriÅŸ Yap
              </button>
            </form>
          ) : (
            <form onSubmit={handleCoachLogin} className="space-y-3">
              <input
                type="text"
                required
                placeholder="AntrenÃ¶r Kodu (Ã¶rn: ANT-1001)"
                value={coachCode}
                onChange={(e) => setCoachCode(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
              />
              <input
                type="password"
                required
                placeholder="AntrenÃ¶r Åifresi"
                value={coachPin}
                onChange={(e) => setCoachPin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button type="submit" className="w-full bg-[#a60513] text-white font-bold py-2.5 rounded-lg">
                AntrenÃ¶r Olarak GiriÅŸ Yap
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const filteredPlayers = players.filter(
    (p) =>
      p.full_name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      (p.player_code || "").toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.age_group.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const activeSession = sessions.find((s) => s.is_active) || sessions[0];
  const checkedInIds = new Set(
    attendance.filter((a) => activeSession && a.session_id === activeSession.id).map((a) => a.player_id)
  );

  const availableTabs: Array<{ id: typeof tab; label: string }> =
    role === "admin"
      ? [
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "tff", label: "TFF Bilgi BankasÄ± AjanÄ±" },
          { id: "aidat", label: "Aidatlar" },
          { id: "envanter", label: "Forma & Ekipman" },
          { id: "gorevler", label: "MaÃ§ & GÃ¶revler" },
          { id: "namaz", label: "QR Yoklama" },
          { id: "antrenorler", label: `AntrenÃ¶rler (${coaches.length})` },
        ]
      : [
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "tff", label: "TFF Bilgi BankasÄ± AjanÄ±" },
          { id: "gorevler", label: "MaÃ§ & GÃ¶revler" },
          { id: "namaz", label: "QR Yoklama" },
        ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-[#02274c] text-white px-4 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">
              {role === "admin" ? "Ã‡orum Ä°kbalspor â€” YÃ¶netici Paneli" : `AntrenÃ¶r Paneli (${activeCoach?.full_name})`}
            </h1>
            <p className="text-xs text-slate-300">
              {role === "coach" && activeCoach
                ? `Yetkili Gruplar: ${activeCoach.assigned_groups?.join(", ") || "TÃ¼mÃ¼"}`
                : "Tam Yetkili KulÃ¼p YÃ¶netimi"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#a60513] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            Ã‡Ä±kÄ±ÅŸ Yap
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

        {/* Sekmeler */}
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

        {/* 1. OYUNCULAR SEKMESÄ° */}
        {tab === "oyuncular" && (
          <div className="space-y-6">
            {flaggedPlayersCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                <strong>âš ï¸ Kontrol Edilmesi Gereken {flaggedPlayersCount} Oyuncu Var:</strong> DoÄŸum tarihi eksik, isim
                hatalÄ± veya aynÄ± isim+doÄŸum tarihli Ã§ift kayÄ±tlar tabloda sarÄ±/kÄ±rmÄ±zÄ± uyarÄ± etiketiyle iÅŸaretlendi.
                SatÄ±rdaki <strong>DÃ¼zenle</strong> butonundan bilgileri gÃ¼ncelleyebilirsiniz.
              </div>
            )}

            {/* Oyuncu DÃ¼zenleme ModalÄ± */}
            {editingPlayer && (
              <form
                onSubmit={savePlayerEdit}
                className="bg-white p-5 rounded-2xl shadow-md border-2 border-[#a60513] space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold text-[#02274c]">Oyuncu Bilgilerini DÃ¼zenle</h2>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="text-sm text-slate-500 underline"
                  >
                    VazgeÃ§
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Ad Soyad</label>
                    <input
                      required
                      value={editingPlayer.full_name}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, full_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">DoÄŸum Tarihi (YaÅŸ Grubu Otomatik)</label>
                    <input
                      type="date"
                      value={editingPlayer.birth_date || ""}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, birth_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Veli / Oyuncu Telefon</label>
                    <input
                      value={editingPlayer.parent_phone || ""}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, parent_phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Mevki</label>
                    <select
                      value={editingPlayer.position || "Orta Saha"}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, position: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option>Kaleci</option>
                      <option>Defans</option>
                      <option>Orta Saha</option>
                      <option>Forvet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Forma No</label>
                    <input
                      type="number"
                      value={editingPlayer.jersey_number ?? ""}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          jersey_number: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Oyuncu ID</label>
                    <input
                      value={editingPlayer.player_code || ""}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, player_code: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Åifre (PIN)</label>
                    <input
                      value={editingPlayer.player_pin || ""}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, player_pin: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">TFF Lisans No</label>
                    <input
                      value={editingPlayer.license_no || ""}
                      onChange={(e) => setEditingPlayer({ ...editingPlayer, license_no: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
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
                    DeÄŸiÅŸiklikleri Kaydet
                  </button>
                </div>
              </form>
            )}

            {/* Yeni Oyuncu Ekle */}
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
                  placeholder="Ã–zel ID (BoÅŸsa IKB-XXXX)"
                  value={newPlayer.player_code}
                  onChange={(e) => setNewPlayer({ ...newPlayer, player_code: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm uppercase"
                />
                <input
                  placeholder="Åifre (BoÅŸsa Tel Son 4)"
                  value={newPlayer.player_pin}
                  onChange={(e) => setNewPlayer({ ...newPlayer, player_pin: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="bg-[#a60513] text-white font-bold rounded-lg px-4 py-2 text-sm">
                  Oyuncu Ekle
                </button>
              </div>
            </form>

            {/* Oyuncu Listesi */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="font-bold text-[#02274c]">KayÄ±tlÄ± Oyuncular</h2>
                <input
                  placeholder="Ä°sim, ID veya YaÅŸ Grubu ara..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full md:w-72"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-[#02274c]">
                    <tr>
                      <th className="p-2.5">Ad Soyad & UyarÄ±lar</th>
                      <th className="p-2.5">Grup / DoÄŸum T.</th>
                      <th className="p-2.5">ID / Åifre</th>
                      <th className="p-2.5">Telefon</th>
                      <th className="p-2.5">Ä°ÅŸlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p) => {
                      const warnings = getPlayerWarnings(p);
                      return (
                        <tr
                          key={p.id}
                          className={`border-b ${warnings.length > 0 ? "bg-amber-50/70" : "hover:bg-slate-50"}`}
                        >
                          <td className="p-2.5">
                            <div className="font-bold text-[#02274c]">
                              {p.full_name}{" "}
                              {p.is_representative && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-1">
                                  Temsilci
                                </span>
                              )}
                            </div>
                            {warnings.map((w) => (
                              <span
                                key={w}
                                className="inline-block mt-1 mr-1 text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded"
                              >
                                âš ï¸ {w}
                              </span>
                            ))}
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold">{p.age_group}</span>
                            <div className="text-xs text-slate-500">{p.birth_date || "Eksik!"}</div>
                          </td>
                          <td className="p-2.5 font-mono text-xs">
                            <div>ID: {p.player_code || "-"}</div>
                            <div>Åifre: {p.player_pin || "1234"}</div>
                          </td>
                          <td className="p-2.5 text-xs">{p.parent_phone || "-"}</td>
                          <td className="p-2.5 flex gap-2">
                            <button
                              onClick={() => setEditingPlayer(p)}
                              className="bg-[#02274c] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                            >
                              DÃ¼zenle
                            </button>
                            {role === "admin" && (
                              <button
                                onClick={() => deletePlayer(p.id, p.full_name)}
                                className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg"
                              >
                                Sil
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. ANTRENMANLAR SEKMESÄ° */}
        {tab === "antrenmanlar" && (
          <div className="space-y-6">
            <form onSubmit={saveTraining} className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-extrabold text-[#02274c]">
                  {trainingForm.id ? "Antrenman DÃ¼zenle (DeÄŸiÅŸiklikte Bildirim Gider)" : "Toplu / Ekstra Antrenman Ekle"}
                </h2>
                {trainingForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setTrainingForm({
                        id: "",
                        title: "",
                        training_type: "duzenli",
                        age_groups: ["U15"],
                        selected_days: ["Ã‡arÅŸamba"],
                        training_date: "",
                        start_time: "17:00",
                        end_time: "18:30",
                        location: "Ã‡orum Ä°kbalspor Tesisleri",
                        extra_player_ids: [],
                        notes: "",
                      })
                    }
                    className="text-xs underline text-slate-500"
                  >
                    Yeni Kayda DÃ¶n
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Antrenman TÃ¼rÃ¼</label>
                  <select
                    value={trainingForm.training_type}
                    onChange={(e) =>
                      setTrainingForm({ ...trainingForm, training_type: e.target.value as "duzenli" | "ekstra" })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="duzenli">DÃ¼zenli HaftalÄ±k Antrenman</option>
                    <option value="ekstra">Ekstra Antrenman / Ã–zel Ã‡alÄ±ÅŸma</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">BaÅŸlÄ±k (Opsiyonel)</label>
                  <input
                    placeholder="Ã–rn: U13-U14-U15 Taktik Ä°dman"
                    value={trainingForm.title}
                    onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Saha / Yer</label>
                  <input
                    value={trainingForm.location}
                    onChange={(e) => setTrainingForm({ ...trainingForm, location: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Ã‡oklu YaÅŸ Grubu SeÃ§imi */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  YaÅŸ GruplarÄ± (Toplu SeÃ§im â€” Ã¶rn. U13, U14, U15 iÅŸaretleyebilirsiniz)
                </label>
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
                          checked ? "bg-[#02274c] text-white border-[#02274c]" : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        {checked ? "âœ“ " : ""}
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GÃ¼n & Saat */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {trainingForm.training_type === "duzenli" ? (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">
                      GÃ¼n(ler) â€” Toplu seÃ§ebilirsiniz
                    </label>
                    <div className="flex flex-wrap gap-1.5">
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
                              checked ? "bg-[#a60513] text-white border-[#a60513]" : "bg-slate-50 text-slate-700"
                            }`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Ekstra Antrenman Tarihi</label>
                    <input
                      type="date"
                      required
                      value={trainingForm.training_date}
                      onChange={(e) => setTrainingForm({ ...trainingForm, training_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600">BaÅŸlangÄ±Ã§ Saati</label>
                    <input
                      type="time"
                      required
                      value={trainingForm.start_time}
                      onChange={(e) => setTrainingForm({ ...trainingForm, start_time: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">BitiÅŸ</label>
                    <input
                      type="time"
                      value={trainingForm.end_time}
                      onChange={(e) => setTrainingForm({ ...trainingForm, end_time: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Grup DÄ±ÅŸÄ±ndan Bireysel Oyuncu Ekleme */}
              <div className="bg-slate-50 p-3 rounded-xl border">
                <label className="text-xs font-bold text-[#02274c] block mb-1.5">
                  Grup DÄ±ÅŸÄ±ndan Bireysel Oyuncu Ekle (Opsiyonel â€” SeÃ§ili: {trainingForm.extra_player_ids.length})
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
                            selected ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700"
                          }`}
                        >
                          {selected ? "âœ“ " : "+ "}
                          {p.full_name} ({p.age_group})
                        </button>
                      );
                    })}
                </div>
              </div>

              <input
                placeholder="Not (Ã–rn: Tekmelik ve yaÄŸmurluk getirin)"
                value={trainingForm.notes}
                onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />

              <button type="submit" className="bg-[#02274c] text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                {trainingForm.id ? "DeÄŸiÅŸikliÄŸi Kaydet & Bildirim GÃ¶nder" : "AntrenmanÄ± Kaydet & Gruba Bildir"}
              </button>
            </form>

            {/* WhatsApp HÄ±zlÄ± PaylaÅŸÄ±m Kutusu */}
            {lastWaBroadcast && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-bold text-emerald-900">ğŸ“² WhatsApp Ä°le AnÄ±nda GÃ¶nder</h3>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(lastWaBroadcast.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    WhatsApp Grubunda PaylaÅŸ
                  </a>
                </div>
                <pre className="text-xs bg-white p-3 rounded-lg border whitespace-pre-wrap">{lastWaBroadcast.message}</pre>
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
                        className="text-xs bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                      >
                        WP: {p.full_name}
                      </a>
                    ))}
                </div>
              </div>
            )}

            {/* KayÄ±tlÄ± Antrenmanlar Listesi */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              <h2 className="font-bold text-[#02274c]">KayÄ±tlÄ± Antrenman ProgramÄ±</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trainings.map((tr) => {
                  const extraList = players.filter((p) => (tr.extra_player_ids || []).includes(p.id));
                  const msg = `${tr.title}\nGruplar: ${(tr.age_groups || []).join(", ")}\nZaman: ${
                    tr.day_of_week || tr.training_date
                  } ${tr.start_time}${tr.end_time ? `-${tr.end_time}` : ""}\nYer: ${tr.location || "-"}`;
                  return (
                    <div key={tr.id} className="border rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              tr.training_type === "ekstra"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {tr.training_type === "ekstra" ? "EKSTRA" : "DÃœZENLÄ°"}
                          </span>
                          <h3 className="font-bold text-[#02274c] mt-1">{tr.title}</h3>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEditTraining(tr)}
                            className="bg-[#02274c] text-white text-xs px-2.5 py-1 rounded-lg font-bold"
                          >
                            Saat/GÃ¼n DeÄŸiÅŸtir
                          </button>
                          <button
                            onClick={() => deleteTraining(tr.id)}
                            className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-lg font-bold"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        <strong>Gruplar:</strong> {(tr.age_groups || []).join(", ")} |{" "}
                        <strong>Zaman:</strong> {tr.day_of_week || tr.training_date} â€” <strong>{tr.start_time}</strong>
                        {tr.end_time ? ` - ${tr.end_time}` : ""}
                      </div>
                      {extraList.length > 0 && (
                        <div className="text-xs text-emerald-700">
                          <strong>Bireysel Eklenenler:</strong> {extraList.map((x) => x.full_name).join(", ")}
                        </div>
                      )}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-bold text-emerald-700 underline"
                      >
                        ğŸ“² Gruba WhatsApp MesajÄ± At
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. TFF FUTBOL BÄ°LGÄ° BANKASI AJANI SEKMESÄ° */}
        {tab === "tff" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-[#02274c]">ğŸ¤– TFF Futbol Bilgi BankasÄ± AjanÄ±</h2>
                  <p className="text-xs text-slate-500">
                    TFF'den oyuncu bilgilerini otomatik Ã§eker, kadroda aynÄ± isim ve doÄŸum tarihi varsa sizi uyarÄ±r.
                  </p>
                </div>
                <a
                  href="https://www.tff.org/default.aspx?pageID=130"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold bg-slate-100 px-3 py-2 rounded-lg text-[#02274c]"
                >
                  TFF Arama SayfasÄ±nÄ± AÃ§ â†—
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-slate-600">1. YÃ¶ntem: Ä°sim veya Lisans No ile TFF'de Ara</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="Ã–rn: Ahmet YÄ±lmaz veya 1234567"
                      value={tffQuery}
                      onChange={(e) => setTffQuery(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={tffLoading}
                      onClick={() => runTffAgent("search")}
                      className="bg-[#02274c] text-white text-xs font-bold px-4 py-2 rounded-lg"
                    >
                      {tffLoading ? "AranÄ±yor..." : "TFF'den Ã‡ek"}
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-slate-600">2. YÃ¶ntem: TFF Oyuncu Linki veya KiÅŸi ID</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="https://www.tff.org/Default.aspx?pageID=30&kisiID=..."
                      value={tffUrlOrId}
                      onChange={(e) => setTffUrlOrId(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={tffLoading}
                      onClick={() => runTffAgent("profile")}
                      className="bg-[#a60513] text-white text-xs font-bold px-4 py-2 rounded-lg"
                    >
                      Profili Getir
                    </button>
                  </div>
                </div>
              </div>

              {/* AkÄ±llÄ± Metin AyrÄ±ÅŸtÄ±rÄ±cÄ± (TFF engellerse) */}
              <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  3. YÃ¶ntem (Yedek): TFF Oyuncu SayfasÄ±ndan KopyaladÄ±ÄŸÄ±nÄ±z Metni YapÄ±ÅŸtÄ±rÄ±n
                </label>
                <div className="flex flex-col md:flex-row gap-2">
                  <textarea
                    rows={2}
                    placeholder="TFF oyuncu sayfasÄ±ndan AdÄ± SoyadÄ±, DoÄŸum Tarihi, Lisans No alanlarÄ±nÄ± kopyalayÄ±p yapÄ±ÅŸtÄ±rÄ±n..."
                    value={tffPasteText}
                    onChange={(e) => setTffPasteText(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={parseTffPastedText}
                    className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    Metinden AyrÄ±ÅŸtÄ±r
                  </button>
                </div>
              </div>

              {tffError && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">{tffError}</div>}

              {/* Bulunan SonuÃ§lar */}
              {tffResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-600">TFF SonuÃ§larÄ± (DÃ¼zenlemek iÃ§in seÃ§in):</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tffResults.map((r, idx) => (
                      <div key={idx} className="border rounded-xl p-3 flex justify-between items-center">
                        <div className="text-xs">
                          <div className="font-bold text-[#02274c]">{r.full_name}</div>
                          <div>DoÄŸum: {r.birth_date || "?"} | Lisans: {r.license_no || "-"}</div>
                          <div className="text-slate-500">{r.club || ""}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectTffPlayerToDraft(r)}
                          className="bg-[#02274c] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                          SeÃ§ & DÃ¼zenle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DÃ¼zenlenebilir Ä°Ã§e Aktarma Formu + Ã‡ift KayÄ±t UyarÄ±sÄ± */}
              {tffDraft && (
                <form onSubmit={importTffDraftToSquad} className="border-2 border-[#02274c] rounded-2xl p-4 space-y-3 bg-blue-50/30">
                  <h3 className="font-extrabold text-[#02274c]">TFF'den Gelen Bilgileri Ä°ncele / DÃ¼zenle ve Ekle</h3>

                  {tffDuplicateMatch && (
                    <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-red-900 text-sm font-bold">
                      âš ï¸ DÄ°KKAT: Kadronuzda aynÄ± isim ve doÄŸum tarihine sahip oyuncu zaten kayÄ±tlÄ±! (
                      {tffDuplicateMatch.full_name} â€” ID: {tffDuplicateMatch.player_code} â€” Grup:{" "}
                      {tffDuplicateMatch.age_group})
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600">Ad Soyad</label>
                      <input
                        required
                        value={tffDraft.full_name}
                        onChange={(e) => setTffDraft({ ...tffDraft, full_name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">DoÄŸum Tarihi</label>
                      <input
                        type="date"
                        value={tffDraft.birth_date}
                        onChange={(e) => setTffDraft({ ...tffDraft, birth_date: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Lisans No</label>
                      <input
                        value={tffDraft.license_no}
                        onChange={(e) => setTffDraft({ ...tffDraft, license_no: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Veli Telefon</label>
                      <input
                        placeholder="05xx..."
                        value={tffDraft.parent_phone}
                        onChange={(e) => setTffDraft({ ...tffDraft, parent_phone: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Mevki</label>
                      <select
                        value={tffDraft.position}
                        onChange={(e) => setTffDraft({ ...tffDraft, position: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option>Kaleci</option>
                        <option>Defans</option>
                        <option>Orta Saha</option>
                        <option>Forvet</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Forma No</label>
                      <input
                        type="number"
                        value={tffDraft.jersey_number}
                        onChange={(e) => setTffDraft({ ...tffDraft, jersey_number: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Oyuncu ID</label>
                      <input
                        value={tffDraft.player_code}
                        onChange={(e) => setTffDraft({ ...tffDraft, player_code: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Åifre (PIN)</label>
                      <input
                        value={tffDraft.player_pin}
                        onChange={(e) => setTffDraft({ ...tffDraft, player_pin: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-[#a60513] text-white font-bold px-5 py-2 rounded-lg text-sm">
                    DÃ¼zenlenen Bilgilerle Kadroya Ekle
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 4. AÄ°DATLAR */}
        {tab === "aidat" && role === "admin" && (
          <div className="space-y-6">
            <form onSubmit={addDue} className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                required
                value={newDue.player_id}
                onChange={(e) => setNewDue({ ...newDue, player_id: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Oyuncu SeÃ§...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.age_group})
                  </option>
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
              <button type="submit" className="bg-[#02274c] text-white font-bold rounded-lg px-4 py-2 text-sm">
                Aidat KaydÄ± AÃ§
              </button>
            </form>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {dues.map((d) => (
                <div key={d.id} className="flex flex-wrap justify-between items-center border-b pb-2 text-sm">
                  <div>
                    <strong>{d.players?.full_name}</strong> ({d.players?.age_group}) â€” {d.month_label} â€” {d.amount}â‚º
                  </div>
                  <button
                    onClick={() => toggleDueStatus(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      d.status === "Ã–dendi" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {d.status}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. FORMA & EKÄ°PMAN */}
        {tab === "envanter" && role === "admin" && <InventoryManager players={players} />}

        {/* 6. MAÃ‡ & GÃ–REVLER */}
        {tab === "gorevler" && (
          <div className="space-y-6">
            <form onSubmit={addTask} className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                placeholder="BaÅŸlÄ±k (Ã–rn: PGL U15 Lig MaÃ§Ä±)"
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
                placeholder="Saha / Konum"
                value={newTask.location}
                onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Notlar"
                value={newTask.notes}
                onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <button type="submit" className="bg-[#a60513] text-white font-bold rounded-lg px-4 py-2 text-sm">
                GÃ¶rev / MaÃ§ Ekle
              </button>
            </form>
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="border-b pb-2 text-sm flex justify-between">
                  <div>
                    <strong>{t.title}</strong> ({t.age_group}) â€” {t.event_date} â€” {t.location}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. QR YOKLAMA */}
        {tab === "namaz" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <form onSubmit={createQrSession} className="flex gap-2">
                <input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="bg-[#02274c] text-white text-xs font-bold px-4 py-2 rounded-lg">
                  Yeni QR OluÅŸtur
                </button>
              </form>
              {activeSession && (
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border">
                  <p className="font-bold text-[#02274c] mb-2">{activeSession.title}</p>
                  <QRCodeSVG value={activeSession.qr_token} size={180} />
                  <p className="text-xs font-mono text-slate-500 mt-2">{activeSession.qr_token}</p>
                </div>
              )}
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border">
              <h3 className="font-bold text-[#02274c] mb-3">
                KatÄ±lanlar ({checkedInIds.size} / {players.length})
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {players.map((p) => {
                  const ok = checkedInIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`px-3 py-2 rounded-lg text-sm flex justify-between ${
                        ok ? "bg-emerald-100 text-emerald-900 font-bold" : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      <span>
                        {p.full_name} ({p.age_group})
                      </span>
                      <span>{ok ? "âœ“ KatÄ±ldÄ±" : "Bekleniyor"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 8. ANTRENÃ–RLER SEKMESÄ° (Sadece Admin) */}
        {tab === "antrenorler" && role === "admin" && (
          <div className="space-y-6">
            <form onSubmit={addCoach} className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              <h2 className="font-bold text-[#02274c]">Yeni AntrenÃ¶r Ekle</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="AntrenÃ¶r Ad Soyad"
                  value={newCoach.full_name}
                  onChange={(e) => setNewCoach({ ...newCoach, full_name: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="AntrenÃ¶r Kodu (BoÅŸsa ANT-XXXX)"
                  value={newCoach.coach_code}
                  onChange={(e) => setNewCoach({ ...newCoach, coach_code: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm uppercase"
                />
                <input
                  placeholder="GiriÅŸ Åifresi (PIN)"
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
                AntrenÃ¶rÃ¼ Kaydet
              </button>
            </form>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {coaches.map((c) => (
                <div key={c.id} className="flex justify-between items-center border-b pb-2 text-sm">
                  <div>
                    <strong>{c.full_name}</strong> â€” Kod: <span className="font-mono">{c.coach_code}</span> | Åifre:{" "}
                    <span className="font-mono">{c.pin}</span>
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from("coaches").delete().eq("id", c.id);
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
