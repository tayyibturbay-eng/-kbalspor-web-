"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";
import { DueDisplayItem } from "./PlayerDuesTab";

const supabase = createClient();

function makeAvatarSvg(bg: string, accent: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3"/><text x="60" y="75" font-size="54" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { id: "futbolcu", label: "Futbolcu", url: makeAvatarSvg("#02274c", "#a60513", "⚽") },
  { id: "kaleci", label: "Kaleci", url: makeAvatarSvg("#0f766e", "#02274c", "🧤") },
  { id: "yildiz", label: "Yıldız", url: makeAvatarSvg("#b45309", "#02274c", "⭐") },
  { id: "kupa", label: "Şampiyon", url: makeAvatarSvg("#a60513", "#7f1d1d", "🏆") },
  { id: "aslan", label: "Aslan", url: makeAvatarSvg("#1e3a8a", "#3b82f6", "🦁") },
  { id: "kartal", label: "Atik", url: makeAvatarSvg("#334155", "#02274c", "⚡") },
];

interface PlayerProfileTabProps {
  player: Player;
  setPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  overdueCount: number;
  currentMonthItem?: DueDisplayItem;
}

export function PlayerProfileTab({
  player,
  setPlayer,
  overdueCount,
  currentMonthItem,
}: PlayerProfileTabProps) {
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  async function savePlayerPhoto(url: string | null, successText: string) {
    setPhotoMsg(null);
    const { error } = await supabase
      .from("players")
      .update({ photo_url: url })
      .eq("id", player.id);

    if (error) {
      setPhotoMsg({
        ok: false,
        text: "Fotoğraf kaydedilemedi: " + error.message,
      });
      return;
    }
    setPlayer({ ...player, photo_url: url });
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    setPhotoMsg({ ok: true, text: successText });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setPhotoMsg({
        ok: false,
        text: "Fotoğraf boyutu en fazla 4 MB olabilir.",
      });
      return;
    }

    setPhotoUploading(true);
    setPhotoMsg(null);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `player-avatars/${player.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("jersey-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      setPhotoMsg({ ok: false, text: "Yükleme hatası: " + uploadErr.message });
      setPhotoUploading(false);
      return;
    }

    const { data: pub } = supabase.storage
      .from("jersey-photos")
      .getPublicUrl(filePath);
    await savePlayerPhoto(pub.publicUrl, "Profil fotoğrafınız güncellendi.");
    setPhotoUploading(false);
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newPin.trim();
    if (cleaned.length < 4) {
      setPinMsg({ ok: false, text: "Yeni PIN en az 4 karakter olmalıdır." });
      return;
    }
    const { error } = await supabase
      .from("players")
      .update({ player_pin: cleaned, pin_changed: true })
      .eq("id", player.id);

    if (error) {
      setPinMsg({ ok: false, text: "PIN güncellenemedi: " + error.message });
      return;
    }
    setPlayer({ ...player, player_pin: cleaned, pin_changed: true });
    setNewPin("");
    setPinMsg({ ok: true, text: "PIN kodunuz başarıyla güncellendi." });
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
      <h2 className="text-lg font-black text-[#02274c]">
        Bilgilerim, Profil Fotoğrafı & PIN
      </h2>

      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-[#02274c] text-white overflow-hidden flex items-center justify-center border-2 border-white shadow-md shrink-0">
              {player.photo_url ? (
                <img
                  src={player.photo_url}
                  alt={player.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black">
                  {player.full_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#02274c]">
                Profil Fotoğrafı veya Avatar
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kendi fotoğrafınızı yükleyebilir veya aşağıdaki hazır
                avatarlardan birini seçebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="px-4 py-2.5 rounded-xl bg-[#02274c] hover:bg-[#033668] text-white text-xs font-extrabold cursor-pointer transition">
              {photoUploading ? "Yükleniyor..." : "📷 Fotoğraf Yükle"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
                className="hidden"
              />
            </label>
            {player.photo_url && (
              <button
                type="button"
                onClick={() =>
                  savePlayerPhoto(null, "Profil fotoğrafı kaldırıldı.")
                }
                className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Kaldır
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">
            Hazır Avatarlar (Tek tıkla seçin):
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {PRESET_AVATARS.map((av) => {
              const selected = player.photo_url === av.url;
              return (
                <button
                  key={av.id}
                  type="button"
                  onClick={() =>
                    savePlayerPhoto(av.url, `${av.label} avatarı seçildi.`)
                  }
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition cursor-pointer ${
                    selected
                      ? "bg-white border-[#a60513] ring-2 ring-[#a60513]/30 shadow-xs"
                      : "bg-white border-slate-200 hover:border-[#02274c]"
                  }`}
                >
                  <img
                    src={av.url}
                    alt={av.label}
                    className="w-12 h-12 rounded-full"
                  />
                  <span className="text-[11px] font-extrabold text-slate-700">
                    {av.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {photoMsg && (
          <div
            className={`text-xs font-bold ${
              photoMsg.ok ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {photoMsg.text}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500 block">Ad Soyad</span>
          <span className="font-bold">{player.full_name}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500 block">Lisans No</span>
          <span className="font-bold">{player.license_no || "Belirtilmemiş"}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500 block">Aidat Özeti</span>
          {overdueCount > 0 ? (
            <span className="font-extrabold text-red-600">
              ⚠️ Gecikti ({overdueCount} ay)
            </span>
          ) : currentMonthItem?.state === "paid" ? (
            <span className="font-extrabold text-emerald-700">
              ✓ {currentMonthItem.monthLabel}: Ödendi
            </span>
          ) : (
            <span className="font-extrabold text-amber-700">
              {currentMonthItem?.monthLabel}: Ödenmedi
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handlePinChange} className="space-y-3 max-w-sm">
        <label className="block text-xs font-bold text-slate-600">
          Yeni PIN Belirle (En az 4 hane)
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Yeni PIN..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#02274c] text-white text-sm font-extrabold cursor-pointer"
          >
            Güncelle
          </button>
        </div>
        {pinMsg && (
          <div
            className={`text-xs font-bold ${
              pinMsg.ok ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {pinMsg.text}
          </div>
        )}
      </form>
    </div>
  );
}