// PlayerLogin.tsx
"use client";

import { useState } from "react";
import { Player } from "@/types/club";

export function getOrCreateWebDeviceId(): string {
  if (typeof window === "undefined") return "web-ssr";
  const key = "ikbal_web_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    const rand =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    id = `web-${rand}`;
    localStorage.setItem(key, id);
  }
  return id;
}

interface PlayerLoginProps {
  onLoginSuccess: (player: Player) => Promise<void>;
}

export function PlayerLogin({ onLoginSuccess }: PlayerLoginProps) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const cleanCode = code.trim().toUpperCase();
    const cleanPin = pin.trim();
    if (!cleanCode || !cleanPin) {
      setAuthError("Lütfen sporcu kodu ve PIN bilgisini girin.");
      return;
    }

    setAuthLoading(true);
    try {
      const deviceId = getOrCreateWebDeviceId();
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "player",
          code: cleanCode,
          pin: cleanPin,
          deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.player) {
        setAuthError(data.error || "Giriş başarısız.");
        return;
      }

      const p = data.player as Player;
      localStorage.setItem("ikbal_logged_player_id", p.id);
      window.dispatchEvent(new Event("ikbal-auth-changed"));
      await onLoginSuccess(p);
    } catch {
      setAuthError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] shadow-xs p-6 sm:p-8">
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 rounded-full bg-[var(--brand-navy-soft)] text-[var(--brand-ink)] text-xs font-extrabold uppercase tracking-wider mb-2">
          Sporcu Portalı
        </span>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">
          Sporcu Girişi
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Tarayıcıdan QR yoklama verin, malzemelerinizi, aidat ve programınızı
          görüntüleyin.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            Sporcu Kodu
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn: IKB-101"
            className="w-full px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
            PIN Kodu
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
          />
        </div>

        {authError && (
          <div className="p-3 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-text)]/25 text-[var(--status-danger-text)] text-sm font-semibold">
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-3.5 rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold transition cursor-pointer disabled:opacity-60"
        >
          {authLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}