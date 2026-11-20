"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
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
const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

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
  // Auth state (Admin veya Antrenör)
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

  // Oyuncu ekleme & düzenleme
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
  const [newDue, setNewDue] = useState({ player_id: "", month_label: "Kasım 2026", amount: "500" });

  // Görev form
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "Mac",
    age_group: "U15",
    event_date: "",
    location: "",
    notes: "",
  });

  // QR Yoklama form
  const [newSessionTitle, setNewSessionTitle] = useState("Haftalık Kulüp Yoklaması");

  // Antrenör ekleme form
  const [newCoach, setNewCoach] = useState({
    full_name: "",
    coach_code: "",
    pin: "1234",
    phone: "",
    assigned_groups: ["U13", "U14", "U15"] as string[],
  });

  // Antrenman Programı form (Toplu & Ekstra + Grup Dışı Oyuncular)
  const [trainingForm, setTrainingForm] = useState({
    id: "",
    title: "",
    training_type: "duzenli" as "duzenli" | "ekstra",
    age_groups: ["U15"] as string[],
    selected_days: ["Çarşamba"] as string[],
    training_date: "",
    start_time: "17:00",
    end_time: "18:30",
    location: "Çorum İkbalspor Tesisleri",
    extra_player_ids: [] as string[],
    notes: "",
  });
  const [extraPlayerSearch, setExtraPlayerSearch] = useState("");
  const [lastWaBroadcast, setLastWaBroadcast] = useState<{
    message: string;
    targetPlayers: Player[];
  } | null>(null);

  // TFF Ajanı state
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
      setAuthError("Admin girişi başarısız: " + error.message);
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
      setAuthError("Antrenör kodu veya şifre hatalı.");
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

  // Oyuncu hata & çift kayıt analizi
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
      if (isNaN(yr) || yr < 1995 || yr > 2020) warnings.push("Doğum tarihi şüpheli");
    }
    const cleanName = (p.full_name || "").trim();
    if (cleanName.length < 4 || !cleanName.includes(" ") || /\d/.test(cleanName)) {
      warnings.push("İsim/Soyisim kontrol et");
    }
    if (p.birth_date) {
      const key = `${normalizeTr(p.full_name)}__${p.birth_date}`;
      if ((duplicateKeys.get(key) || 0) > 1) {
        warnings.push("Aynı isim + doğum tarihli çift kayıt");
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

  // Oyuncu Tam Düzenleme Kaydet
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
    setFeedback(`✅ ${editingPlayer.full_name} bilgileri güncellendi (${updatedAgeGroup}).`);
    setEditingPlayer(null);
    loadAll();
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`${name} adlı oyuncuyu silmek istediğinize emin misiniz?`)) return;
    await supabase.from("players").delete().eq("id", id);
    loadAll();
  }

  // Antrenman Programı Kaydet / Güncelle + Bildirim & WhatsApp
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
    }

    // Hedef oyuncular (Seçilen gruplar + grup dışı ekstra oyuncular)
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

    // Kulüp bildirimlerine otomatik yaz
    await supabase.from("club_messages").insert({
      title: `${header} (${trainingForm.age_groups.join(", ")})`,
      body: fullMsg,
      target_group: trainingForm.age_groups.join(", ") || "Özel Grup",
      sender_name: authorName,
    });

    setLastWaBroadcast({ message: fullMsg, targetPlayers });
    setFeedback(
      isEdit
        ? "✅ Antrenman güncellendi ve bildirim yayınlandı. Aşağıdan WhatsApp mesajı gönderebilirsiniz."
        : "✅ Antrenman(lar) eklendi ve gruba bildirim gönderildi. WhatsApp paylaşımı hazır!"
    );

    setTrainingForm({
      id: "",
      title: "",
      training_type: "duzenli",
      age_groups: ["U15"],
      selected_days: ["Çarşamba"],
      training_date: "",
      start_time: "17:00",
      end_time: "18:30",
      location: "Çorum İkbalspor Tesisleri",
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
      location: tr.location || "Çorum İkbalspor Tesisleri",
      extra_player_ids: tr.extra_player_ids || [],
      notes: tr.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTraining(id: string) {
    await supabase.from("trainings").delete().eq("id", id);
    loadAll();
  }

  // TFF Ajanı Fonksiyonları
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
        setTffError(data.error || "TFF verisi çekilemedi.");
      } else {
        setTffResults(data.results || []);
        if (data.results?.length === 1) {
          selectTffPlayerToDraft(data.results[0]);
        }
      }
    } catch {
      setTffError("TFF bağlantı hatası oluştu.");
    } finally {
      setTffLoading(false);
    }
  }

  function parseTffPastedText() {
    setTffError("");
    const text = tffPasteText.trim();
    if (!text) return;

    const birthMatch = text.match(/Doğum Tarihi\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i) || text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
    let isoBirth = "";
    if (birthMatch) {
      const [, d, mo, y] = birthMatch[1].match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) || [];
      if (d && mo && y) isoBirth = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    const licenseMatch = text.match(/Lisans No\s*:?\s*(\d{5,12})/i);
    const nameMatch =
      text.match(/Adı Soyadı\s*:?\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)/i) ||
      text.split("\n").find((line) => line.trim().length > 4 && !line.includes("Doğum") && !line.includes("Lisans"));

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
    setFeedback(`✅ TFF Ajanı ile ${tffDraft.full_name} (${finalAgeGroup}) kadroya eklendi!`);
    setTffDraft(null);
    loadAll();
  }

  // Antrenör Ekle / Sil
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
    setFeedback(`✅ Antrenör ${newCoach.full_name} eklendi (Kod: ${code}, Şifre: ${newCoach.pin}).`);
    setNewCoach({ full_name: "", coach_code: "", pin: "1234", phone: "", assigned_groups: ["U13", "U14", "U15"] });
    loadAll();
  }

  // Aidat, Görev, QR Yoklama
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
    const nextStatus = due.status === "Ödendi" ? "Bekliyor" : "Ödendi";
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
      title: newSessionTitle || "Haftalık Kulüp Yoklaması",
      qr_token: token,
      session_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    });
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
          <p className="text-sm text-slate-500 text-center mb-5">Yönetim ve Antrenör Portalı</p>

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
              Yönetici (Admin)
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
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
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
                className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
              />
              <input
                type="password"
                required
                placeholder="Antrenör Şifresi"
                value={coachPin}
                onChange={(e) => setCoachPin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
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
          { id: "tff", label: "TFF Bilgi Bankası Ajanı" },
          { id: "aidat", label: "Aidatlar" },
          { id: "envanter", label: "Forma & Ekipman" },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "namaz", label: "QR Yoklama" },
          { id: "antrenorler", label: `Antrenörler (${coaches.length})` },
        ]
      : [
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "tff", label: "TFF Bilgi Bankası Ajanı" },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "namaz", label: "QR Yoklama" },
        ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-[#02274c] text-white px-4 py-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">
              {role === "admin" ? "Çorum İkbalspor — Yönetici Paneli" : `Antrenör Paneli (${activeCoach?.full_name})`}
            </h1>
            <p className="text-xs text-slate-300">
              {role === "coach" && activeCoach
                ? `Yetkili Gruplar: ${activeCoach.assigned_groups?.join(", ") || "Tümü"}`
                : "Tam Yetkili Kulüp Yönetimi"}
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

        {/* 1. OYUNCULAR SEKMESİ */}
        {tab === "oyuncular" && (
          <div className="space-y-6">
            {flaggedPlayersCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                <strong>⚠️ Kontrol Edilmesi Gereken {flaggedPlayersCount} Oyuncu Var:</strong> Doğum tarihi eksik, isim
                hatalı veya aynı isim+doğum tarihli çift kayıtlar tabloda sarı/kırmızı uyarı etiketiyle işaretlendi.
                Satırdaki <strong>Düzenle</strong> butonundan bilgileri güncelleyebilirsiniz.
              </div>
            )}

            {/* Oyuncu Düzenleme Modalı */}
            {editingPlayer && (
              <form
                onSubmit={savePlayerEdit}
                className="bg-white p-5 rounded-2xl shadow-md border-2 border-[#a60513] space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold text-[#02274c]">Oyuncu Bilgilerini Düzenle</h2>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="text-sm text-slate-500 underline"
                  >
                    Vazgeç
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
                    <label className="text-xs font-bold text-slate-600">Doğum Tarihi (Yaş Grubu Otomatik)</label>
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
                    <label className="text-xs font-bold text-slate-600">Şifre (PIN)</label>
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
                    Değişiklikleri Kaydet
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

            {/* Oyuncu Listesi */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="font-bold text-[#02274c]">Kayıtlı Oyuncular</h2>
                <input
                  placeholder="İsim, ID veya Yaş Grubu ara..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-full md:w-72"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-[#02274c]">
                    <tr>
                      <th className="p-2.5">Ad Soyad & Uyarılar</th>
                      <th className="p-2.5">Grup / Doğum T.</th>
                      <th className="p-2.5">ID / Şifre</th>
                      <th className="p-2.5">Telefon</th>
                      <th className="p-2.5">İşlem</th>
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
                                ⚠️ {w}
                              </span>
                            ))}
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold">{p.age_group}</span>
                            <div className="text-xs text-slate-500">{p.birth_date || "Eksik!"}</div>
                          </td>
                          <td className="p-2.5 font-mono text-xs">
                            <div>ID: {p.player_code || "-"}</div>
                            <div>Şifre: {p.player_pin || "1234"}</div>
                          </td>
                          <td className="p-2.5 text-xs">{p.parent_phone || "-"}</td>
                          <td className="p-2.5 flex gap-2">
                            <button
                              onClick={() => setEditingPlayer(p)}
                              className="bg-[#02274c] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                            >
                              Düzenle
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

        {/* 2. ANTRENMANLAR SEKMESİ */}
        {tab === "antrenmanlar" && (
          <div className="space-y-6">
            <form onSubmit={saveTraining} className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-extrabold text-[#02274c]">
                  {trainingForm.id ? "Antrenman Düzenle (Değişiklikte Bildirim Gider)" : "Toplu / Ekstra Antrenman Ekle"}
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
                        selected_days: ["Çarşamba"],
                        training_date: "",
                        start_time: "17:00",
                        end_time: "18:30",
                        location: "Çorum İkbalspor Tesisleri",
                        extra_player_ids: [],
                        notes: "",
                      })
                    }
                    className="text-xs underline text-slate-500"
                  >
                    Yeni Kayda Dön
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Antrenman Türü</label>
                  <select
                    value={trainingForm.training_type}
                    onChange={(e) =>
                      setTrainingForm({ ...trainingForm, training_type: e.target.value as "duzenli" | "ekstra" })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="duzenli">Düzenli Haftalık Antrenman</option>
                    <option value="ekstra">Ekstra Antrenman / Özel Çalışma</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Başlık (Opsiyonel)</label>
                  <input
                    placeholder="Örn: U13-U14-U15 Taktik İdman"
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

              {/* Çoklu Yaş Grubu Seçimi */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  Yaş Grupları (Toplu Seçim — örn. U13, U14, U15 işaretleyebilirsiniz)
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
                        {checked ? "✓ " : ""}
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gün & Saat */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {trainingForm.training_type === "duzenli" ? (
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">
                      Gün(ler) — Toplu seçebilirsiniz
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
                    <label className="text-xs font-bold text-slate-600">Başlangıç Saati</label>
                    <input
                      type="time"
                      required
                      value={trainingForm.start_time}
                      onChange={(e) => setTrainingForm({ ...trainingForm, start_time: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Bitiş</label>
                    <input
                      type="time"
                      value={trainingForm.end_time}
                      onChange={(e) => setTrainingForm({ ...trainingForm, end_time: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Grup Dışından Bireysel Oyuncu Ekleme */}
              <div className="bg-slate-50 p-3 rounded-xl border">
                <label className="text-xs font-bold text-[#02274c] block mb-1.5">
                  Grup Dışından Bireysel Oyuncu Ekle (Opsiyonel — Seçili: {trainingForm.extra_player_ids.length})
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
                          {selected ? "✓ " : "+ "}
                          {p.full_name} ({p.age_group})
                        </button>
                      );
                    })}
                </div>
              </div>

              <input
                placeholder="Not (Örn: Tekmelik ve yağmurluk getirin)"
                value={trainingForm.notes}
                onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />

              <button type="submit" className="bg-[#02274c] text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                {trainingForm.id ? "Değişikliği Kaydet & Bildirim Gönder" : "Antrenmanı Kaydet & Gruba Bildir"}
              </button>
            </form>

            {/* WhatsApp Hızlı Paylaşım Kutusu */}
            {lastWaBroadcast && (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-bold text-emerald-900">📲 WhatsApp İle Anında Gönder</h3>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(lastWaBroadcast.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    WhatsApp Grubunda Paylaş
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

            {/* Kayıtlı Antrenmanlar Listesi */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-3">
              <h2 className="font-bold text-[#02274c]">Kayıtlı Antrenman Programı</h2>
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
                            {tr.training_type === "ekstra" ? "EKSTRA" : "DÜZENLİ"}
                          </span>
                          <h3 className="font-bold text-[#02274c] mt-1">{tr.title}</h3>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEditTraining(tr)}
                            className="bg-[#02274c] text-white text-xs px-2.5 py-1 rounded-lg font-bold"
                          >
                            Saat/Gün Değiştir
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
                        <strong>Zaman:</strong> {tr.day_of_week || tr.training_date} — <strong>{tr.start_time}</strong>
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
                        📲 Gruba WhatsApp Mesajı At
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. TFF FUTBOL BİLGİ BANKASI AJANI SEKMESİ */}
        {tab === "tff" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-[#02274c]">🤖 TFF Futbol Bilgi Bankası Ajanı</h2>
                  <p className="text-xs text-slate-500">
                    TFF'den oyuncu bilgilerini otomatik çeker, kadroda aynı isim ve doğum tarihi varsa sizi uyarır.
                  </p>
                </div>
                <a
                  href="https://www.tff.org/default.aspx?pageID=130"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold bg-slate-100 px-3 py-2 rounded-lg text-[#02274c]"
                >
                  TFF Arama Sayfasını Aç ↗
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-slate-600">1. Yöntem: İsim veya Lisans No ile TFF'de Ara</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="Örn: Ahmet Yılmaz veya 1234567"
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
                      {tffLoading ? "Aranıyor..." : "TFF'den Çek"}
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl p-3 space-y-2">
                  <label className="text-xs font-bold text-slate-600">2. Yöntem: TFF Oyuncu Linki veya Kişi ID</label>
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

              {/* Akıllı Metin Ayrıştırıcı (TFF engellerse) */}
              <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  3. Yöntem (Yedek): TFF Oyuncu Sayfasından Kopyaladığınız Metni Yapıştırın
                </label>
                <div className="flex flex-col md:flex-row gap-2">
                  <textarea
                    rows={2}
                    placeholder="TFF oyuncu sayfasından Adı Soyadı, Doğum Tarihi, Lisans No alanlarını kopyalayıp yapıştırın..."
                    value={tffPasteText}
                    onChange={(e) => setTffPasteText(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={parseTffPastedText}
                    className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    Metinden Ayrıştır
                  </button>
                </div>
              </div>

              {tffError && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">{tffError}</div>}

              {/* Bulunan Sonuçlar */}
              {tffResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-600">TFF Sonuçları (Düzenlemek için seçin):</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tffResults.map((r, idx) => (
                      <div key={idx} className="border rounded-xl p-3 flex justify-between items-center">
                        <div className="text-xs">
                          <div className="font-bold text-[#02274c]">{r.full_name}</div>
                          <div>Doğum: {r.birth_date || "?"} | Lisans: {r.license_no || "-"}</div>
                          <div className="text-slate-500">{r.club || ""}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectTffPlayerToDraft(r)}
                          className="bg-[#02274c] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                          Seç & Düzenle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Düzenlenebilir İçe Aktarma Formu + Çift Kayıt Uyarısı */}
              {tffDraft && (
                <form onSubmit={importTffDraftToSquad} className="border-2 border-[#02274c] rounded-2xl p-4 space-y-3 bg-blue-50/30">
                  <h3 className="font-extrabold text-[#02274c]">TFF'den Gelen Bilgileri İncele / Düzenle ve Ekle</h3>

                  {tffDuplicateMatch && (
                    <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-red-900 text-sm font-bold">
                      ⚠️ DİKKAT: Kadronuzda aynı isim ve doğum tarihine sahip oyuncu zaten kayıtlı! (
                      {tffDuplicateMatch.full_name} — ID: {tffDuplicateMatch.player_code} — Grup:{" "}
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
                      <label className="text-xs font-bold text-slate-600">Doğum Tarihi</label>
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
                      <label className="text-xs font-bold text-slate-600">Şifre (PIN)</label>
                      <input
                        value={tffDraft.player_pin}
                        onChange={(e) => setTffDraft({ ...tffDraft, player_pin: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-[#a60513] text-white font-bold px-5 py-2 rounded-lg text-sm">
                    Düzenlenen Bilgilerle Kadroya Ekle
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 4. AİDATLAR */}
        {tab === "aidat" && role === "admin" && (
          <div className="space-y-6">
            <form onSubmit={addDue} className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                required
                value={newDue.player_id}
                onChange={(e) => setNewDue({ ...newDue, player_id: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Oyuncu Seç...</option>
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
                Aidat Kaydı Aç
              </button>
            </form>

            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {dues.map((d) => (
                <div key={d.id} className="flex flex-wrap justify-between items-center border-b pb-2 text-sm">
                  <div>
                    <strong>{d.players?.full_name}</strong> ({d.players?.age_group}) — {d.month_label} — {d.amount}₺
                  </div>
                  <button
                    onClick={() => toggleDueStatus(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      d.status === "Ödendi" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {d.status}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. FORMA & EKİPMAN */}
        {tab === "envanter" && role === "admin" && <InventoryManager players={players} />}

        {/* 6. MAÇ & GÖREVLER */}
        {tab === "gorevler" && (
          <div className="space-y-6">
            <form onSubmit={addTask} className="bg-white p-5 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                placeholder="Başlık (Örn: PGL U15 Lig Maçı)"
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
                Görev / Maç Ekle
              </button>
            </form>
            <div className="bg-white p-5 rounded-2xl shadow-sm border space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="border-b pb-2 text-sm flex justify-between">
                  <div>
                    <strong>{t.title}</strong> ({t.age_group}) — {t.event_date} — {t.location}
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
                  Yeni QR Oluştur
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
                Katılanlar ({checkedInIds.size} / {players.length})
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
                      <span>{ok ? "✓ Katıldı" : "Bekleniyor"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 8. ANTRENÖRLER SEKMESİ (Sadece Admin) */}
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