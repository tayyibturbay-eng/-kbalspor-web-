"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ActivityLog,
  Coach,
  Due,
  MembershipRequest,
  Player,
  PrayerAttendance,
  PrayerSession,
  TaskAssignment,
  Training,
  UserRole,
} from "@/types/club";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { PlayersTab } from "@/components/admin/PlayersTab";
import { RequestsTab } from "@/components/admin/RequestsTab";
import { TrainingsTab } from "@/components/admin/TrainingsTab";
import { DuesTab } from "@/components/admin/DuesTab";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { TasksTab } from "@/components/admin/TasksTab";
import { MatchResultsTab } from "@/components/admin/MatchResultsTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";
import { QrAttendanceTab } from "@/components/admin/QrAttendanceTab";
import { CoachesTab } from "@/components/admin/CoachesTab";
import { ActivityLogsTab } from "@/components/admin/ActivityLogsTab";

const supabase = createClient();
const ADMIN_TAB_KEY = "ikbal_admin_tab";

type AdminTab =
  | "oyuncular"
  | "talepler"
  | "antrenmanlar"
  | "aidat"
  | "envanter"
  | "gorevler"
  | "mac_sonucu"
  | "bildirim"
  | "namaz"
  | "antrenorler"
  | "islemler";

const VALID_ADMIN_TABS: AdminTab[] = [
  "oyuncular",
  "talepler",
  "antrenmanlar",
  "aidat",
  "envanter",
  "gorevler",
  "mac_sonucu",
  "bildirim",
  "namaz",
  "antrenorler",
  "islemler",
];

function getSavedAdminTab(): AdminTab | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(ADMIN_TAB_KEY) as AdminTab | null;
    if (saved && VALID_ADMIN_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // yoksay
  }
  return null;
}

