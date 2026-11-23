"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const THEME_KEY = "ikbalspor_theme";

const NAV_ITEMS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/kadro-kur", label: "Kadro Kur" },
  { href: "/sporcu", label: "Sporcu Paneli" },
  { href: "/bildirimler", label: "Duyurular" },
  { href: "/kayit", label: "Üyelik Başvurusu" },
  { href: "/iletisim", label: "İletişim" },
];

export function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        const isDark =
          saved === "dark" ||
          (!saved &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (isDark) {
          setTheme("dark");
          document.documentElement.classList.add("dark");
        } else {
          setTheme("light");
          document.documentElement.classList.remove("dark");
        }
      } catch {
        // yoksay
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // yoksay
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--brand-navy)] text-white border-b-3 border-[var(--brand-red)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2.5 min-w-0 shrink-0"
        >
          <img
            src="/logo.png"
            alt="Çorum İkbalspor"
            className="w-9 h-9 rounded-xl bg-white p-0.5 object-contain shrink-0"
          />
          <div className="leading-tight">
            <span className="block text-sm sm:text-base font-black tracking-tight text-white">
              ÇORUM İKBALSPOR
            </span>
            <span className="block text-[10px] font-bold text-amber-200 tracking-wide">
              2026–2027 GELİŞİM &amp; AMATÖR
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
                  active
                    ? "bg-[var(--brand-red)] text-white shadow-xs"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Tema değiştir"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-extrabold text-white cursor-pointer transition"
          >
            {theme === "dark" ? "Açık" : "Koyu"}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menü"
            className="lg:hidden px-3 py-1.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-xs font-black text-white cursor-pointer transition"
          >
            {mobileMenuOpen ? "Kapat" : "Menü"}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#081b33] border-t border-white/15 px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition ${
                  active
                    ? "bg-[var(--brand-red)] text-white"
                    : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}