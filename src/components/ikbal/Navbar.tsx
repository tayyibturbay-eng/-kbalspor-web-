"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitch } from "@/components/ikbal/ThemeSwitch";

const THEME_KEY = "ikbalspor_theme";

const LEFT_NAV_ITEMS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/kadro-kur", label: "Kadro Kur" },
  { href: "/bildirimler", label: "Duyurular" },
  { href: "/kayit", label: "Üyelik Başvurusu" },
  { href: "/iletisim", label: "İletişim" },
];

function applyThemeToDom(next: "light" | "dark") {
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // yoksay
  }
  document.documentElement.setAttribute("data-theme", next);
  if (next === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

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
        const initial: "light" | "dark" = isDark ? "dark" : "light";
        setTheme(initial);
        applyThemeToDom(initial);
      } catch {
        // yoksay
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyThemeToDom(next);
  };

  const panelActive = pathname?.startsWith("/sporcu");

  return (
    <header className="sticky top-0 z-40 bg-[var(--brand-navy)] text-white border-b-3 border-[var(--brand-red)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
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
            {LEFT_NAV_ITEMS.map((item) => {
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeSwitch theme={theme} onToggle={toggleTheme} compact />

          <Link
            href="/sporcu"
            onClick={() => setMobileMenuOpen(false)}
            className={`hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-black transition whitespace-nowrap ${
              panelActive
                ? "bg-amber-400 text-slate-950 shadow-xs"
                : "bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white shadow-xs"
            }`}
          >
            Sporcu Paneli
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menü"
            className="lg:hidden px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-black text-white cursor-pointer transition"
          >
            {mobileMenuOpen ? "Kapat" : "Menü"}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#081b33] border-t border-white/15 px-4 py-3 space-y-1.5">
          {LEFT_NAV_ITEMS.map((item) => {
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

          <Link
            href="/sporcu"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3.5 py-2.5 rounded-xl text-xs font-black bg-amber-400 text-slate-950"
          >
            Sporcu Paneli
          </Link>
        </div>
      )}
    </header>
  );
}