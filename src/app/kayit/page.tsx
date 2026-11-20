"use client";

import { useState } from "react";
import Link from "next/link";

export default function KayitPage() {
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    parent_phone: "",
    position: "Orta Saha",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Başvuru gönderilemedi.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border-t-4 border-[#a60513] text-slate-900">
        <h1 className="text-2xl font-extrabold text-[#02274c] text-center">Çorum İkbalspor</h1>
        <p className="text-sm text-slate-600 text-center mb-5">Yeni Oyuncu Üyelik Talebi</p>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold">
              ✅ Üyelik talebiniz yöneticiye iletildi! Onaylandığında giriş ID ve şifreniz hazırlanacaktır.
            </div>
            <Link href="/" className="inline-block bg-[#02274c] text-white font-bold px-5 py-2.5 rounded-xl text-sm">
              Ana Sayfaya Dön
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
            <div>
              <label className="text-xs font-bold text-slate-600">Oyuncu Adı Soyadı</label>
              <input
                required
                placeholder="Örn: Mehmet Demir"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Doğum Tarihi</label>
              <input
                type="date"
                required
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Veli / Oyuncu Telefonu</label>
              <input
                required
                placeholder="05XX XXX XX XX"
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Tercih Ettiği Mevki</label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              >
                <option>Kaleci</option>
                <option>Defans</option>
                <option>Orta Saha</option>
                <option>Forvet</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Ek Not (Opsiyonel)</label>
              <input
                placeholder="Daha önce oynadığı kulüp vb."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a60513] text-white font-bold py-2.5 rounded-xl text-sm"
            >
              {loading ? "Gönderiliyor..." : "Üyelik Talebi Gönder"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}