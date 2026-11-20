"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/kadro-kur", label: "Kadro Kur" },
  { href: "/gorevler", label: "Görevler & Maçlar" },
  { href: "/mesajlar", label: "Mesajlaşma" },
  { href: "/iletisim", label: "İletişim" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#02274c] text-white border-b-4 border-[#a60513] shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <img
            src="/logo.png"
            alt="Çorum İkbalspor Logosu"
            className="h-11 w-11 rounded-xl object-contain bg-white p-0.5 border-2 border-white/25 shadow"
          />
          <div className="leading-tight">
            <span className="block text-xl font-black tracking-wide">İKBALSPOR</span>
            <span className="block text-[11px] font-bold text-slate-300">
              Çorum İkbalspor • Profesyonelliğe Geçiş
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
                  active ? "bg-[#a60513] text-white" : "text-slate-100 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
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
                pathname === item.href ? "bg-[#a60513] text-white" : "text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
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
        </div>
      )}
    </header>
  );
}