export default function AdminPage() {
  const [role, setRole] = useState<UserRole>("none");
  const [adminName, setAdminName] = useState("");
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [tab, setTabState] = useState<AdminTab>("oyuncular");
  const [feedback, setFeedback] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [sessions, setSessions] = useState<PrayerSession[]>([]);
  const [attendance, setAttendance] = useState<PrayerAttendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [monthlyFee, setMonthlyFee] = useState("500");

  function setTab(nextTab: AdminTab) {
    setTabState(nextTab);
    try {
      localStorage.setItem(ADMIN_TAB_KEY, nextTab);
    } catch {
      // yoksay
    }
  }

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const savedTab = getSavedAdminTab();

        if (data.session) {
          setRole("admin");
          setAdminName(
            (data.session.user.user_metadata?.full_name as string) || ""
          );
          if (savedTab) {
            setTabState(savedTab);
          }
          await loadAll();
        } else {
          const savedCoach =
            typeof window !== "undefined"
              ? localStorage.getItem("ikbal_coach")
              : null;
          if (savedCoach) {
            try {
              const parsedCoach = JSON.parse(savedCoach) as Coach;
              setActiveCoach(parsedCoach);
              setRole("coach");
              setTabState(savedTab || "antrenmanlar");
              await loadAll();
            } catch {
              localStorage.removeItem("ikbal_coach");
            }
          }
        }
      } finally {
        if (active) setCheckingAuth(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function refreshPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("birth_date", { ascending: true, nullsFirst: false });
    if (data) setPlayers(data);
  }

  async function refreshTrainings() {
    const { data } = await supabase
      .from("trainings")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTrainings(data as Training[]);
  }

  async function refreshTasks() {
    const { data } = await supabase
      .from("tasks_assignments")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTasks(data as TaskAssignment[]);
  }

  async function refreshQr() {
    const [s, a] = await Promise.all([
      supabase
        .from("prayer_sessions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
    ]);
    if (s.data) setSessions(s.data);
    if (a.data) setAttendance(a.data);
  }

  async function refreshCoaches() {
    const { data } = await supabase
      .from("coaches")
      .select("*")
      .order("full_name");
    if (data) setCoaches(data);
  }

  async function refreshLogs() {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data as ActivityLog[]);
  }

  async function loadAll() {
    const [p, r, d, t, s, a, c, tr, lg, st] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .order("birth_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("membership_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("dues").select("*").order("created_at", { ascending: false }),
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("prayer_sessions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase.from("coaches").select("*").order("full_name"),
      supabase
        .from("trainings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("club_settings")
        .select("*")
        .eq("key", "monthly_fee")
        .maybeSingle(),
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
    if (st.data?.value) setMonthlyFee(st.data.value);
  }

  async function logActivity(action: string, details: string) {
    const actor =
      role === "admin"
        ? adminName || "Yönetici"
        : role === "coach" && activeCoach
        ? `Antrenör (${activeCoach.full_name})`
        : "Sistem";
    await supabase.from("activity_logs").insert({ actor, action, details });
    await refreshLogs();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("ikbal_coach");
    try {
      localStorage.removeItem(ADMIN_TAB_KEY);
    } catch {
      // yoksay
    }
    setRole("none");
    setAdminName("");
    setActiveCoach(null);
    window.dispatchEvent(new Event("ikbal-auth-changed"));
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#02274c] font-bold">
        Yükleniyor...
      </div>
    );
  }

  if (role === "none") {
    return (
      <AdminLogin
        onAdminSuccess={async (name) => {
          setRole("admin");
          setAdminName(name);
          setTab(getSavedAdminTab() || "oyuncular");
          await loadAll();
        }}
        onCoachSuccess={async (coach) => {
          setActiveCoach(coach);
          setRole("coach");
          setTab(getSavedAdminTab() || "antrenmanlar");
          await loadAll();
        }}
      />
    );
  }

  const pendingRequestsCount = requests.filter(
    (r) => r.status === "bekliyor" || r.status === "beklemede"
  ).length;

  const availableTabs: Array<{ id: AdminTab; label: string }> =
    role === "admin"
      ? [
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          {
            id: "talepler",
            label: `Üyelik Talepleri (${pendingRequestsCount})`,
          },
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "aidat", label: "Aidatlar" },
          { id: "envanter", label: "Forma & Ekipman" },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "mac_sonucu", label: "⚽ Skor & Golcüler" },
          { id: "bildirim", label: "🔔 Bildirim Gönder" },
          { id: "namaz", label: "QR Yoklama" },
          { id: "antrenorler", label: `Antrenörler (${coaches.length})` },
          { id: "islemler", label: "Son İşlemler" },
        ]
      : [
          { id: "antrenmanlar", label: `Antrenmanlar (${trainings.length})` },
          { id: "oyuncular", label: `Oyuncular (${players.length})` },
          { id: "gorevler", label: "Maç & Görevler" },
          { id: "mac_sonucu", label: "⚽ Skor & Golcüler" },
          { id: "bildirim", label: "🔔 Bildirim Gönder" },
          { id: "namaz", label: "QR Yoklama" },
        ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <div className="bg-[#02274c] text-white px-4 py-4 shadow border-b-4 border-[#a60513]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              title="Ana Sayfaya Dön"
              className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl border border-white/20 transition"
            >
              <img
                src="/logo.png"
                alt="Çorum İkbalspor Ana Sayfa"
                className="w-9 h-9 rounded-lg object-contain bg-white p-0.5"
              />
              <span className="text-xs font-extrabold text-white hidden sm:inline">
                Ana Sayfa
              </span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold truncate">
                {role === "admin"
                  ? `Çorum İkbalspor — Yönetici Paneli${
                      adminName ? ` (${adminName})` : ""
                    }`
                  : `Antrenör Paneli (${activeCoach?.full_name})`}
              </h1>
              <p className="text-xs text-slate-300 truncate">
                {role === "coach"
                  ? "Oyuncuları yaş grubuna göre görüntüleyebilir, mevkilerini düzenleyebilir, antrenman ve maç ekleyebilirsiniz."
                  : "Tam Yetkili Kulüp Yönetimi (19+ yaş sadece Çorum Süper Amatör Ligi)"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#a60513] hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shrink-0 cursor-pointer"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-5">
        {feedback && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex justify-between items-center">
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback("")}
              className="text-xs font-bold underline ml-3 cursor-pointer"
            >
              Kapat
            </button>
          </div>
        )}

        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {availableTabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold truncate text-center transition cursor-pointer ${
                tab === item.id
                  ? "bg-[#a60513] text-white shadow-sm"
                  : "bg-slate-50 text-[#02274c] hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "oyuncular" && (
          <PlayersTab
            role={role}
            players={players}
            setPlayers={setPlayers}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefreshPlayers={refreshPlayers}
          />
        )}

        {tab === "talepler" && role === "admin" && (
          <RequestsTab
            requests={requests}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefresh={loadAll}
          />
        )}

        {tab === "antrenmanlar" && (
          <TrainingsTab
            role={role}
            adminName={adminName}
            activeCoach={activeCoach}
            players={players}
            coaches={coaches}
            trainings={trainings}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefreshTrainings={refreshTrainings}
          />
        )}

        {tab === "aidat" && role === "admin" && (
          <DuesTab
            adminName={adminName}
            players={players}
            dues={dues}
            setDues={setDues}
            monthlyFee={monthlyFee}
            setMonthlyFee={setMonthlyFee}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
          />
        )}

        {tab === "envanter" && role === "admin" && (
          <InventoryManager players={players} />
        )}

        {tab === "gorevler" && (
          <TasksTab
            role={role}
            adminName={adminName}
            activeCoach={activeCoach}
            players={players}
            tasks={tasks}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefreshTasks={refreshTasks}
          />
        )}

        {tab === "mac_sonucu" && (
          <MatchResultsTab
            players={players}
            tasks={tasks}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
          />
        )}

        {tab === "bildirim" && (
          <NotificationsTab
            role={role}
            adminName={adminName}
            activeCoach={activeCoach}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
          />
        )}

        {tab === "namaz" && (
          <QrAttendanceTab
            role={role}
            players={players}
            sessions={sessions}
            attendance={attendance}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefreshQr={refreshQr}
          />
        )}

        {tab === "antrenorler" && role === "admin" && (
          <CoachesTab
            coaches={coaches}
            onFeedback={setFeedback}
            onLogActivity={logActivity}
            onRefreshCoaches={refreshCoaches}
          />
        )}

        {tab === "islemler" && role === "admin" && (
          <ActivityLogsTab logs={logs} />
        )}
      </div>
    </div>
  );
}