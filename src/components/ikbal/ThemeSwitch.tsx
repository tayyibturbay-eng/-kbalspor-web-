"use client";

import React from "react";

interface ThemeSwitchProps {
  theme: "light" | "dark";
  onToggle: () => void;
  compact?: boolean;
}

export function ThemeSwitch({
  theme,
  onToggle,
  compact = false,
}: ThemeSwitchProps) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      onClick={onToggle}
      className="inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/25 text-white cursor-pointer transition select-none shrink-0"
    >
      <span
        className={`relative w-11 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 ${
          isDark
            ? "bg-slate-900 border-white/80"
            : "bg-slate-200 border-slate-900"
        }`}
      >
        <span
          className={`w-4 h-4 rounded-full transition-transform duration-200 shadow-xs ${
            isDark
              ? "translate-x-5 bg-white"
              : "translate-x-0 bg-slate-950"
          }`}
        />
      </span>
      {!compact && (
        <span className="text-xs font-extrabold tracking-tight whitespace-nowrap">
          {isDark ? "Tema: Koyu" : "Tema: Açık"}
        </span>
      )}
    </button>
  );
}