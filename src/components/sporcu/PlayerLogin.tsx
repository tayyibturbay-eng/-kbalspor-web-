"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Player } from "@/types/club";
import { EASE } from "@/lib/motion";

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
  const azaltilmis = useReducedMotion();

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
    <motion.div
      initial={azaltilmis ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.48, ease: EASE.posta }}
      className="max-w-md mx-auto k-artik k-artik--yumusuk border-t-4 border-t-[var(--brand-navy)] p-6 sm:p-8"
    >
      <div className="text-center mb-6 space-y-1.5">
        <span className="k-etiket k-etiket--lacivert">SPORCU PORTALI</span>
        <h1 className="k-posta text-2xl text-[var(--text-primary)]">
          Sporcu Girişi
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Tarayıcıdan QR yoklama verin, malzemelerinizi, aidat ve programınızı
          görüntüleyin.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="k-koz text-[10px] block mb-1.5">
            Sporcu Kodu
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn: IKB-101"
            className="k-alan uppercase font-mono font-bold !py-3"
          />
        </div>

        <div>
          <label className="k-koz text-[10px] block mb-1.5">PIN Kodu</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="k-alan font-bold !py-3"
          />
        </div>

        {authError && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-text)]/25 text-[var(--status-danger-text)] text-xs font-extrabold">
            {authError}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={authLoading}
          className="k-buton k-buton--lacivert w-full !py-3.5 !text-sm"
        >
          {authLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </motion.button>
      </form>
    </motion.div>
  );
}