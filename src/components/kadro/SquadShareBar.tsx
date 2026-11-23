"use client";

import React, { useState } from "react";

export interface ShareSlotItem {
  slotKey: string;
  role: string;
  player: {
    id: string;
    full_name: string;
    position?: string | null;
    jersey_number?: number | null;
  } | null;
}

export interface ShareBenchItem {
  id: string;
  full_name: string;
  position?: string | null;
  jersey_number?: number | null;
}

interface SquadShareBarProps {
  categoryLabel: string;
  formationLabel: string;
  formationRows: { role: string; count: number }[];
  tacticPlan: string;
  slots: ShareSlotItem[];
  benchPlayers: ShareBenchItem[];
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

function loadClubLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });
}

async function renderRosterCardPng(props: SquadShareBarProps): Promise<string> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b2545");
  bg.addColorStop(0.55, "#0f172a");
  bg.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const logo = await loadClubLogo();
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, 64, 56, 108, 108, 22);
  ctx.fill();
  if (logo) {
    ctx.save();
    drawRoundedRect(ctx, 70, 62, 96, 96, 18);
    ctx.clip();
    ctx.drawImage(logo, 70, 62, 96, 96);
    ctx.restore();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 44px system-ui, -apple-system, sans-serif";
  ctx.fillText("ÇORUM İKBAL SPOR KULÜBÜ", 198, 108);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "800 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${props.categoryLabel} • Diziliş: ${props.formationLabel}`, 198, 150);

  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 64, 196, W - 128, 86, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Oyun Planı: ${props.tacticPlan}`, 92, 248);

  const allAssigned = [
    ...props.slots
      .filter((s) => s.player)
      .map((s) => ({
        name: s.player!.full_name,
        num: s.player!.jersey_number,
        pos: s.role || s.player!.position || "Oyuncu",
      })),
    ...props.benchPlayers.map((b) => ({
      name: b.full_name,
      num: b.jersey_number,
      pos: `${b.position || "Yedek"} (Yedek)`,
    })),
  ];

  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  drawRoundedRect(ctx, 64, 312, W - 128, H - 410, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(`KADRO LİSTESİ (${allAssigned.length} Oyuncu)`, 96, 366);

  const maxRows = Math.min(allAssigned.length, 21);
  const rowH = maxRows > 14 ? 38 : 48;
  for (let i = 0; i < maxRows; i++) {
    const item = allAssigned[i];
    const y = 392 + i * (rowH + 6);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    drawRoundedRect(ctx, 92, y, W - 184, rowH, 12);
    ctx.fill();

    ctx.fillStyle = "#fda4af";
    ctx.font = `900 ${maxRows > 14 ? 20 : 23}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(item.num ? `#${item.num}` : `#${i + 1}`, 112, y + rowH * 0.68);

    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${maxRows > 14 ? 21 : 24}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(item.name, 195, y + rowH * 0.68);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 ${maxRows > 14 ? 18 : 21}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(item.pos, W - 114, y + rowH * 0.68);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 21px system-ui, -apple-system, sans-serif";
  ctx.fillText("ikbalspor.com • Çorum İkbal Spor Kulübü Resmi Kadro Kartı", 64, H - 40);

  return canvas.toDataURL("image/png");
}

