"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Ana Sayfa", shortLabel: "Ana Sayfa", icon: "🏠" },
  { href: "/kadro-kur", label: "Kadro Kur", shortLabel: "Kadro", icon: "⚽" },
  { href: "/gorevler", label: "Görevler & Maçlar", shortLabel: "Maçlar", icon: "📅" },
  { href: "/mesajlar", label: "Mesajlaşma", shortLabel: "Duyuru", icon: "📢" },
  { href: "/iletisim", label: "İletişim", shortLabel: "İletişim", icon: "📞" },
];

type AuthSession =
  | { role: "player"; name: string; photoUrl: string | null; href: "/sporcu" }
  | { role: "coach" | "admin"; name: string; photoUrl: null; href: "/admin" }
  | null;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<AuthSession>(null);

  useEffect(() => {
    let active = true;

    async function checkPlayer(
      supabase: ReturnType<typeof createClient>
    ): Promise<AuthSession> {
      const playerId = localStorage.getItem("ikbal_logged_player_id");
      if (!playerId) return null;
      const { data: p } = await supabase
        .from("players")
        .select("full_name, photo_url")
        .eq("id", playerId)
        .maybeSingle();
      if (!p) return null;
      return {
        role: "player",
        name: p.full_name || "Sporcu Profili",
        photoUrl: p.photo_url || null,
        href: "/sporcu",
      };
    }

    async function checkStaff(
      supabase: ReturnType<typeof createClient>
    ): Promise<AuthSession> {
      const savedCoach = localStorage.getItem("ikbal_coach");
      if (savedCoach) {
        try {
          const parsed = JSON.parse(savedCoach);
          if (parsed?.id) {
            return {
              role: "coach",
              name: parsed.full_name || "Antrenör",
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
          photoUrl: null,
          href: "/admin",
        };
      }
      return null;
    }

    async function checkAuth() {
      if (typeof window === "undefined") return;
      const supabase = createClient();

      if (pathname.startsWith("/admin")) {
        const staff = await checkStaff(supabase);
        if (staff && active) {
          setSession(staff);
          return;
        }
        const player = await checkPlayer(supabase);
        if (active) setSession(player);
        return;
      }

      const player = await checkPlayer(supabase);
      if (player && active) {
        setSession(player);
        return;
      }

      const staff = await checkStaff(supabase);
      if (active) setSession(staff);
    }

    checkAuth();
    const onAuthChange = () => checkAuth();
    window.addEventListener("storage", onAuthChange);
    window.addEventListener("ikbal-auth-changed", onAuthChange);
    return () => {
      active = false;
      window.removeEventListener("storage", onAuthChange);
      window.removeEventListener("ikbal-auth-changed", onAuthChange);
    };
  }, [pathname]);

  const firstName = session?.name.split(" ")[0] || "";

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#02274c] text-white border-b-4 border-[#a60513] shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/logo.png"
              alt="Çorum İkbalspor Logosu"
              className="h-11 w-11 rounded-xl object-contain bg-white p-0.5 border-2 border-white/25 shadow"
            />
            <div className="leading-tight">
              <span className="block text-xl font-black tracking-wide">
                İKBALSPOR
              </span>
              <span className="block text-[11px] font-bold text-slate-300">
                Çorum İkbalspor • Çorum Süper Amatör Ligi
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
                  className={`px-3 py-2 rounded-xl font-bold text-sm transition ${
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
              <Link
                href={session.href}
                title={
                  session.role === "player"
                    ? "Sporcu Profiline Git"
                    : "Yönetim Paneline Git"
                }
                className="flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white font-extrabold text-sm transition shadow-sm"
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
            ) : (
              <>
                <Link
                  href="/sporcu"
                  className="px-4 py-2.5 rounded-xl bg-[#a60513] hover:bg-[#8a0410] text-white font-extrabold text-sm transition"
                >
                  Sporcu Girişi
                </Link>
                <Link
                  href="/admin"
                  className="px-4 py-2.5 rounded-xl bg-white text-[#02274c] hover:bg-slate-100 font-extrabold text-sm transition"
                >
                  Yönetim Paneli
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="lg:hidden px-3.5 py-2 rounded-xl bg-white/10 font-bold text-sm"
          >
            {open ? "Kapat ✕" : "Menü ☰"}
          </button>
        </div>

        {open && (
          <div className="lg:hidden bg-[#02274c] border-t border-white/15 px-4 py-3 space-y-1.5">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
              <Link
                href={session.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#a60513] text-white font-extrabold text-sm mt-2"
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
            ) : (
              <>
                <Link
                  href="/sporcu"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 rounded-xl bg-[#a60513] text-white font-extrabold text-sm text-center mt-2"
                >
                  Sporcu Girişi
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 rounded-xl bg-white text-[#02274c] font-extrabold text-sm text-center"
                >
                  Yönetim Paneli
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Mobil Alt Gezinme Çubuğu (PWA Deneyimi) */}
      <nav
        aria-label="Mobil Alt Menü"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(2,39,76,0.08)]"
      >
        <div className="grid grid-cols-5 h-16">
          {LINKS.slice(0, 4).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition ${
                  active ? "text-[#a60513]" : "text-slate-600"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          <Link
            href={session ? session.href : "/sporcu"}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition ${
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
            <span>
              {session
                ? session.role === "player"
                  ? firstName
                  : "Panel"
                : "Giriş"}
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}