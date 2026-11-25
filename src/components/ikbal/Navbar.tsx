"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ThemeSwitch } from "@/components/ikbal/ThemeSwitch";
import { EASE, SPRING } from "@/lib/motion";

const THEME_STORAGE_KEY = "ikbalspor_theme";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/kadro-kur", label: "Kadro Kur" },
  { href: "/bildirimler", label: "Duyurular" },
  { href: "/kayit", label: "Üyelik Başvurusu" },
  { href: "/iletisim", label: "İletişim" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [playerLoggedIn, setPlayerLoggedIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const azaltilmis = useReducedMotion();

  useEffect(() => {
    const applySavedTheme = () => {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        const isDark = saved === "dark";
        const next: "light" | "dark" = isDark ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        document.documentElement.classList.toggle("dark", isDark);
      } catch {
        // yoksay
      }
    };

    applySavedTheme();
  }, []);

  function handleToggleTheme() {
    setTheme((prev) => {
      const next: "light" | "dark" = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // yoksay
      }
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }

  useEffect(() => {
    const syncPlayerStatus = () => {
      try {
        const id = localStorage.getItem("ikbal_logged_player_id");
        setPlayerLoggedIn(Boolean(id && id.trim()));
      } catch {
        setPlayerLoggedIn(false);
      }
    };

    syncPlayerStatus();
    window.addEventListener("ikbal-auth-changed", syncPlayerStatus);
    window.addEventListener("storage", syncPlayerStatus);
    return () => {
      window.removeEventListener("ikbal-auth-changed", syncPlayerStatus);
      window.removeEventListener("storage", syncPlayerStatus);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--brand-navy)] text-white border-b border-white/10 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 min-h-16 py-2 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-2 shrink min-w-0"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src="/logo-square.png"
            alt="Çorum İkbal Spor Kulübü"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover bg-white border border-white/25 shrink-0"
          />
          <div className="leading-tight min-w-0">
            <div className="text-xs sm:text-sm font-black tracking-tight truncate">
              ÇORUM İKBAL SPOR
            </div>
            <div className="hidden sm:block text-[10px] font-bold text-amber-200 tracking-wider uppercase whitespace-nowrap">
              2026–2027 Kulüp Platformu
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
                  active
                    ? "text-[var(--brand-navy)]"
                    : "text-slate-100 hover:bg-white/10"
                }`}
              >
                {active && !azaltilmis && (
                  <motion.span
                    layoutId="nav-aktif-pil"
                    transition={SPRING.yumusak}
                    className="absolute inset-0 rounded-xl bg-white shadow-xs"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <ThemeSwitch theme={theme} onToggle={handleToggleTheme} />
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold whitespace-nowrap transition"
          >
            Yönetim
          </Link>
          <Link
            href="/sporcu"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black whitespace-nowrap shadow-xs transition"
          >
            {playerLoggedIn ? "Sporcu Paneli" : "Sporcu Girişi"}
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <ThemeSwitch theme={theme} onToggle={handleToggleTheme} compact />
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Menüyü Aç/Kapat"
            aria-expanded={mobileOpen}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/12 border border-white/20 text-xs font-black cursor-pointer transition hover:bg-white/20 shrink-0"
          >
            {mobileOpen ? "Kapat" : "Menü"}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            initial={azaltilmis ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={azaltilmis ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.26, ease: EASE.yumusak }}
            className="md:hidden overflow-hidden bg-[var(--brand-navy)] border-t border-white/10 px-3 sm:px-4 py-3 space-y-1.5"
          >
            {NAV_LINKS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block min-h-[42px] flex items-center px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition ${
                    active
                      ? "bg-white text-[var(--brand-navy)]"
                      : "text-slate-100 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-white/15 grid grid-cols-2 gap-2">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="min-h-[42px] flex items-center justify-center py-2.5 px-3 rounded-xl bg-white/12 border border-white/20 text-white text-center text-xs font-extrabold"
              >
                Yönetim Paneli
              </Link>
              <Link
                href="/sporcu"
                onClick={() => setMobileOpen(false)}
                className="min-h-[42px] flex items-center justify-center py-2.5 px-3 rounded-xl bg-amber-400 text-slate-950 text-center text-xs font-black"
              >
                {playerLoggedIn ? "Sporcu Paneli" : "Sporcu Girişi"}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}