async function renderPitchCardPng(props: SquadShareBarProps): Promise<string> {
  const W = 1080;
  const H = 1420;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const hdr = ctx.createLinearGradient(0, 0, W, 170);
  hdr.addColorStop(0, "#0b2545");
  hdr.addColorStop(1, "#b91c1c");
  ctx.fillStyle = hdr;
  ctx.fillRect(0, 0, W, 170);

  const logo = await loadClubLogo();
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, 48, 32, 96, 96, 20);
  ctx.fill();
  if (logo) {
    ctx.save();
    drawRoundedRect(ctx, 54, 38, 84, 84, 16);
    ctx.clip();
    ctx.drawImage(logo, 54, 38, 84, 84);
    ctx.restore();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("ÇORUM İKBAL SPOR KULÜBÜ", 168, 76);
  ctx.fillStyle = "#fde68a";
  ctx.font = "800 24px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${props.categoryLabel} • ${props.formationLabel} • ${props.tacticPlan}`, 168, 114);

  const pitchTop = 170;
  const pitchH = 1060;
  const stripeCount = 10;
  const stripeH = pitchH / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#15803d" : "#166534";
    ctx.fillRect(0, pitchTop + i * stripeH, W, stripeH + 1);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 4;
  ctx.strokeRect(44, pitchTop + 28, W - 88, pitchH - 56);
  ctx.beginPath();
  ctx.moveTo(44, pitchTop + pitchH / 2);
  ctx.lineTo(W - 44, pitchTop + pitchH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, pitchTop + pitchH / 2, 105, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeRect(W / 2 - 210, pitchTop + 28, 420, 145);
  ctx.strokeRect(W / 2 - 210, pitchTop + pitchH - 28 - 145, 420, 145);

  let cursor = 0;
  const rows = props.formationRows;
  const rowStep = (pitchH - 170) / Math.max(1, rows.length - 1);

  rows.forEach((row, rIdx) => {
    const cy = pitchTop + 95 + rIdx * rowStep;
    const count = row.count;
    for (let c = 0; c < count; c++) {
      const slot = props.slots[cursor++];
      const cx = ((c + 1) / (count + 1)) * (W - 120) + 60;
      const cardW = count >= 5 ? 168 : 196;
      const cardH = 108;
      const x = cx - cardW / 2;
      const y = cy - cardH / 2;

      const assigned = slot?.player;
      ctx.fillStyle = assigned ? "rgba(11, 37, 69, 0.94)" : "rgba(15, 23, 42, 0.45)";
      ctx.strokeStyle = assigned ? "#fbbf24" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = assigned ? 3 : 2;
      drawRoundedRect(ctx, x, y, cardW, cardH, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = assigned ? "#b91c1c" : "rgba(255,255,255,0.2)";
      drawRoundedRect(ctx, cx - 26, y + 10, 52, 28, 10);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "900 17px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        assigned?.jersey_number ? `#${assigned.jersey_number}` : row.role.slice(0, 3).toUpperCase(),
        cx,
        y + 30
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 20px system-ui, -apple-system, sans-serif";
      const label = assigned ? assigned.full_name.split(" ").slice(0, 2).join(" ") : "Boş";
      ctx.fillText(label.slice(0, 14), cx, y + 68);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "700 15px system-ui, -apple-system, sans-serif";
      ctx.fillText(row.role, cx, y + 92);
      ctx.textAlign = "left";
    }
  });

  ctx.fillStyle = "#0b2545";
  ctx.fillRect(0, pitchTop + pitchH, W, H - (pitchTop + pitchH));
  ctx.fillStyle = "#fbbf24";
  ctx.font = "900 22px system-ui, -apple-system, sans-serif";
  const benchText =
    props.benchPlayers.length > 0
      ? props.benchPlayers
          .map((b) => `${b.jersey_number ? `#${b.jersey_number} ` : ""}${b.full_name}`)
          .join("  •  ")
      : "Yedek kulübesi boş";
  ctx.fillText("YEDEKLER:", 48, pitchTop + pitchH + 56);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(benchText.slice(0, 82), 190, pitchTop + pitchH + 56);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 19px system-ui, -apple-system, sans-serif";
  ctx.fillText("ikbalspor.com • Çorum İkbal Spor Kulübü Taktik Kadro", 48, H - 36);

  return canvas.toDataURL("image/png");
}

export function SquadShareBar(props: SquadShareBarProps) {
  const [busyMode, setBusyMode] = useState<"roster" | "pitch" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  async function generateAndShare(mode: "roster" | "pitch") {
    setBusyMode(mode);
    try {
      const dataUrl =
        mode === "roster"
          ? await renderRosterCardPng(props)
          : await renderPitchCardPng(props);
      setPreviewUrl(dataUrl);
      setPreviewTitle(
        mode === "roster" ? "Resmi Kadro Listesi Kartı" : "Çim Saha Taktik Dizilişi"
      );

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `ikbal-spor-kadro-${mode}.png`, {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Çorum İkbal Spor Kulübü Kadrosu",
            files: [file],
          });
        }
      }
    } catch {
      // paylaşım iptal edilirse önizleme açık kalır
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div>
        <div className="text-xs font-black text-[var(--text-primary)]">
          Görsel Kadro Paylaşımı
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">
          Liste kartı veya çim saha dizilişi olarak PNG indirip paylaşabilirsiniz.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busyMode !== null}
          onClick={() => void generateAndShare("roster")}
          className="px-4 py-2 rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-black transition cursor-pointer disabled:opacity-50"
        >
          {busyMode === "roster" ? "Hazırlanıyor..." : "Paylaş: Kadro Listesi"}
        </button>
        <button
          type="button"
          disabled={busyMode !== null}
          onClick={() => void generateAndShare("pitch")}
          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition cursor-pointer disabled:opacity-50"
        >
          {busyMode === "pitch" ? "Hazırlanıyor..." : "Paylaş: Çim Saha Dizilişi"}
        </button>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[var(--text-primary)]">
                {previewTitle}
              </span>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="text-xs font-black text-[var(--brand-red)] cursor-pointer"
              >
                Kapat
              </button>
            </div>
            <img
              src={previewUrl}
              alt={previewTitle}
              className="w-full rounded-2xl border border-[var(--border-subtle)]"
            />
            <a
              href={previewUrl}
              download={`ikbal-spor-${previewTitle.toLowerCase().replace(/\s+/g, "-")}.png`}
              className="block w-full text-center py-2.5 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-black"
            >
              PNG Olarak İndir
            </a>
          </div>
        </div>
      )}
    </div>
  );
}