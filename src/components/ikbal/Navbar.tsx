"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitch } from "@/components/ikbal/ThemeSwitch";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/kadro-kur", label: "Kadro Kur" },
  { href: "/gorevler", label: "Maç & Görevler" },
  { href: "/bildirimler", label: "Duyurular" },
  { href: "/kayit", label: "Üyelik Başvurusu" },
  { href: "/iletisim", label: "İletişim" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [playerLoggedIn, setPlayerLoggedIn] = useState(false);

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
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 min-w-0"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src="/logo.png"
            alt="Çorum İkbalspor"
            className="w-9 h-9 rounded-xl object-cover bg-white border border-white/25 shrink-0"
          />
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight whitespace-nowrap">
              ÇORUM İKBALSPOR
            </div>
            <div className="text-[10px] font-bold text-amber-200 tracking-wider uppercase whitespace-nowrap">
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
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  active
                    ? "bg-white text-[var(--brand-navy)] shadow-xs"
                    : "text-slate-100 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <ThemeSwitch />
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-white text-xs font-extrabold whitespace-nowrap transition"
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

        <div className="flex md:hidden items-center gap-2">
          <ThemeSwitch />
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Menüyü Aç/Kapat"
            className="px-3 py-2 rounded-xl bg-white/12 border border-white/20 text-xs font-black cursor-pointer"
          >
            {mobileOpen ? "Kapat" : "Menü"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#042344] border-t border-white/10 px-4 py-3 space-y-1.5">
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
                className={`block px-3.5 py-2.5 rounded-xl text-xs font-extrabold ${
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
              className="py-2.5 px-3 rounded-xl bg-white/12 border border-white/20 text-white text-center text-xs font-extrabold"
            >
              Yönetim Paneli
            </Link>
            <Link
              href="/sporcu"
              onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 rounded-xl bg-amber-400 text-slate-950 text-center text-xs font-black"
            >
              {playerLoggedIn ? "Sporcu Paneli" : "Sporcu Girişi"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}