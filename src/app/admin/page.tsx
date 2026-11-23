"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitch } from "@/components/ikbal/ThemeSwitch";
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
const THEME_STORAGE_KEY = "ikbalspor_theme";

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

function AdminShellSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="h-20 bg-[var(--brand-navy)] border-b-4 border-[var(--brand-red)]" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            />
          ))}
        </div>
        <div className="h-24 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
        <div className="h-80 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [role, setRole] = useState<UserRole>("none");
  const [adminName, setAdminName] = useState("");
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const attr = document.documentElement.getAttribute("data-theme");
        if (attr === "dark" || attr === "light") {
          setTheme(attr);
          return;
        }
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "dark" || saved === "light") {
          setTheme(saved);
        }
      } catch {
        // yoksay
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleToggleTheme() {
    const nextTheme: "light" | "dark" = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // yoksay
    }
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

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

    const initAuthAndData = async () => {
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
    };

    void initAuthAndData();

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
    return <AdminShellSkeleton />;
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

  const activeQrSessionsCount = sessions.filter((s) => s.is_active).length;

  const availableTabs: Array<{
    id: AdminTab;
    label: string;
    count?: number;
    highlight?: boolean;
  }> =
    role === "admin"
      ? [
          { id: "oyuncular", label: "Oyuncular", count: players.length },
          {
            id: "talepler",
            label: "Üyelik Talepleri",
            count: pendingRequestsCount,
            highlight: pendingRequestsCount > 0,
          },
          {
            id: "antrenmanlar",
            label: "Antrenmanlar",
            count: trainings.length,
          },
          { id: "gorevler", label: "Maç & Görevler", count: tasks.length },
          { id: "mac_sonucu", label: "Skor & Golcüler" },
          { id: "aidat", label: "Aidatlar" },
          { id: "envanter", label: "Forma & Ekipman" },
          {
            id: "namaz",
            label: "QR Yoklama",
            count: activeQrSessionsCount || undefined,
            highlight: activeQrSessionsCount > 0,
          },
          { id: "bildirim", label: "Bildirim Gönder" },
          { id: "antrenorler", label: "Antrenörler", count: coaches.length },
          { id: "islemler", label: "Son İşlemler" },
        ]
      : [
          {
            id: "antrenmanlar",
            label: "Antrenmanlar",
            count: trainings.length,
          },
          { id: "oyuncular", label: "Oyuncular", count: players.length },
          { id: "gorevler", label: "Maç & Görevler", count: tasks.length },
          { id: "mac_sonucu", label: "Skor & Golcüler" },
          { id: "bildirim", label: "Bildirim Gönder" },
          {
            id: "namaz",
            label: "QR Yoklama",
            count: activeQrSessionsCount || undefined,
            highlight: activeQrSessionsCount > 0,
          },
        ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] pb-16 text-[var(--text-primary)] transition-colors">
      <header className="sticky top-0 z-30 bg-[var(--brand-navy)] text-white px-4 py-3.5 shadow border-b-4 border-[var(--brand-red)]">
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
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-white/15 text-[10px] font-black uppercase tracking-wider">
                  {role === "admin" ? "Yönetim" : "Teknik Ekip"}
                </span>
                <h1 className="text-base sm:text-xl font-black truncate">
                  {role === "admin"
                    ? `Çorum İkbalspor — Yönetici Paneli${
                        adminName ? ` (${adminName})` : ""
                      }`
                    : `Antrenör Paneli (${activeCoach?.full_name})`}
                </h1>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {role === "coach"
                  ? "Oyuncuları yaş grubuna göre görüntüleyebilir, mevkilerini düzenleyebilir, antrenman ve maç ekleyebilirsiniz."
                  : "Tam Yetkili Kulüp Yönetimi (19+ yaş sadece Çorum Süper Amatör Ligi)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeSwitch theme={theme} onToggle={handleToggleTheme} />
            <button
              type="button"
              onClick={handleLogout}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold px-4 py-2 rounded-xl cursor-pointer transition"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-5 space-y-5 page-transition">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
          <button
            type="button"
            onClick={() => setTab("oyuncular")}
            className="text-left p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-navy)] transition cursor-pointer shadow-xs"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Kayıtlı Sporcu
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {players.length}
            </div>
          </button>

          {role === "admin" ? (
            <button
              type="button"
              onClick={() => setTab("talepler")}
              className={`text-left p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                pendingRequestsCount > 0
                  ? "bg-[var(--status-warning-bg)]/50 border-[var(--status-warning-text)]/35"
                  : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--brand-navy)]"
              }`}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                Bekleyen Başvuru
              </div>
              <div
                className={`text-2xl font-black mt-1 ${
                  pendingRequestsCount > 0
                    ? "text-[var(--status-warning-text)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {pendingRequestsCount}
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTab("antrenmanlar")}
              className="text-left p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-navy)] transition cursor-pointer shadow-xs"
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                Antrenman Programı
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
                {trainings.length}
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTab("gorevler")}
            className="text-left p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-navy)] transition cursor-pointer shadow-xs"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Maç &amp; Görev Kaydı
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {tasks.length}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTab("namaz")}
            className={`text-left p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              activeQrSessionsCount > 0
                ? "bg-[var(--status-success-bg)]/55 border-[var(--status-success-text)]/35"
                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--brand-navy)]"
            }`}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Aktif QR Oturumu
            </div>
            <div
              className={`text-2xl font-black mt-1 ${
                activeQrSessionsCount > 0
                  ? "text-[var(--status-success-text)]"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {activeQrSessionsCount}
            </div>
          </button>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-success-bg)] border border-[var(--status-success-text)]/25 text-[var(--status-success-text)] text-sm font-bold flex justify-between items-center">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback("")}
              className="text-xs font-extrabold underline ml-3 cursor-pointer"
            >
              Kapat
            </button>
          </div>
        )}

        <div className="bg-[var(--bg-surface)] p-2.5 rounded-2xl border border-[var(--border-subtle)] shadow-xs grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {availableTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] text-white shadow-sm"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {typeof item.count === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : item.highlight
                        ? "bg-[var(--brand-red)] text-white"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div key={tab} className="page-transition">
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
            <ActivityLogsTab logs={logs} onLogsChange={setLogs} />
          )}
        </div>
      </div>
    </div>
  );
}