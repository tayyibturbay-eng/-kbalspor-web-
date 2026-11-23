// AdminLogin.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Coach } from "@/types/club";

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
    const { data, error } = await supabase
      .from("coaches")
      .select("*")
      .eq("coach_code", coachCode.trim().toUpperCase())
      .eq("pin", coachPin.trim())
      .eq("is_active", true)
      .maybeSingle();
    setLoading(false);

    if (error || !data) {
      setAuthError("Antrenör kodu veya şifre hatalı.");
      return;
    }
    const coach = data as Coach;
    localStorage.setItem("ikbal_coach", JSON.stringify(coach));
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    await onCoachSuccess(coach);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex items-center justify-center p-4 transition-colors">
      <div className="bg-[var(--bg-surface)] rounded-3xl shadow-xl w-full max-w-md p-6 sm:p-7 border border-[var(--border-subtle)] border-t-4 border-t-[var(--brand-red)] space-y-4 page-transition">
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Çorum İkbalspor"
            className="w-14 h-14 object-contain rounded-2xl bg-white border border-[var(--border-subtle)] p-1.5 mb-2"
          />
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            Çorum İkbalspor
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Yönetim ve Antrenör Portalı
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              setLoginMode("admin");
              setAuthError("");
            }}
            className={`py-2 rounded-lg text-sm font-extrabold transition cursor-pointer ${
              loginMode === "admin"
                ? "bg-[var(--brand-navy)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Yönetici (Admin)
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("coach");
              setAuthError("");
            }}
            className={`py-2 rounded-lg text-sm font-extrabold transition cursor-pointer ${
              loginMode === "coach"
                ? "bg-[var(--brand-red)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Antrenör Girişi
          </button>
        </div>

        {authError && (
          <div className="p-3 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-sm font-semibold">
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
              className="w-full border border-[var(--border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--bg-subtle)] placeholder:text-[var(--text-muted)]"
            />
            <input
              type="password"
              required
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--bg-subtle)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white font-extrabold py-2.5 rounded-xl disabled:opacity-60 cursor-pointer transition"
            >
              {loading ? "Giriş Yapılıyor..." : "Admin Olarak Giriş Yap"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCoachLogin} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Antrenör Kodu (örn: ANT-1001)"
              value={coachCode}
              onChange={(e) => setCoachCode(e.target.value)}
              className="w-full border border-[var(--border-strong)] rounded-xl px-3.5 py-2.5 text-sm uppercase text-[var(--text-primary)] bg-[var(--bg-subtle)] placeholder:text-[var(--text-muted)]"
            />
            <input
              type="password"
              required
              placeholder="Antrenör Şifresi"
              value={coachPin}
              onChange={(e) => setCoachPin(e.target.value)}
              className="w-full border border-[var(--border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--bg-subtle)] placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white font-extrabold py-2.5 rounded-xl disabled:opacity-60 cursor-pointer transition"
            >
              {loading ? "Giriş Yapılıyor..." : "Antrenör Olarak Giriş Yap"}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-[var(--border-subtle)] text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--brand-navy)] dark:text-sky-300 hover:text-[var(--brand-red)] transition"
          >
            <span>←</span>
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>
      </div>
    </div>
  );
}