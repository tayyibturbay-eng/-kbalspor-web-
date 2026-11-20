"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";

const supabase = createClient();

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
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .ilike("player_code", cleanCode)
      .maybeSingle();

    if (error || !data) {
      setAuthError("Sporcu kodu bulunamadı.");
      setAuthLoading(false);
      return;
    }

    const p = data as Player;
    if ((p.player_pin || "") !== cleanPin) {
      setAuthError("PIN kodu hatalı.");
      setAuthLoading(false);
      return;
    }

    const deviceId = getOrCreateWebDeviceId();
    if (p.bound_device_id && p.bound_device_id !== deviceId) {
      setAuthError(
        "Bu hesap başka bir cihaza veya mobil uygulamaya tanımlı. Bu tarayıcıdan giriş için yöneticiden 'Cihaz Kilidini Sıfırla' işlemini isteyin."
      );
      setAuthLoading(false);
      return;
    }

    if (!p.bound_device_id) {
      await supabase
        .from("players")
        .update({ bound_device_id: deviceId })
        .eq("id", p.id);
      p.bound_device_id = deviceId;
    }

    localStorage.setItem("ikbal_logged_player_id", p.id);
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    await onLoginSuccess(p);
    setAuthLoading(false);
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 rounded-full bg-[#02274c]/10 text-[#02274c] text-xs font-extrabold uppercase tracking-wider mb-2">
          Sporcu Portalı
        </span>
        <h1 className="text-2xl font-black text-[#02274c]">Sporcu Girişi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Uygulama indirmeden tarayıcıdan QR yoklama verin, malzemelerinizi,
          aidat ve programınızı görün.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Sporcu Kodu
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn: IKB-101"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            PIN Kodu
          </label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#02274c]"
          />
        </div>

        {authError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full py-3.5 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white font-extrabold transition cursor-pointer disabled:opacity-60"
        >
          {authLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}