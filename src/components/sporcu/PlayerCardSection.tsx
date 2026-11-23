"use client";

import React, { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";

const supabase = createClient();

interface PlayerCardSectionProps {
  player: Player;
  onPlayerUpdated?: (updated: Player) => void;
  onFeedback?: (msg: string) => void;
}

type CardTierKey = "bronze" | "silver" | "gold" | "diamond";

type CardTier = {
  key: CardTierKey;
  label: string;
  badgeText: string;
  cardBg: string;
  borderColor: string;
  accentText: string;
  outerGlow: string;
  canvasColors: [string, string, string];
  canvasAccent: string;
};

function getCardTier(ovr: number): CardTier {
  if (ovr >= 90) {
    return {
      key: "diamond",
      label: "Diamond Kart",
      badgeText: "90+ Diamond",
      cardBg: "from-cyan-600 via-indigo-700 to-fuchsia-900",
      borderColor: "border-cyan-200/90",
      accentText: "text-cyan-100",
      outerGlow:
        "shadow-[0_0_38px_rgba(34,211,238,0.55),0_0_70px_rgba(192,132,252,0.35)]",
      canvasColors: ["#0891b2", "#3730a3", "#701a75"],
      canvasAccent: "#67e8f9",
    };
  }
  if (ovr >= 70) {
    return {
      key: "gold",
      label: "Gold Kart",
      badgeText: "70-90 Gold",
      cardBg: "from-amber-400 via-yellow-600 to-amber-900",
      borderColor: "border-yellow-200/90",
      accentText: "text-amber-100",
      outerGlow: "shadow-[0_0_28px_rgba(250,204,21,0.42)]",
      canvasColors: ["#eab308", "#b45309", "#78350f"],
      canvasAccent: "#fef08a",
    };
  }
  if (ovr >= 50) {
    return {
      key: "silver",
      label: "Silver Kart",
      badgeText: "50-70 Silver",
      cardBg: "from-slate-300 via-slate-600 to-slate-900",
      borderColor: "border-slate-100/80",
      accentText: "text-slate-100",
      outerGlow: "shadow-[0_0_22px_rgba(203,213,225,0.35)]",
      canvasColors: ["#94a3b8", "#475569", "#0f172a"],
      canvasAccent: "#e2e8f0",
    };
  }
  return {
    key: "bronze",
    label: "Bronze Kart",
    badgeText: "0-50 Bronze",
    cardBg: "from-amber-800 via-[#8b3a17] to-stone-950",
    borderColor: "border-amber-400/60",
    accentText: "text-amber-200",
    outerGlow: "shadow-[0_0_18px_rgba(180,83,9,0.28)]",
    canvasColors: ["#92400e", "#8b3a17", "#1c1917"],
    canvasAccent: "#fdba74",
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function PlayerCardSection({
  player,
  onPlayerUpdated,
  onFeedback,
}: PlayerCardSectionProps) {
  const playerExt = player as Player & {
    skill_points?: number | null;
    pace?: number | null;
    shooting?: number | null;
    passing?: number | null;
    dribbling?: number | null;
    defending?: number | null;
    physical?: number | null;
    card_title?: string | null;
    card_motto?: string | null;
  };

  const [availablePoints, setAvailablePoints] = useState<number>(
    Number(playerExt.skill_points ?? 0)
  );
  const [pace, setPace] = useState<number>(Number(playerExt.pace ?? 20));
  const [shooting, setShooting] = useState<number>(
    Number(playerExt.shooting ?? 20)
  );
  const [passing, setPassing] = useState<number>(
    Number(playerExt.passing ?? 20)
  );
  const [dribbling, setDribbling] = useState<number>(
    Number(playerExt.dribbling ?? 40)
  );
  const [defending, setDefending] = useState<number>(
    Number(playerExt.defending ?? 20)
  );
  const [physical, setPhysical] = useState<number>(
    Number(playerExt.physical ?? 20)
  );
  const [cardTitle, setCardTitle] = useState<string>(
    playerExt.card_title || "Gol Makinesi"
  );
  const [cardMotto, setCardMotto] = useState<string>(
    playerExt.card_motto || "Sahada her şey takım için!"
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const ovr = useMemo(() => {
    const avg =
      (pace + shooting + passing + dribbling + defending + physical) / 6;
    return Math.max(1, Math.min(99, Math.round(avg)));
  }, [pace, shooting, passing, dribbling, defending, physical]);

  const tier = useMemo(() => getCardTier(ovr), [ovr]);

  function handleSpendPoint(
    stat:
      | "pace"
      | "shooting"
      | "passing"
      | "dribbling"
      | "defending"
      | "physical"
  ) {
    setStatusMsg(null);
    if (availablePoints <= 0) {
      setStatusMsg({
        ok: false,
        text: "Harcamak için yeterli puanınız bulunmuyor (Kalan Puan: 0).",
      });
      return;
    }

    setAvailablePoints((prev) => Math.max(0, prev - 1));
    if (stat === "pace") setPace((v) => Math.min(99, v + 1));
    if (stat === "shooting") setShooting((v) => Math.min(99, v + 1));
    if (stat === "passing") setPassing((v) => Math.min(99, v + 1));
    if (stat === "dribbling") setDribbling((v) => Math.min(99, v + 1));
    if (stat === "defending") setDefending((v) => Math.min(99, v + 1));
    if (stat === "physical") setPhysical((v) => Math.min(99, v + 1));
  }

  async function handleSaveCard() {
    setSaving(true);
    setStatusMsg(null);

    const cleanTitle = cardTitle.trim() || "Gol Makinesi";
    const cleanMotto = cardMotto.trim() || "Sahada her şey takım için!";

    const { error } = await supabase
      .from("players")
      .update({
        skill_points: availablePoints,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
        card_title: cleanTitle,
        card_motto: cleanMotto,
      })
      .eq("id", player.id);

    setSaving(false);

    if (error) {
      const msg = "Kart kaydedilemedi: " + error.message;
      setStatusMsg({ ok: false, text: msg });
      onFeedback?.(msg);
      return;
    }

    const okMsg = "Futbolcu kartınız ve yetenek puanlarınız kaydedildi.";
    setStatusMsg({ ok: true, text: okMsg });
    onFeedback?.(okMsg);
    onPlayerUpdated?.({
      ...player,
      ...({
        skill_points: availablePoints,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
        card_title: cleanTitle,
        card_motto: cleanMotto,
      } as Partial<Player>),
    });
  }

  async function buildCardPngBlob(): Promise<Blob | null> {
    const width = 760;
    const height = 1040;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Arka plan kart gradyanı
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, tier.canvasColors[0]);
    grad.addColorStop(0.55, tier.canvasColors[1]);
    grad.addColorStop(1, tier.canvasColors[2]);

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, width, height);

    drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 48);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = tier.key === "diamond" ? 8 : 5;
    ctx.strokeStyle = tier.canvasAccent;
    ctx.stroke();

    // Diamond prizmatik çizgiler & parıltılar
    if (tier.key === "diamond") {
      ctx.save();
      drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 42);
      ctx.clip();

      const sheenGrad = ctx.createLinearGradient(0, 0, width, height);
      sheenGrad.addColorStop(0, "rgba(103, 232, 249, 0.28)");
      sheenGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.22)");
      sheenGrad.addColorStop(0.75, "rgba(232, 121, 249, 0.26)");
      sheenGrad.addColorStop(1, "rgba(56, 189, 248, 0.18)");
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(0, 0, width, height);

      // Diagonal elmas ışık demetleri
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.moveTo(120, 0);
      ctx.lineTo(420, height);
      ctx.moveTo(460, 0);
      ctx.lineTo(760, height);
      ctx.stroke();

      // Elmas parıltı noktaları
      const sparkles = [
        [140, 170],
        [620, 210],
        [190, 510],
        [580, 560],
        [380, 130],
      ];
      sparkles.forEach(([sx, sy]) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    } else if (tier.key === "gold") {
      ctx.save();
      drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 42);
      ctx.clip();
      const goldGrad = ctx.createRadialGradient(
        width * 0.5,
        260,
        20,
        width * 0.5,
        260,
        420
      );
      goldGrad.addColorStop(0, "rgba(254, 249, 195, 0.35)");
      goldGrad.addColorStop(1, "rgba(254, 249, 195, 0)");
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Üst sol OVR & Mevki
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 84px sans-serif";
    ctx.fillText(String(ovr), 92, 145);

    ctx.font = "800 28px sans-serif";
    ctx.fillStyle = tier.canvasAccent;
    ctx.fillText(
      (player.position || "FORVET").toLocaleUpperCase("tr-TR"),
      94,
      188
    );

    // Üst sağ Yaş Grubu & Kulüp
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px sans-serif";
    ctx.fillText(player.age_group || "U11", width - 92, 122);

    ctx.font = "700 20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("ÇORUM İKBALSPOR", width - 92, 158);
    ctx.textAlign = "left";

    // Orta Avatar Dairesi
    const centerX = width / 2;
    const avatarY = 340;
    const avatarR = 92;

    if (player.photo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("img load failed"));
          img.src = player.photo_url || "";
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          img,
          centerX - avatarR,
          avatarY - avatarR,
          avatarR * 2,
          avatarR * 2
        );
        ctx.restore();
      } catch {
        ctx.fillStyle = "#b91c1c";
        ctx.beginPath();
        ctx.arc(centerX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 76px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          (player.full_name || "İ").trim().charAt(0).toUpperCase(),
          centerX,
          avatarY + 26
        );
        ctx.textAlign = "left";
      }
    } else {
      ctx.fillStyle = "#b91c1c";
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 76px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        (player.full_name || "İ").trim().charAt(0).toUpperCase(),
        centerX,
        avatarY + 26
      );
      ctx.textAlign = "left";
    }

    // Rozet / Başlık
    const cleanTitle = (cardTitle || "Gol Makinesi").trim();
    ctx.textAlign = "center";
    drawRoundedRect(ctx, centerX - 180, 456, 360, 46, 23);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 22px sans-serif";
    ctx.fillText(`★ ${cleanTitle}`, centerX, 487);

    // İsim ve Motto
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 46px sans-serif";
    ctx.fillText(player.full_name, centerX, 558);

    const cleanMotto = (cardMotto || "Sahada her şey takım için!").trim();
    ctx.fillStyle = tier.canvasAccent;
    ctx.font = "italic 700 25px sans-serif";
    ctx.fillText(`"${cleanMotto}"`, centerX, 604);

    // İstatistik Kutusu
    drawRoundedRect(ctx, 88, 650, width - 176, 230, 32);
    ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
    ctx.fill();

    const statsGrid = [
      { label: "HIZ", val: pace, x: 205, y: 730 },
      { label: "ŞUT", val: shooting, x: 380, y: 730 },
      { label: "PAS", val: passing, x: 555, y: 730 },
      { label: "DRİ", val: dribbling, x: 205, y: 825 },
      { label: "DEF", val: defending, x: 380, y: 825 },
      { label: "FİZ", val: physical, x: 555, y: 825 },
    ];

    statsGrid.forEach((st) => {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "800 22px sans-serif";
      ctx.fillText(st.label, st.x - 28, st.y);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 32px sans-serif";
      ctx.fillText(String(st.val), st.x + 32, st.y + 1);
    });

    // Alt Kademe Etiketi
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "800 20px sans-serif";
    ctx.fillText(`${tier.label.toUpperCase()} • ikbalspor.com`, centerX, 945);
    ctx.textAlign = "left";

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  async function handleShareCard() {
    setSharing(true);
    setStatusMsg(null);

    try {
      const blob = await buildCardPngBlob();
      if (!blob) {
        setStatusMsg({
          ok: false,
          text: "Kart görseli oluşturulamadı.",
        });
        setSharing(false);
        return;
      }

      const safeSlug = (player.full_name || "sporcu")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
      const fileName = `ikbalspor-kart-${safeSlug || "oyuncu"}-${ovr}ovr.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Mobil / WebView / destekleyen tarayıcılarda yerel paylaşım (WhatsApp, Instagram vb.)
      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (
        typeof navWithShare.share === "function" &&
        (!navWithShare.canShare || navWithShare.canShare({ files: [file] }))
      ) {
        await navWithShare.share({
          title: `${player.full_name} • ${ovr} OVR Futbolcu Kartı`,
          text: `${player.full_name} (${ovr} OVR • ${tier.label}) — Çorum İkbalspor Futbolcu Kartı`,
          files: [file],
        });
        setStatusMsg({
          ok: true,
          text: "Kart görseli paylaşım penceresine gönderildi.",
        });
      } else {
        // Masaüstü veya share desteklemeyen tarayıcılarda PNG indir
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        setStatusMsg({
          ok: true,
          text: "Kart PNG olarak indirildi. WhatsApp veya Instagram'a bu görseli yükleyerek paylaşabilirsin.",
        });
      }

      // React Native / Expo WebView köprüsü varsa base64 görsel bilgisini ilet
      const winWithBridge = window as unknown as {
        ReactNativeWebView?: { postMessage?: (msg: string) => void };
      };
      if (winWithBridge.ReactNativeWebView?.postMessage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          winWithBridge.ReactNativeWebView?.postMessage?.(
            JSON.stringify({
              type: "SHARE_PLAYER_CARD",
              fileName,
              playerName: player.full_name,
              ovr,
              tier: tier.key,
              dataUrl: reader.result,
            })
          );
        };
        reader.readAsDataURL(blob);
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Paylaşım iptal edildi."
          : "Kart paylaşılırken bir sorun oluştu.";
      setStatusMsg({
        ok: err instanceof Error && err.name === "AbortError",
        text: msg,
      });
    } finally {
      setSharing(false);
    }
  }

  const initials = (player.full_name || "İ")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-xs space-y-5 text-[var(--text-primary)] tabular-nums">
      <style>{`
        @keyframes ikbalShimmer {
          0% { transform: translateX(-140%) skewX(-22deg); }
          100% { transform: translateX(240%) skewX(-22deg); }
        }
        @keyframes ikbalDiamondPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(34, 211, 238, 0.55)); }
          50% { filter: drop-shadow(0 0 26px rgba(232, 121, 249, 0.8)); }
        }
        .ikbal-shimmer-sweep {
          animation: ikbalShimmer 3.2s infinite ease-in-out;
        }
        .ikbal-diamond-aura {
          animation: ikbalDiamondPulse 2.4s infinite ease-in-out;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
            Futbolcu Kartım &amp; Yetenekler
          </h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
              tier.key === "diamond"
                ? "bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-white"
                : tier.key === "gold"
                ? "bg-amber-400 text-slate-950"
                : tier.key === "silver"
                ? "bg-slate-300 text-slate-900"
                : "bg-amber-800 text-amber-100"
            }`}
          >
            {tier.label}
          </span>
        </div>
        <span className="px-3.5 py-1 rounded-full bg-[var(--brand-navy)] text-white text-xs font-black">
          Puan: {availablePoints}
        </span>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        0-50 {tier.label} • 0-50 Bronze • 50-70 Silver • 70-90 Gold • 90+ Diamond
      </p>

      {/* Efektli Futbolcu Kartı */}
      <div className="flex justify-center">
        <div
          ref={cardRef}
          className={`relative overflow-hidden w-full max-w-sm rounded-3xl bg-gradient-to-b ${
            tier.cardBg
          } text-white border-2 ${tier.borderColor} ${tier.outerGlow} ${
            tier.key === "diamond" ? "ikbal-diamond-aura" : ""
          } p-6 transition-all duration-300 space-y-4`}
        >
          {/* Seviyeye Özel Efekt Katmanları */}
          {tier.key === "diamond" && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-16 bg-[conic-gradient(from_90deg_at_50%_50%,rgba(34,211,238,0.28),rgba(232,121,249,0.28),rgba(250,204,21,0.22),rgba(56,189,248,0.28))] animate-spin [animation-duration:10s]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45)_0,transparent_22%),radial-gradient(circle_at_80%_30%,rgba(103,232,249,0.5)_0,transparent_25%),radial-gradient(circle_at_50%_80%,rgba(244,114,182,0.4)_0,transparent_28%)]"
              />
            </>
          )}

          {(tier.key === "diamond" ||
            tier.key === "gold" ||
            tier.key === "silver") && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent ikbal-shimmer-sweep"
            />
          )}

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="text-3xl font-black leading-none">{ovr}</div>
              <div className="text-xs font-extrabold uppercase tracking-wider mt-1 opacity-90">
                {player.position || "FORVET"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black tracking-wide">
                {player.age_group || "U11"}
              </div>
              {tier.key === "diamond" && (
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200 mt-0.5">
                  ✦ DIAMOND PRISM ✦
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-2.5">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/80 bg-white shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--brand-red)] border-2 border-white/70 flex items-center justify-center text-3xl font-black text-white shadow-md">
                {initials}
              </div>
            )}

            <span className="inline-block px-3.5 py-1 rounded-full bg-white text-slate-950 text-xs font-black shadow-sm">
              ★ {cardTitle || "Gol Makinesi"}
            </span>

            <div>
              <div className="text-xl font-black tracking-tight">
                {player.full_name}
              </div>
              <p className={`text-xs italic mt-0.5 ${tier.accentText}`}>
                &ldquo;{cardMotto || "Sahada her şey takım için!"}&rdquo;
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-3 border-t border-white/25 bg-black/20 rounded-2xl p-3 grid grid-cols-3 gap-y-2.5 gap-x-2 text-center text-xs font-black">
            <div>
              <span className="opacity-80">HIZ </span>
              <span className="text-sm">{pace}</span>
            </div>
            <div>
              <span className="opacity-80">ŞUT </span>
              <span className="text-sm">{shooting}</span>
            </div>
            <div>
              <span className="opacity-80">PAS </span>
              <span className="text-sm">{passing}</span>
            </div>
            <div>
              <span className="opacity-80">DRİ </span>
              <span className="text-sm">{dribbling}</span>
            </div>
            <div>
              <span className="opacity-80">DEF </span>
              <span className="text-sm">{defending}</span>
            </div>
            <div>
              <span className="opacity-80">FİZ </span>
              <span className="text-sm">{physical}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Puan Harca */}
      <div className="space-y-2.5">
        <div className="text-xs font-black text-[var(--text-primary)]">
          Puan Harca (Kalan Puan: {availablePoints})
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSpendPoint("pace")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Hız
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("shooting")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Şut
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("passing")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Pas
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("dribbling")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Dripling
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("defending")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Defans
          </button>
          <button
            type="button"
            onClick={() => handleSpendPoint("physical")}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:opacity-90 border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] cursor-pointer"
          >
            +1 Fizik
          </button>
        </div>
      </div>

      {/* Başlık ve Motto Alanları */}
      <div className="space-y-3">
        <input
          type="text"
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
          placeholder="Kart başlığı (Örn: Gol Makinesi)"
          className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]"
        />

        <input
          type="text"
          value={cardMotto}
          onChange={(e) => setCardMotto(e.target.value)}
          placeholder="Kart mottosu (Örn: Her maç final!)"
          className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"
        />
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold ${
            statusMsg.ok
              ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveCard()}
          className="w-full py-3.5 rounded-2xl bg-[var(--brand-navy)] hover:opacity-95 text-white text-sm font-black cursor-pointer disabled:opacity-50 transition"
        >
          {saving ? "Kaydediliyor..." : "Kartımı Kaydet"}
        </button>

        <button
          type="button"
          disabled={sharing}
          onClick={() => void handleShareCard()}
          className="w-full py-3.5 rounded-2xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-sm font-black cursor-pointer disabled:opacity-50 transition"
        >
          {sharing ? "Görsel Hazırlanıyor..." : "Kartı Görsel Olarak Paylaş"}
        </button>
      </div>
    </section>
  );
}