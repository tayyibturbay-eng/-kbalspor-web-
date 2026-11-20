"use client";

import { useState } from "react";
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border-t-4 border-[#a60513]">
        <h1 className="text-2xl font-extrabold text-[#02274c] text-center mb-1">
          Çorum İkbalspor
        </h1>
        <p className="text-sm text-slate-600 text-center mb-5">
          Yönetim ve Antrenör Portalı
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setLoginMode("admin");
              setAuthError("");
            }}
            className={`py-2 rounded-lg text-sm font-bold transition ${
              loginMode === "admin"
                ? "bg-[#02274c] text-white"
                : "text-slate-700"
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
            className={`py-2 rounded-lg text-sm font-bold transition ${
              loginMode === "coach"
                ? "bg-[#a60513] text-white"
                : "text-slate-700"
            }`}
          >
            Antrenör Girişi
          </button>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
            />
            <input
              type="password"
              required
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#02274c] text-white font-bold py-2.5 rounded-lg disabled:opacity-60"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase text-slate-900 bg-white placeholder:text-slate-500"
            />
            <input
              type="password"
              required
              placeholder="Antrenör Şifresi"
              value={coachPin}
              onChange={(e) => setCoachPin(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a60513] text-white font-bold py-2.5 rounded-lg disabled:opacity-60"
            >
              {loading ? "Giriş Yapılıyor..." : "Antrenör Olarak Giriş Yap"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}