"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Coach } from "@/types/club";
import { EASE, SPRING } from "@/lib/motion";

const supabase = createClient();

interface AdminLoginProps {
  onAdminSuccess: (adminName: string) => Promise<void>;
  onCoachSuccess: (coach: Coach) => Promise<void>;
}

export function AdminLogin({ onAdminSuccess, onCoachSuccess }: AdminLoginProps) {
  const [loginMode, setLoginMode] = useState<"admin" | "coach">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [coachPin, setCoachPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const azaltilmis = useReducedMotion();

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      setAuthError("Admin girişi başarısız: " + error.message);
      return;
    }
    const fullName = (data.user?.user_metadata?.full_name as string) || "";
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    await onAdminSuccess(fullName);
  }

  async function handleCoachLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "coach",
          code: coachCode.trim().toUpperCase(),
          pin: coachPin.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok || !data.coach) {
        setAuthError(data.error || "Antrenör kodu veya şifre hatalı.");
        return;
      }

      const coach = { ...data.coach, pin: "" } as Coach;
      localStorage.setItem("ikbal_coach", JSON.stringify(coach));
      window.dispatchEvent(new Event("ikbal-auth-changed"));
      await onCoachSuccess(coach);
    } catch {
      setAuthError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex items-center justify-center p-4 transition-colors">
      <motion.div
        initial={azaltilmis ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE.posta }}
        className="k-artik k-artik--yumusuk w-full max-w-md p-6 sm:p-8 border-t-4 border-t-[var(--brand-red)] space-y-5"
      >
        <div className="flex flex-col items-center text-center space-y-1">
          <img
            src="/logo.png"
            alt="Çorum İkbal Spor Kulübü"
            className="w-16 h-16 object-contain rounded-2xl bg-white border border-[var(--border-subtle)] p-1.5 mb-2 shadow-xs"
          />
          <span className="k-koz text-[10px]">YÖNETİM &amp; TEKNİK EKİP</span>
          <h1 className="k-posta text-2xl text-[var(--text-primary)]">
            Çorum İkbal Spor Kulübü
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Yönetim ve Antrenör Portalı
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-[var(--bg-subtle)] p-1.5 rounded-2xl border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              setLoginMode("admin");
              setAuthError("");
            }}
            className={`relative py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              loginMode === "admin"
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {loginMode === "admin" && !azaltilmis && (
              <motion.span
                layoutId="admin-login-mode"
                transition={SPRING.yumusak}
                className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]"
              />
            )}
            {loginMode === "admin" && azaltilmis && (
              <span className="absolute inset-0 rounded-xl bg-[var(--brand-navy)]" />
            )}
            <span className="relative z-10">Yönetici (Admin)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("coach");
              setAuthError("");
            }}
            className={`relative py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              loginMode === "coach"
                ? "text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {loginMode === "coach" && !azaltilmis && (
              <motion.span
                layoutId="admin-login-mode"
                transition={SPRING.yumusak}
                className="absolute inset-0 rounded-xl bg-[var(--brand-red)]"
              />
            )}
            {loginMode === "coach" && azaltilmis && (
              <span className="absolute inset-0 rounded-xl bg-[var(--brand-red)]" />
            )}
            <span className="relative z-10">Antrenör Girişi</span>
          </button>
        </div>

        {authError && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-extrabold">
            {authError}
          </div>
        )}

        {loginMode === "admin" ? (
          <form onSubmit={handleAdminLogin} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Admin E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="k-alan font-semibold"
            />
            <input
              type="password"
              required
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="k-alan font-semibold"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="k-buton k-buton--lacivert w-full !py-3 !text-sm"
            >
              {loading ? "Giriş Yapılıyor..." : "Admin Olarak Giriş Yap"}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={handleCoachLogin} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Antrenör Kodu (örn: ANT-1001)"
              value={coachCode}
              onChange={(e) => setCoachCode(e.target.value)}
              className="k-alan uppercase font-mono font-bold"
            />
            <input
              type="password"
              required
              placeholder="Antrenör Şifresi"
              value={coachPin}
              onChange={(e) => setCoachPin(e.target.value)}
              className="k-alan font-semibold"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="k-buton k-buton--kirmizi w-full !py-3 !text-sm"
            >
              {loading ? "Giriş Yapılıyor..." : "Antrenör Olarak Giriş Yap"}
            </motion.button>
          </form>
        )}

        <div className="pt-3 border-t border-[var(--border-subtle)] text-center">
          <Link
            href="/"
            className="k-altcizgi inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--brand-ink)] hover:text-[var(--brand-red)] transition"
          >
            <span>←</span>
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}