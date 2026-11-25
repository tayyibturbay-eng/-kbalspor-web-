"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";
import { DueDisplayItem } from "./PlayerDuesTab";

const supabase = createClient();

function makeAvatarSvg(bg: string, accent: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3"/><text x="60" y="75" font-size="54" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { id: "futbolcu", label: "Futbolcu", url: makeAvatarSvg("#0b2545", "#b91c1c", "⚽") },
  { id: "kaleci", label: "Kaleci", url: makeAvatarSvg("#0f766e", "#0b2545", "🧤") },
  { id: "yildiz", label: "Yıldız", url: makeAvatarSvg("#b45309", "#0b2545", "⭐") },
  { id: "kupa", label: "Şampiyon", url: makeAvatarSvg("#b91c1c", "#7f1d1d", "🏆") },
  { id: "aslan", label: "Aslan", url: makeAvatarSvg("#1e3a8a", "#3b82f6", "🦁") },
  { id: "kartal", label: "Atik", url: makeAvatarSvg("#334155", "#0b2545", "⚡") },
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

  // Optimistic avatar güncelleme + rollback
  async function savePlayerPhoto(url: string | null, successText: string) {
    setPhotoMsg(null);
    const prevPhoto = player.photo_url;
    setPlayer({ ...player, photo_url: url });
    window.dispatchEvent(new Event("ikbal-auth-changed"));
    setPhotoMsg({ ok: true, text: successText });

    const { error } = await supabase
      .from("players")
      .update({ photo_url: url })
      .eq("id", player.id);

    if (error) {
      setPlayer({ ...player, photo_url: prevPhoto });
      window.dispatchEvent(new Event("ikbal-auth-changed"));
      setPhotoMsg({
        ok: false,
        text: "Fotoğraf kaydedilemedi, geri alındı: " + error.message,
      });
    }
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
    setPlayer({ ...player, player_pin: "***", pin_changed: true });
    setNewPin("");
    setPinMsg({ ok: true, text: "PIN kodunuz başarıyla güncellendi." });
  }

  return (
    <div className="k-artik p-6 space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="space-y-0.5">
        <span className="k-koz text-[10px] block">HESAP &amp; GÜVENLİK</span>
        <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
          Bilgilerim, Profil Fotoğrafı &amp; PIN
        </h2>
      </div>

      <div className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-[var(--brand-navy)] text-white overflow-hidden flex items-center justify-center border-2 border-[var(--border-subtle)] shadow-md shrink-0">
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
              <h3 className="font-extrabold text-sm text-[var(--text-primary)]">
                Profil Fotoğrafı veya Avatar
              </h3>
              <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">
                Kendi fotoğrafınızı yükleyebilir veya aşağıdaki hazır
                avatarlardan birini seçebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="k-buton k-buton--lacivert !py-2.5 !px-4 !text-xs">
              {photoUploading ? "Yükleniyor..." : "Fotoğraf Yükle"}
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
                className="k-buton k-buton--hayalet !py-2.5 !px-3.5 !text-xs"
              >
                Kaldır
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="k-koz text-[10px] mb-2">
            Hazır Avatarlar (Tek tıkla seçin):
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {PRESET_AVATARS.map((av) => {
              const selected = player.photo_url === av.url;
              return (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={av.id}
                  type="button"
                  onClick={() =>
                    savePlayerPhoto(av.url, `${av.label} avatarı seçildi.`)
                  }
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition cursor-pointer ${
                    selected
                      ? "bg-[var(--bg-surface)] border-[var(--brand-red)] ring-2 ring-[var(--brand-red)]/30 shadow-xs"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--brand-navy)]"
                  }`}
                >
                  <img
                    src={av.url}
                    alt={av.label}
                    className="w-12 h-12 rounded-full"
                  />
                  <span className="text-[11px] font-extrabold text-[var(--text-primary)]">
                    {av.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {photoMsg && (
          <div
            className={`text-xs font-extrabold ${
              photoMsg.ok
                ? "text-[var(--status-success-text)]"
                : "text-[var(--status-danger-text)]"
            }`}
          >
            {photoMsg.text}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <span className="k-koz text-[10px] block mb-1">Ad Soyad</span>
          <span className="font-extrabold text-[var(--text-primary)]">
            {player.full_name}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <span className="k-koz text-[10px] block mb-1">Lisans No</span>
          <span className="font-extrabold text-[var(--text-primary)]">
            {player.license_no || "Belirtilmemiş"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <span className="k-koz text-[10px] block mb-1">Aidat Özeti</span>
          {overdueCount > 0 ? (
            <span className="font-extrabold text-[var(--status-danger-text)]">
              Gecikti ({overdueCount} ay)
            </span>
          ) : currentMonthItem?.state === "paid" ? (
            <span className="font-extrabold text-[var(--status-success-text)]">
              {currentMonthItem.monthLabel}: Ödendi
            </span>
          ) : (
            <span className="font-extrabold text-[var(--status-warning-text)]">
              {currentMonthItem?.monthLabel || "Güncel Dönem"}: Ödenmedi
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handlePinChange} className="space-y-3 max-w-sm">
        <label className="k-koz text-[10px] block">
          Yeni PIN Belirle (En az 4 hane)
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Yeni PIN..."
            className="k-alan flex-1"
          />
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            className="k-buton k-buton--lacivert !px-5"
          >
            Güncelle
          </motion.button>
        </div>
        {pinMsg && (
          <div
            className={`text-xs font-extrabold ${
              pinMsg.ok
                ? "text-[var(--status-success-text)]"
                : "text-[var(--status-danger-text)]"
            }`}
          >
            {pinMsg.text}
          </div>
        )}
      </form>
    </div>
  );
}