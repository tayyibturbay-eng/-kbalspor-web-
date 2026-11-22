"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Ana Sayfa", shortLabel: "Ana Sayfa", icon: "🏠" },
  { href: "/kadro-kur", label: "Kadro Kur", shortLabel: "Kadro", icon: "⚽" },
  {
    href: "/gorevler",
    label: "Görevler & Maçlar",
    shortLabel: "Maçlar",
    icon: "📅",
  },
  { href: "/iletisim", label: "İletişim", shortLabel: "İletişim", icon: "📞" },
];

type AuthSession = {
  role: "player" | "coach" | "admin";
  name: string;
  ageGroup: string | null;
  secondaryAgeGroup: string | null;
  photoUrl: string | null;
  href: string;
} | null;

const SESSION_CACHE_KEY = "ikbal_navbar_session_v1";

function getCachedSession(): AuthSession {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function isNotificationForGroup(
  targetGroup: string | null | undefined,
  playerAgeGroup: string | null,
  secondaryAgeGroup: string | null
): boolean {
  const tg = (targetGroup || "Tümü").trim();
  if (!playerAgeGroup) return true;
  if (tg === "Tümü" || tg === "Tüm Kulüp") return true;
  if (tg === playerAgeGroup.trim()) return true;
  if (secondaryAgeGroup && tg === secondaryAgeGroup.trim()) return true;
  return false;
}

function NotificationButton({
  unreadCount,
  compact = false,
}: {
  unreadCount: number;
  compact?: boolean;
}) {
  return (
    <Link
      href="/bildirimler"
      aria-label="Bildirimler"
      title={
        unreadCount > 0
          ? `${unreadCount} görülmemiş bildirim`
          : "Bildirimler"
      }
      className={`relative shrink-0 inline-flex items-center justify-center rounded-full font-black ${
        unreadCount > 0
          ? "bg-[#a60513] hover:bg-red-700 text-white ring-2 ring-amber-300/80"
          : "bg-white/15 hover:bg-white/25 text-amber-300 border border-white/25"
      } ${compact ? "w-9 h-9 text-sm" : "w-10 h-10 text-base"}`}
    >
      <span>!</span>
      {unreadCount > 0 && (
        <span className="-top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [menuOpenForPath, setMenuOpenForPath] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession>(() => getCachedSession());
  const [unreadCount, setUnreadCount] = useState(0);

  const open = menuOpenForPath === pathname;

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkPlayer(): Promise<AuthSession> {
      const playerId = localStorage.getItem("ikbal_logged_player_id");
      if (!playerId) return null;
      const { data: p } = await supabase
        .from("players")
        .select("full_name, age_group, secondary_age_group, photo_url")
        .eq("id", playerId)
        .maybeSingle();
      if (!p) return null;
      return {
        role: "player",
        name: p.full_name || "Sporcu Profili",
        ageGroup: p.age_group || null,
        secondaryAgeGroup: p.secondary_age_group || null,
        photoUrl: p.photo_url || null,
        href: "/sporcu",
      };
    }

    async function checkStaff(): Promise<AuthSession> {
      const savedCoach = localStorage.getItem("ikbal_coach");
      if (savedCoach) {
        try {
          const parsed = JSON.parse(savedCoach);
          if (parsed?.id) {
            return {
              role: "coach",
              name: parsed.full_name || "Antrenör",
              ageGroup: null,
              secondaryAgeGroup: null,
              photoUrl: null,
              href: "/admin",
            };
          }
        } catch {
          // yoksay
        }
      }

      const { data: authData } = await supabase.auth.getSession();
      if (authData?.session?.user) {
        return {
          role: "admin",
          name: "Yönetim Paneli",
          ageGroup: null,
          secondaryAgeGroup: null,
          photoUrl: null,
          href: "/admin",
        };
      }
      return null;
    }

    async function loadUnreadCount(currentSession: AuthSession) {
      const { data } = await supabase
        .from("club_messages")
        .select("created_at, age_group")
        .order("created_at", { ascending: false })
        .limit(25);

      if (!active || !data) return;
      const lastSeen = localStorage.getItem("ikbal_last_seen_notif_at");
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      const playerGroup =
        currentSession?.role === "player" ? currentSession.ageGroup : null;
      const secondGroup =
        currentSession?.role === "player"
          ? currentSession.secondaryAgeGroup
          : null;

      const unseen = data.filter(
        (row: {
          created_at: string;
          target_group?: string | null;
          age_group?: string | null;
        }) => {
          const isNew = new Date(row.created_at).getTime() > lastSeenMs;
          const groupMatch = isNotificationForGroup(
            row.target_group || row.age_group,
            playerGroup,
            secondGroup
          );
          return isNew && groupMatch;
        }
      ).length;

      setUnreadCount(unseen);
    }

    async function syncSession() {
      if (typeof window === "undefined") return;
      const resolvedSession: AuthSession = pathname.startsWith("/admin")
        ? (await checkStaff()) || (await checkPlayer())
        : (await checkPlayer()) || (await checkStaff());

      if (!active) return;
      setSession(resolvedSession);
      try {
        sessionStorage.setItem(
          SESSION_CACHE_KEY,
          JSON.stringify(resolvedSession)
        );
      } catch {
        // yoksay
      }
      await loadUnreadCount(resolvedSession);
    }

    syncSession();

    const onAuthChange = () => {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      syncSession();
    };
    const onNotifSeen = () => {
      if (active) setUnreadCount(0);
    };

    window.addEventListener("storage", onAuthChange);
    window.addEventListener("ikbal-auth-changed", onAuthChange);
    window.addEventListener("ikbal-notifications-seen", onNotifSeen);
    return () => {
      active = false;
      window.removeEventListener("storage", onAuthChange);
      window.removeEventListener("ikbal-auth-changed", onAuthChange);
      window.removeEventListener("ikbal-notifications-seen", onNotifSeen);
    };
  }, [pathname]);

  const firstName = session?.name.split(" ")[0] || "";

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full bg-[#02274c] text-white border-b-4 border-[#a60513] shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-w-0 flex-1 lg:flex-initial shrink"
          >
            <img
              src="/logo.png"
              alt="Çorum İkbalspor Logosu"
              className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl object-contain bg-white p-0.5 border-2 border-white/25"
            />
            <div className="leading-tight min-w-0">
              <span className="block text-base sm:text-xl font-black tracking-wide truncate">
                İKBALSPOR
              </span>
              <span className="block text-[10px] sm:text-[11px] font-bold text-slate-300 truncate">
                Çorum İkbalspor • Süper Amatör Lig
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {LINKS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl font-bold text-sm ${
                    active
                      ? "bg-[#a60513] text-white"
                      : "text-slate-100 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  href={session.href}
                  title={
                    session.role === "player"
                      ? "Sporcu Profiline Git"
                      : "Yönetim Paneline Git"
                  }
                  className="flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white font-extrabold text-sm"
                >
                  {session.photoUrl ? (
                    <img
                      src={session.photoUrl}
                      alt={session.name}
                      className="w-8 h-8 rounded-full object-cover bg-white border border-white/40"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-[#a60513] text-white flex items-center justify-center text-sm font-black">
                      {session.role === "player" ? "👤" : "🛡️"}
                    </span>
                  )}
                  <span className="leading-tight">
                    {session.role === "player"
                      ? `${firstName} • Profil`
                      : "Yönetim Paneli"}
                  </span>
                </Link>

                <NotificationButton unreadCount={unreadCount} />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sporcu"
                  className="px-4 py-2.5 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white font-extrabold text-sm"
                >
                  Sporcu Girişi
                </Link>
                <Link
                  href="/admin"
                  className="px-4 py-2.5 rounded-xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-sm"
                >
                  Yönetim Paneli
                </Link>
                <NotificationButton unreadCount={unreadCount} />
              </div>
            )}
          </div>

          <div className="lg:hidden flex items-center gap-1.5 shrink-0">
            <NotificationButton unreadCount={unreadCount} compact />
            <button
              type="button"
              onClick={() =>
                setMenuOpenForPath((prev) =>
                  prev === pathname ? null : pathname
                )
              }
              className="px-3 py-2 rounded-xl bg-white/10 font-bold text-xs sm:text-sm whitespace-nowrap"
            >
              {open ? "Kapat ✕" : "Menü ☰"}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden bg-[#02274c] border-t border-white/15 px-4 py-3 space-y-1.5">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpenForPath(null)}
                className={`block px-4 py-2.5 rounded-xl font-bold text-sm ${
                  pathname === item.href
                    ? "bg-[#a60513] text-white"
                    : "text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {session ? (
              <div className="flex items-center gap-2 mt-2">
                <Link
                  href={session.href}
                  onClick={() => setMenuOpenForPath(null)}
                  className="flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#a60513] text-white font-extrabold text-sm"
                >
                  {session.photoUrl ? (
                    <img
                      src={session.photoUrl}
                      alt={session.name}
                      className="w-6 h-6 rounded-full object-cover bg-white"
                    />
                  ) : (
                    <span>{session.role === "player" ? "👤" : "🛡️"}</span>
                  )}
                  <span>
                    {session.role === "player"
                      ? `Profilim (${firstName})`
                      : "Yönetim Paneline Git"}
                  </span>
                </Link>
                <NotificationButton unreadCount={unreadCount} compact />
              </div>
            ) : (
              <>
                <Link
                  href="/sporcu"
                  onClick={() => setMenuOpenForPath(null)}
                  className="block px-4 py-2.5 rounded-xl bg-[#a60513] text-white font-extrabold text-sm text-center mt-2"
                >
                  Sporcu Girişi
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setMenuOpenForPath(null)}
                  className="block px-4 py-2.5 rounded-xl bg-white text-[#02274c] font-extrabold text-sm text-center"
                >
                  Yönetim Paneli
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      <nav
        aria-label="Mobil Alt Menü"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 w-full max-w-full bg-white border-t border-slate-200 shadow-sm"
      >
        <div className="grid grid-cols-5 h-16">
          {LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold min-w-0 px-0.5 ${
                  active ? "text-[#a60513]" : "text-slate-600"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </Link>
            );
          })}
          <Link
            href={session ? session.href : "/sporcu"}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold min-w-0 px-0.5 ${
              pathname === "/sporcu" || pathname === "/admin"
                ? "text-[#a60513]"
                : "text-[#02274c]"
            }`}
          >
            <span className="text-base leading-none">
              {session?.role === "coach" || session?.role === "admin"
                ? "🛡️"
                : "👤"}
            </span>
            <span className="truncate max-w-full">
              {session
                ? session.role === "player"
                  ? firstName
                  : "Panel"
                : "Giriş"}
            </span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-[#a60513] text-white text-[9px] font-black flex items-center justify-center">
                !{unreadCount}
              </span>
            )}
          </Link>
        </div>
      </nav>
    </>
  );
}