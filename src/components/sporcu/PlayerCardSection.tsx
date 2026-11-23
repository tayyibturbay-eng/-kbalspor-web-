"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Player } from "@/types/club";

const supabase = createClient();

interface PlayerCardSectionProps {
  player: Player;
  onPlayerUpdated?: (updated: Player) => void;
  onFeedback?: (msg: string) => void;
}

type CardTierKey = "iron" | "bronze" | "silver" | "gold" | "diamond";

type CardTier = {
  key: CardTierKey;
  label: string;
  badgeText: string;
  cardBg: string;
  frameBorder: string;
  accentText: string;
  outerGlow: string;
  statBarColor: string;
  canvasColors: [string, string, string];
  canvasAccent: string;
};

interface SavedCardPayload {
  skill_points: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  card_title: string;
  card_motto: string;
}

function getCardTier(ovr: number): CardTier {
  if (ovr >= 90) {
    return {
      key: "diamond",
      label: "Diamond Kart",
      badgeText: "90+ Diamond",
      cardBg: "from-cyan-500 via-blue-700 to-fuchsia-900",
      frameBorder: "border-cyan-200",
      accentText: "text-cyan-100",
      outerGlow:
        "shadow-[0_0_42px_rgba(34,211,238,0.7),0_0_80px_rgba(217,70,239,0.45)]",
      statBarColor: "from-cyan-300 via-sky-400 to-fuchsia-400",
      canvasColors: ["#06b6d4", "#1d4ed8", "#701a75"],
      canvasAccent: "#67e8f9",
    };
  }
  if (ovr >= 70) {
    return {
      key: "gold",
      label: "Gold Kart",
      badgeText: "70-89 Gold",
      cardBg: "from-amber-300 via-yellow-600 to-amber-950",
      frameBorder: "border-yellow-200",
      accentText: "text-amber-100",
      outerGlow: "shadow-[0_0_30px_rgba(250,204,21,0.5)]",
      statBarColor: "from-yellow-300 to-amber-500",
      canvasColors: ["#fcd34d", "#d97706", "#451a03"],
      canvasAccent: "#fef08a",
    };
  }
  if (ovr >= 50) {
    return {
      key: "silver",
      label: "Silver Kart",
      badgeText: "50-69 Silver",
      cardBg: "from-slate-200 via-slate-600 to-slate-950",
      frameBorder: "border-slate-100",
      accentText: "text-slate-100",
      outerGlow: "shadow-[0_0_24px_rgba(226,232,240,0.4)]",
      statBarColor: "from-slate-200 to-sky-400",
      canvasColors: ["#e2e8f0", "#475569", "#020617"],
      canvasAccent: "#f1f5f9",
    };
  }
  if (ovr >= 30) {
    return {
      key: "bronze",
      label: "Bronze Kart",
      badgeText: "30-49 Bronze",
      cardBg: "from-amber-700 via-[#8b3a17] to-stone-950",
      frameBorder: "border-amber-400/75",
      accentText: "text-amber-200",
      outerGlow: "shadow-[0_0_20px_rgba(180,83,9,0.38)]",
      statBarColor: "from-amber-400 to-orange-600",
      canvasColors: ["#b45309", "#8b3a17", "#0c0a09"],
      canvasAccent: "#fdba74",
    };
  }
  return {
    key: "iron",
    label: "Iron Kart",
    badgeText: "0-29 Iron",
    cardBg: "from-zinc-600 via-slate-800 to-zinc-950",
    frameBorder: "border-zinc-400/70",
    accentText: "text-zinc-200",
    outerGlow: "shadow-[0_0_16px_rgba(161,161,170,0.28)]",
    statBarColor: "from-zinc-300 to-slate-500",
    canvasColors: ["#52525b", "#1e293b", "#09090b"],
    canvasAccent: "#d4d4d8",
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
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>(
    "ikbalspor-kart.png"
  );
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAvailablePoints(Number(playerExt.skill_points ?? 0));
  }, [playerExt.skill_points]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(`ikbal_player_card_${player.id}`);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<SavedCardPayload>;
        if (typeof saved.pace === "number") setPace(saved.pace);
        if (typeof saved.shooting === "number") setShooting(saved.shooting);
        if (typeof saved.passing === "number") setPassing(saved.passing);
        if (typeof saved.dribbling === "number") setDribbling(saved.dribbling);
        if (typeof saved.defending === "number") setDefending(saved.defending);
        if (typeof saved.physical === "number") setPhysical(saved.physical);
        if (typeof saved.card_title === "string" && saved.card_title.trim())
          setCardTitle(saved.card_title);
        if (typeof saved.card_motto === "string" && saved.card_motto.trim())
          setCardMotto(saved.card_motto);
      } catch {
        // yoksay
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [player.id]);

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

    const payload: SavedCardPayload = {
      skill_points: availablePoints,
      pace,
      shooting,
      passing,
      dribbling,
      defending,
      physical,
      card_title: cleanTitle,
      card_motto: cleanMotto,
    };

    try {
      localStorage.setItem(
        `ikbal_player_card_${player.id}`,
        JSON.stringify(payload)
      );
    } catch {
      // yoksay
    }

    const { error } = await supabase
      .from("players")
      .update(payload)
      .eq("id", player.id);

    setSaving(false);

    if (error) {
      const schemaMissing =
        error.message.includes("schema cache") ||
        error.message.includes("column") ||
        error.message.includes("does not exist");

      if (schemaMissing) {
        const fallbackMsg =
          "Kartınız cihazınızda kaydedildi (Supabase players tablosuna yetenek/kart sütunları eklendiğinde bulutla da eşitlenecek).";
        setStatusMsg({ ok: true, text: fallbackMsg });
        onFeedback?.(fallbackMsg);
        onPlayerUpdated?.({
          ...player,
          ...(payload as Partial<Player>),
        });
        return;
      }

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
      ...(payload as Partial<Player>),
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

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, tier.canvasColors[0]);
    grad.addColorStop(0.55, tier.canvasColors[1]);
    grad.addColorStop(1, tier.canvasColors[2]);

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 44);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = tier.key === "diamond" ? 10 : 6;
    ctx.strokeStyle = tier.canvasAccent;
    ctx.stroke();

    if (tier.key === "diamond") {
      ctx.save();
      drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 38);
      ctx.clip();

      const prism = ctx.createLinearGradient(0, 0, width, height);
      prism.addColorStop(0, "rgba(103, 232, 249, 0.35)");
      prism.addColorStop(0.5, "rgba(255, 255, 255, 0.28)");
      prism.addColorStop(1, "rgba(232, 121, 249, 0.35)");
      ctx.fillStyle = prism;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.moveTo(110, 0);
      ctx.lineTo(430, height);
      ctx.moveTo(450, 0);
      ctx.lineTo(760, height);
      ctx.stroke();

      const sparkles = [
        [150, 175],
        [610, 210],
        [200, 520],
        [570, 550],
        [380, 130],
      ];
      sparkles.forEach(([sx, sy]) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 82px sans-serif";
    ctx.fillText(String(ovr), 90, 142);

    ctx.font = "800 28px sans-serif";
    ctx.fillStyle = tier.canvasAccent;
    ctx.fillText(
      (player.position || "FORVET").toLocaleUpperCase("tr-TR"),
      92,
      184
    );

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px sans-serif";
    ctx.fillText(player.age_group || "U11", width - 90, 120);

    ctx.font = "800 20px sans-serif";
    ctx.fillStyle = tier.canvasAccent;
    ctx.fillText(tier.label.toUpperCase(), width - 90, 156);
    ctx.textAlign = "left";

    const centerX = width / 2;
    const avatarY = 335;
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

    const cleanTitle = (cardTitle || "Gol Makinesi").trim();
    ctx.textAlign = "center";
    drawRoundedRect(ctx, centerX - 180, 450, 360, 46, 23);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 22px sans-serif";
    ctx.fillText(`★ ${cleanTitle}`, centerX, 481);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 46px sans-serif";
    ctx.fillText(player.full_name, centerX, 552);

    const cleanMotto = (cardMotto || "Sahada her şey takım için!").trim();
    ctx.fillStyle = tier.canvasAccent;
    ctx.font = "italic 700 25px sans-serif";
    ctx.fillText(`"${cleanMotto}"`, centerX, 598);

    drawRoundedRect(ctx, 88, 642, width - 176, 240, 32);
    ctx.fillStyle = "rgba(9, 13, 22, 0.52)";
    ctx.fill();

    const statsGrid = [
      { label: "HIZ", val: pace, x: 205, y: 722 },
      { label: "ŞUT", val: shooting, x: 380, y: 722 },
      { label: "PAS", val: passing, x: 555, y: 722 },
      { label: "DRİ", val: dribbling, x: 205, y: 822 },
      { label: "DEF", val: defending, x: 380, y: 822 },
      { label: "FİZ", val: physical, x: 555, y: 822 },
    ];

    statsGrid.forEach((st) => {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "800 22px sans-serif";
      ctx.fillText(st.label, st.x - 32, st.y);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 32px sans-serif";
      ctx.fillText(String(st.val), st.x + 28, st.y + 1);
    });

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 20px sans-serif";
    ctx.fillText(`ÇORUM İKBAL SPOR KULÜBÜ • ${tier.label.toUpperCase()}`, centerX, 945);
    ctx.textAlign = "left";

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  function triggerDownload(dataUrl: string, fileName: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
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

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      });

      setPreviewDataUrl(dataUrl);
      setDownloadFileName(fileName);

      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      let nativeShared = false;
      if (
        typeof navWithShare.share === "function" &&
        (!navWithShare.canShare || navWithShare.canShare({ files: [file] }))
      ) {
        try {
          await navWithShare.share({
            title: `${player.full_name} • ${ovr} OVR Futbolcu Kartı`,
            text: `${player.full_name} (${ovr} OVR • ${tier.label}) — Çorum İkbal Spor Kulübü Futbolcu Kartı`,
            files: [file],
          });
          nativeShared = true;
          setStatusMsg({
            ok: true,
            text: "Kart görseli paylaşım ekranına gönderildi.",
          });
        } catch (shareErr) {
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            setStatusMsg({ ok: true, text: "Paylaşım iptal edildi." });
            nativeShared = true;
          }
        }
      }

      if (!nativeShared) {
        triggerDownload(dataUrl, fileName);
        setShareModalOpen(true);
        setStatusMsg({
          ok: true,
          text: "Kart görseli indirildi ve paylaşım ekranı açıldı.",
        });
      }

      const winWithBridge = window as unknown as {
        ReactNativeWebView?: { postMessage?: (msg: string) => void };
      };
      if (winWithBridge.ReactNativeWebView?.postMessage) {
        winWithBridge.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SHARE_PLAYER_CARD",
            fileName,
            playerName: player.full_name,
            ovr,
            tier: tier.key,
            dataUrl,
          })
        );
      }
    } catch {
      setStatusMsg({
        ok: false,
        text: "Kart paylaşılırken bir sorun oluştu.",
      });
    } finally {
      setSharing(false);
    }
  }

  const initials = (player.full_name || "İ")
    .trim()
    .charAt(0)
    .toUpperCase();

  const shareText = encodeURIComponent(
    `${player.full_name} • ${ovr} OVR (${tier.label}) — Çorum İkbal Spor Kulübü Futbolcu Kartı https://ikbalspor.com/sporcu`
  );

  const statsList = [
    { label: "HIZ", val: pace },
    { label: "ŞUT", val: shooting },
    { label: "PAS", val: passing },
    { label: "DRİ", val: dribbling },
    { label: "DEF", val: defending },
    { label: "FİZ", val: physical },
  ];

  return (
    <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-xs space-y-5 text-[var(--text-primary)] tabular-nums">
      <style>{`
        @keyframes goleySweep {
          0% { transform: translateX(-160%) skewX(-24deg); opacity: 0.1; }
          45% { opacity: 0.65; }
          100% { transform: translateX(260%) skewX(-24deg); opacity: 0.1; }
        }
        @keyframes goleyDiamondSpin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes goleySparkle {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        .goley-sweep-anim {
          animation: goleySweep 2.6s infinite ease-in-out;
        }
        .goley-diamond-wheel {
          animation: goleyDiamondSpin 8s linear infinite;
        }
        .goley-sparkle-dot {
          animation: goleySparkle 1.8s infinite ease-in-out;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
            Futbolcu Kartım &amp; Yetenekler
          </h2>
          <span
            className={`px-3 py-0.5 rounded-full text-[11px] font-black ${
              tier.key === "diamond"
                ? "bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 text-slate-950 shadow-sm"
                : tier.key === "gold"
                ? "bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950"
                : tier.key === "silver"
                ? "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950"
                : tier.key === "bronze" ? "bg-amber-800 text-amber-100" : "bg-zinc-700 text-zinc-100"
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
        0-29 Iron • 30-49 Bronze • 50-69 Silver • 70-89 Gold • 90+ Diamond (Seviye arttıkça
        kart ışığı ve efekti güçlenir)
      </p>

      <div className="flex justify-center">
        <div
          ref={cardRef}
          className={`relative overflow-hidden w-full max-w-[360px] rounded-[28px] bg-gradient-to-b ${
            tier.cardBg
          } text-white border-[3px] ${tier.frameBorder} ${
            tier.outerGlow
          } p-5 transition-all duration-300 space-y-4`}
        >
          {tier.key === "diamond" && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-24 bg-[conic-gradient(from_0deg,rgba(103,232,249,0.45),rgba(232,121,249,0.45),rgba(250,204,21,0.35),rgba(56,189,248,0.45),rgba(103,232,249,0.45))] goley-diamond-wheel opacity-80"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.65)_0,transparent_22%),radial-gradient(circle_at_82%_26%,rgba(103,232,249,0.65)_0,transparent_26%),radial-gradient(circle_at_50%_75%,rgba(244,114,182,0.55)_0,transparent_30%)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-7 right-20 w-2.5 h-2.5 rounded-full bg-white goley-sparkle-dot"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-32 left-10 w-2 h-2 rounded-full bg-cyan-200 goley-sparkle-dot"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-32 right-9 w-2.5 h-2.5 rounded-full bg-fuchsia-200 goley-sparkle-dot"
              />
            </>
          )}

          {tier.key === "gold" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(254,249,195,0.5)_0,transparent_48%)]"
            />
          )}

          {tier.key === "iron" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(125deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_2px,transparent_2px,transparent_10px)]"
            />
          )}

          {tier.key === "bronze" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,146,60,0.35)_0,transparent_48%)]"
            />
          )}

          {tier.key === "silver" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.25)_0%,transparent_45%,rgba(125,211,252,0.2)_100%)]"
            />
          )}

          {(tier.key === "diamond" ||
            tier.key === "gold" ||
            tier.key === "silver") && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent goley-sweep-anim"
            />
          )}

          <div className="relative z-10 flex items-start justify-between bg-slate-950/35 backdrop-blur-xs rounded-2xl px-3.5 py-2.5 border border-white/20">
            <div>
              <div className="text-3xl font-black leading-none tracking-tight">
                {ovr}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider mt-1 text-amber-200">
                {player.position || "FORVET"}
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-2.5 py-0.5 rounded-lg bg-white/15 text-xs font-black">
                {player.age_group || "U11"}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest mt-1 text-white/90">
                {tier.key === "diamond"
                  ? "✦ EFSANE ELMAS ✦"
                  : tier.key === "gold"
                  ? "★ ALTIN SERİ ★"
                  : tier.key === "silver"
                  ? "◆ GÜMÜŞ SERİ ◆"
                  : "• BRONZ SERİ •"}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-2 py-1">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-lg bg-slate-900"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--brand-red)] to-rose-900 border-2 border-white flex items-center justify-center text-4xl font-black text-white shadow-lg">
                {initials}
              </div>
            )}

            <span className="inline-block px-3.5 py-1 rounded-full bg-white text-slate-950 text-xs font-black shadow-sm">
              ★ {cardTitle || "Gol Makinesi"}
            </span>

            <div className="bg-slate-950/45 rounded-2xl px-3.5 py-2 w-full border border-white/15">
              <div className="text-lg font-black tracking-tight leading-snug">
                {player.full_name}
              </div>
              <p className={`text-[11px] italic mt-0.5 ${tier.accentText}`}>
                &ldquo;{cardMotto || "Sahada her şey takım için!"}&rdquo;
              </p>
            </div>
          </div>

          <div className="relative z-10 bg-slate-950/60 backdrop-blur-xs rounded-2xl p-3 border border-white/20 grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-black">
            {statsList.map((st) => {
              const pct = Math.max(8, Math.min(100, st.val));
              return (
                <div key={st.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/85">{st.label}</span>
                    <span className="text-white font-black">{st.val}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tier.statBarColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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

      {shareModalOpen && previewDataUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Kartı Paylaş
              </h3>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-xs font-extrabold cursor-pointer"
              >
                Kapat
              </button>
            </div>

            <img
              src={previewDataUrl}
              alt="Paylaşılacak futbolcu kartı"
              className="w-full max-h-72 object-contain rounded-2xl border border-[var(--border-subtle)] bg-slate-950"
            />

            <p className="text-xs text-[var(--text-secondary)]">
              Kart PNG görseli indirildi. WhatsApp veya Instagram&apos;a inen
              görseli seçip doğrudan gönderebilirsin.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black text-center"
              >
                WhatsApp&apos;ta Aç
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-700 text-white text-xs font-black text-center"
              >
                Instagram&apos;a Git
              </a>
              <button
                type="button"
                onClick={() => triggerDownload(previewDataUrl, downloadFileName)}
                className="py-2.5 px-3 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-black cursor-pointer"
              >
                PNG İndir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}