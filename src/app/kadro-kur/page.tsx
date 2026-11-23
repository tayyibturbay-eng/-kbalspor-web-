"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import {
  FORMATIONS,
  MAX_SQUAD_PLAYERS,
  MIN_SQUAD_PLAYERS,
  SQUAD_CATEGORIES,
  SquadPlayer,
  TACTIC_PLANS,
  checkPlayerEligibility,
  getCategoryQuotaLimit,
} from "@/lib/squad-rules";
import { PitchBoard } from "@/components/kadro/PitchBoard";

const supabase = createClient();

function resolveDefaultFormationForCategory(category: string): string {
  const lower = category.toLowerCase();
  if (
    lower.includes("minikler") ||
    lower.includes("u11") ||
    lower.includes("u12")
  ) {
    if (FORMATIONS["2-3-1"]) return "2-3-1";
    const firstYouth = Object.entries(FORMATIONS).find(
      ([, v]) => v.group === "altyapi"
    );
    if (firstYouth) return firstYouth[0];
  }
  return FORMATIONS["4-3-3"]
    ? "4-3-3"
    : Object.keys(FORMATIONS)[0] || "4-3-3";
}

function SquadListSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse py-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className="h-16 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-3 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--bg-canvas)] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-[var(--bg-canvas)]" />
            <div className="h-2.5 w-20 rounded bg-[var(--bg-canvas)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SquadBuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState(
    "Çorum Süper Amatör Ligi-U19"
  );
  const [formation, setFormation] = useState(() =>
    resolveDefaultFormationForCategory("Çorum Süper Amatör Ligi-U19")
  );
  const [tacticPlan, setTacticPlan] = useState<string>(TACTIC_PLANS[0]);
  const [tacticNote, setTacticNote] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [allPlayers, setAllPlayers] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Record<string, SquadPlayer | null>>({});
  const [squadNumbers, setSquadNumbers] = useState<
    Record<string, number | "">
  >({});
  const [draggingPlayer, setDraggingPlayer] = useState<SquadPlayer | null>(null);
  const [draggingFromSlot, setDraggingFromSlot] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState("");
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [shareVisualMode, setShareVisualMode] = useState<"card" | "pitch">(
    "card"
  );
  const [pitchImageUrl, setPitchImageUrl] = useState<string | null>(null);

  const squadCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select(
          "id, player_code, full_name, age_group, birth_date, position, jersey_number, photo_url"
        )
        .order("jersey_number", { ascending: true });
      if (!active) return;
      setAllPlayers((data as SquadPlayer[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      `ikbal_squad_${selectedCategory}`,
      JSON.stringify({
        formation,
        slots,
        squadNumbers,
        tacticPlan,
        tacticNote,
      })
    );
  }, [selectedCategory, formation, slots, squadNumbers, tacticPlan, tacticNote]);

  const handleCategoryChange = (cat: string) => {
    setQuotaWarning("");
    setSelectedCategory(cat);
    const defaultForm = resolveDefaultFormationForCategory(cat);

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`ikbal_squad_${cat}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          setFormation(
            parsed.formation && FORMATIONS[parsed.formation]
              ? parsed.formation
              : defaultForm
          );
          setSlots(parsed.slots || {});
          setSquadNumbers(parsed.squadNumbers || {});
          setTacticPlan(parsed.tacticPlan || TACTIC_PLANS[0]);
          setTacticNote(parsed.tacticNote || "");
          return;
        }
      } catch {
        // bozuk taslak varsa yoksay
      }
    }

    setFormation(defaultForm);
    setSlots({});
    setSquadNumbers({});
    setTacticPlan(TACTIC_PLANS[0]);
    setTacticNote("");
  };

  const eligibleList = allPlayers
    .map((p) => ({
      player: p,
      info: checkPlayerEligibility(p, selectedCategory),
    }))
    .filter(
      (x) =>
        x.info.eligible &&
        x.player.full_name.toLowerCase().includes(playerSearch.toLowerCase())
    );

  const currentLineup = Object.values(slots).filter(Boolean) as SquadPlayer[];
  const quotaPlayersInLineup = currentLineup.filter(
    (p) => checkPlayerEligibility(p, selectedCategory).isQuota
  );
  const quotaGkCount = quotaPlayersInLineup.filter(
    (p) => p.position === "Kaleci"
  ).length;
  const quotaOutfieldCount = quotaPlayersInLineup.filter(
    (p) => p.position !== "Kaleci"
  ).length;
  const categoryQuotaLimit = getCategoryQuotaLimit(selectedCategory);

  const getEffectiveNumber = (player: SquadPlayer): number | "" => {
    if (Object.prototype.hasOwnProperty.call(squadNumbers, player.id)) {
      return squadNumbers[player.id];
    }
    return player.jersey_number ?? "";
  };

  const handleSquadNumberChange = (
    playerId: string,
    rawVal: string
  ): boolean => {
    setQuotaWarning("");
    const cleaned = rawVal.replace(/\D/g, "");
    if (cleaned === "") {
      setSquadNumbers((prev) => ({ ...prev, [playerId]: "" }));
      return true;
    }
    const num = Number(cleaned);
    if (isNaN(num) || num < 1 || num > 99) return false;

    const conflict = currentLineup.find(
      (p) => p.id !== playerId && getEffectiveNumber(p) === num
    );
    if (conflict) {
      setQuotaWarning(
        `#${num} forma numarası bu kadroda zaten ${conflict.full_name} adlı oyuncuya verilmiş. Farklı bir numara seçin.`
      );
      return false;
    }

    setSquadNumbers((prev) => ({ ...prev, [playerId]: num }));
    return true;
  };

  const canPlacePlayerIntoSquad = (
    player: SquadPlayer,
    targetSlotKey: string,
    fromSlotKey: string | null
  ): string | null => {
    const info = checkPlayerEligibility(player, selectedCategory);
    if (!info.eligible) {
      return (
        info.reason ||
        `${player.full_name} bu kategorinin yaş kurallarına uygun değil.`
      );
    }

    const alreadyOnPitch = currentLineup.some((p) => p.id === player.id);
    const targetOccupant = slots[targetSlotKey] || null;
    const isReplacingEmpty = !fromSlotKey && !alreadyOnPitch && !targetOccupant;

    if (isReplacingEmpty && currentLineup.length >= MAX_SQUAD_PLAYERS) {
      return `Müsabaka kadrosu en fazla ${MAX_SQUAD_PLAYERS} futbolcudan oluşabilir (Madde 20/1).`;
    }

    if (info.isQuota && !alreadyOnPitch) {
      if (
        [
          "Çorum Süper Amatör Ligi-U13",
          "Çorum Süper Amatör Ligi-U14",
          "Çorum Süper Amatör Ligi-U15",
        ].includes(selectedCategory)
      ) {
        const limit = categoryQuotaLimit ?? 2;
        if (quotaPlayersInLineup.length >= limit) {
          return `${selectedCategory} kategorisinde en fazla ${limit} kontenjan futbolcu kadroda yer alabilir (Madde 18/5–6).`;
        }
      }
      if (selectedCategory === "Çorum Süper Amatör Ligi-U19") {
        const limit = categoryQuotaLimit ?? 3;
        if (quotaPlayersInLineup.length >= limit) {
          return `U19 kategorisinde toplam en fazla ${limit} (2 saha + 1 kaleci) 2007 kontenjanı yazılabilir (Madde 18/1).`;
        }
        if (player.position === "Kaleci" && quotaGkCount >= 1) {
          return "U19 kategorisinde 2007 doğumlu en fazla 1 kaleci kontenjanı yazılabilir (Madde 18/1).";
        }
        if (player.position !== "Kaleci" && quotaOutfieldCount >= 2) {
          return "U19 kategorisinde 2007 doğumlu en fazla 2 saha oyuncusu kontenjanı yazılabilir (Madde 18/1).";
        }
      }
    }

    return null;
  };

  const assignToSlot = (
    targetSlotKey: string,
    player: SquadPlayer,
    fromSlotKey: string | null
  ) => {
    setQuotaWarning("");

    if (fromSlotKey) {
      if (fromSlotKey === targetSlotKey) return;
      setSlots((prev) => {
        const targetOccupant = prev[targetSlotKey] || null;
        return {
          ...prev,
          [targetSlotKey]: player,
          [fromSlotKey]: targetOccupant,
        };
      });
      return;
    }

    const ruleError = canPlacePlayerIntoSquad(player, targetSlotKey, fromSlotKey);
    if (ruleError) {
      setQuotaWarning(ruleError);
      return;
    }

    const alreadyOnPitch = currentLineup.some((p) => p.id === player.id);

    if (!alreadyOnPitch && player.jersey_number !== null) {
      const numConflict = currentLineup.find(
        (p) =>
          p.id !== player.id && getEffectiveNumber(p) === player.jersey_number
      );
      if (numConflict) {
        setSquadNumbers((prev) => ({ ...prev, [player.id]: "" }));
        setQuotaWarning(
          `#${player.jersey_number} numarası bu kadroda ${numConflict.full_name} tarafından kullanıldığı için ${player.full_name} için kart üzerindeki numaraya tıklayıp yeni numara seçin.`
        );
      } else {
        setSquadNumbers((prev) => ({
          ...prev,
          [player.id]: player.jersey_number as number,
        }));
      }
    }

    setSlots((prev) => {
      const cleaned: Record<string, SquadPlayer | null> = {};
      for (const [k, v] of Object.entries(prev)) {
        cleaned[k] = v?.id === player.id ? null : v;
      }
      cleaned[targetSlotKey] = player;
      return cleaned;
    });
  };

  const quickAssignPlayer = (player: SquadPlayer) => {
    const isUsed = currentLineup.some((p) => p.id === player.id);
    if (isUsed) {
      const foundKey = Object.keys(slots).find(
        (k) => slots[k]?.id === player.id
      );
      if (foundKey) removeFromSlot(foundKey);
      return;
    }

    const activeForm = FORMATIONS[formation] || Object.values(FORMATIONS)[0];
    const rows = activeForm?.rows || [];
    const allSlotKeys: { key: string; role: string }[] = [];
    rows.forEach((r, rIdx) => {
      for (let c = 0; c < r.count; c++) {
        allSlotKeys.push({ key: `${rIdx}-${c}`, role: r.role });
      }
    });

    const posPrefix = (player.position || "").toLowerCase().split(" ")[0];
    const preferredEmpty =
      allSlotKeys.find(
        (s) =>
          !slots[s.key] && posPrefix && s.role.toLowerCase().includes(posPrefix)
      ) || allSlotKeys.find((s) => !slots[s.key]);

    if (!preferredEmpty) {
      setQuotaWarning(
        "Sahadaki tüm pozisyonlar dolu. Önce bir oyuncuyu çıkarın veya üzerine sürükleyin."
      );
      return;
    }
    assignToSlot(preferredEmpty.key, player, null);
  };

  const removeFromSlot = (slotKey: string) => {
    const occupant = slots[slotKey];
    setSlots((prev) => ({ ...prev, [slotKey]: null }));
    if (occupant) {
      setSquadNumbers((prev) => {
        const copy = { ...prev };
        delete copy[occupant.id];
        return copy;
      });
    }
  };

  const activeCategoryLabel =
    SQUAD_CATEGORIES.find((c) => c.key === selectedCategory)?.label ||
    selectedCategory;

  const activeFormationObj =
    FORMATIONS[formation] || Object.values(FORMATIONS)[0];

  const buildSquadSummaryText = () => {
    const lines = currentLineup.map((p) => {
      const num = getEffectiveNumber(p);
      return `#${num === "" ? "-" : num} ${p.full_name} (${p.position || "-"})`;
    });
    const squadStatusLine =
      currentLineup.length < MIN_SQUAD_PLAYERS
        ? `Kadro Sayısı: ${currentLineup.length} (En az ${MIN_SQUAD_PLAYERS} oyuncu önerilir)`
        : `Kadro Sayısı: ${currentLineup.length}/${MAX_SQUAD_PLAYERS}`;
    return (
      `Çorum İkbalspor — ${activeCategoryLabel} (${activeFormationObj?.label || formation}) Kadrosu\n` +
      `Oyun Planı: ${tacticPlan} • ${squadStatusLine}` +
      (tacticNote.trim() ? `\nNot: ${tacticNote.trim()}` : "") +
      `\n\n` +
      lines.join("\n")
    );
  };

  const copySquadText = async () => {
    const text = buildSquadSummaryText();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedBanner(true);
        setShareStatus("Kadro metni panoya kopyalandı.");
        setTimeout(() => setCopiedBanner(false), 2500);
        return;
      }
    } catch {
      // fallback aşağıda
    }
    setShareStatus(
      "Kopyalama desteklenmedi; paylaşım penceresinden metni alabilirsiniz."
    );
  };

  const renderPitchFormationCanvas = (): string | null => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#0b2545";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(0, 0, canvas.width, 165);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("ÇORUM İKBALSPOR — SAHA DİZİLİŞ PLANI", 48, 72);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(
      `${activeCategoryLabel} • Diziliş: ${activeFormationObj?.label || formation} • ${currentLineup.length} Oyuncu`,
      48,
      124
    );

    const px = 54;
    const py = 195;
    const pw = canvas.width - 108;
    const ph = 1085;

    const grad = ctx.createLinearGradient(0, py, 0, py + ph);
    grad.addColorStop(0, "#15803d");
    grad.addColorStop(0.5, "#166534");
    grad.addColorStop(1, "#14532d");
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, pw, ph);

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 4;
    ctx.strokeRect(px + 20, py + 20, pw - 40, ph - 40);

    const midY = py + ph / 2;
    ctx.beginPath();
    ctx.moveTo(px + 20, midY);
    ctx.lineTo(px + pw - 20, midY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px + pw / 2, midY, 115, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(px + pw / 2 - 220, py + 20, 440, 155);
    ctx.strokeRect(px + pw / 2 - 220, py + ph - 175, 440, 155);

    const rowsSpec = activeFormationObj?.rows || [];
    const totalSlots =
      rowsSpec.reduce((acc, r) => acc + r.count, 0) || currentLineup.length;
    const visualRows =
      rowsSpec.length > 0
        ? rowsSpec
        : [{ label: "Kadro", count: currentLineup.length }];

    let cursor = 0;
    const rowCount = visualRows.length;
    visualRows.forEach((r, rIdx) => {
      const slice = currentLineup.slice(cursor, cursor + r.count);
      cursor += r.count;
      const countInRow = Math.max(1, slice.length);
      const yPos =
        py + 145 + (rIdx * (ph - 270)) / Math.max(1, rowCount - 1);

      slice.forEach((pl, idx) => {
        const xPos = px + ((idx + 1) * pw) / (countInRow + 1);
        const effNum = getEffectiveNumber(pl);
        const numText =
          effNum !== "" ? `#${effNum}` : `${cursor - slice.length + idx + 1}`;

        ctx.fillStyle = "#0b2545";
        ctx.beginPath();
        ctx.arc(xPos, yPos - 14, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fbbf24";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(numText, xPos, yPos - 6);

        ctx.fillStyle = "rgba(11, 37, 69, 0.92)";
        ctx.fillRect(xPos - 95, yPos + 26, 190, 34);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px sans-serif";
        const shortName = (pl.full_name || "").slice(0, 18);
        ctx.fillText(shortName, xPos, yPos + 50);
      });
    });

    if (cursor < currentLineup.length) {
      const extra = currentLineup.slice(cursor);
      const extraY = py + ph - 75;
      extra.forEach((pl, idx) => {
        const xPos = px + ((idx + 1) * pw) / (extra.length + 1);
        const effNum = getEffectiveNumber(pl);
        ctx.fillStyle = "#0b2545";
        ctx.fillRect(xPos - 95, extraY - 18, 190, 34);
        ctx.fillStyle = "#fde68a";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `${effNum !== "" ? `#${effNum} ` : ""}${pl.full_name}`.slice(0, 20),
          xPos,
          extraY + 5
        );
      });
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(
      `Kadro Sayısı: ${currentLineup.length}/${totalSlots} • ikbalspor.com`,
      54,
      1322
    );

    return canvas.toDataURL("image/png");
  };

  const generateSquadPosterDataUrl = async (): Promise<string | null> => {
    setGeneratingImage(true);
    setShareStatus("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
      grad.addColorStop(0, "#0b2545");
      grad.addColorStop(0.55, "#053b6e");
      grad.addColorStop(1, "#b91c1c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1350);

      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = "/logo.png";
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(64, 56, 104, 104, 24);
        ctx.fill();
        ctx.drawImage(logoImg, 74, 66, 84, 84);
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 42px sans-serif";
      ctx.fillText("ÇORUM İKBALSPOR", 190, 102);

      ctx.fillStyle = "#fde68a";
      ctx.font = "700 26px sans-serif";
      ctx.fillText(
        `${activeCategoryLabel} • Diziliş: ${activeFormationObj?.label || formation}`,
        190,
        142
      );

      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.roundRect(64, 192, 952, 110, 20);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 24px sans-serif";
      ctx.fillText(`Oyun Planı: ${tacticPlan}`, 92, 236);
      if (tacticNote.trim()) {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 20px sans-serif";
        ctx.fillText(`Not: ${tacticNote.trim().slice(0, 75)}`, 92, 274);
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
      ctx.beginPath();
      ctx.roundRect(64, 330, 952, 880, 24);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 26px sans-serif";
      ctx.fillText(`KADRO LİSTESİ (${currentLineup.length} Oyuncu)`, 96, 378);

      const listToDraw =
        currentLineup.length > 0
          ? currentLineup.slice(0, 14)
          : ([] as SquadPlayer[]);

      if (listToDraw.length === 0) {
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "600 22px sans-serif";
        ctx.fillText("Sahaya henüz oyuncu yerleştirilmedi.", 96, 440);
      } else {
        listToDraw.forEach((p, index) => {
          const y = 434 + index * 54;
          const num = getEffectiveNumber(p);
          ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
          ctx.beginPath();
          ctx.roundRect(92, y - 30, 896, 44, 12);
          ctx.fill();

          ctx.fillStyle = "#fca5a5";
          ctx.font = "900 22px sans-serif";
          ctx.fillText(`#${num === "" ? "-" : num}`, 110, y);

          ctx.fillStyle = "#ffffff";
          ctx.font = "800 22px sans-serif";
          ctx.fillText(p.full_name, 185, y);

          ctx.fillStyle = "#cbd5e1";
          ctx.font = "600 20px sans-serif";
          ctx.fillText(p.position || "", 660, y);
        });
      }

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "700 20px sans-serif";
      ctx.fillText(
        "ikbalspor.com • Çorum İkbalspor Resmi Kadro Kartı",
        64,
        1285
      );

      const url = canvas.toDataURL("image/png");
      setGeneratedImageUrl(url);
      setPitchImageUrl(renderPitchFormationCanvas());
      setShareVisualMode("card");
      return url;
    } catch {
      setShareStatus("Görsel oluşturulurken bir hata oluştu.");
      return null;
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleOpenShareMenu = async () => {
    const url = await generateSquadPosterDataUrl();
    setShowShareModal(true);

    if (
      url &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], "ikbalspor-kadro.png", {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `Çorum İkbalspor — ${activeCategoryLabel} Kadrosu`,
            text: buildSquadSummaryText(),
            files: [file],
          });
          setShareStatus("Paylaşım menüsü açıldı.");
        }
      } catch {
        // Kullanıcı paylaşımı iptal ettiyse veya desteklenmiyorsa modal açık kalır
      }
    }
  };

  const downloadGeneratedImage = async () => {
    const url =
      shareVisualMode === "pitch"
        ? pitchImageUrl || renderPitchFormationCanvas()
        : generatedImageUrl || (await generateSquadPosterDataUrl());
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download =
      shareVisualMode === "pitch"
        ? `ikbalspor-saha-dizilisi-${selectedCategory.toLowerCase()}.png`
        : `ikbalspor-kadro-${selectedCategory.toLowerCase()}.png`;
    a.click();
    setShareStatus(
      shareVisualMode === "pitch"
        ? "Saha diziliş planı görseli (PNG) indirildi."
        : "Kadro görseli (PNG) indirildi."
    );
  };

  const assignedIds = new Set(currentLineup.map((p) => p.id));
  const usedNumbersSet = new Set(
    currentLineup.map((p) => getEffectiveNumber(p)).filter((n) => n !== "")
  );

  const summaryText = buildSquadSummaryText();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24 lg:pb-16 transition-colors">
      <Navbar />

      <section className="bg-gradient-to-r from-[var(--brand-navy)] via-[#04376b] to-[var(--brand-red)] text-white py-6 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Taktik Tahtası &amp; Kadro Kur
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              Yaş grubunu seçin, oyuncuları sahaya sürükleyin veya listeye
              tıklayarak hızlıca dizin.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl border border-white/20">
            <img
              src="/logo.png"
              alt="Çorum İkbalspor"
              className="w-8 h-8 rounded-lg bg-white p-0.5 object-contain"
            />
            <span className="text-xs font-extrabold">Çorum İkbalspor</span>
          </div>
        </div>
      </section>

      <main
        ref={squadCardRef}
        className="max-w-7xl mx-auto px-4 pt-6 space-y-5 page-transition"
      >
        <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-5 shadow-xs space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
                Kategori / Yaş Grubu Seçimi
              </span>
              <span className="text-xs font-extrabold text-[var(--brand-red)]">
                Aktif: {activeCategoryLabel}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
              {SQUAD_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryChange(cat.key)}
                    className={`py-2.5 px-3 rounded-xl font-extrabold text-xs border transition cursor-pointer text-center ${
                      active
                        ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-sm"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border-subtle)]">
            <div>
              <label className="block text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5">
                Diziliş (Formasyon)
              </label>
              <select
                value={formation}
                onChange={(e) => {
                  setFormation(e.target.value);
                  setSlots({});
                  setSquadNumbers({});
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-xs sm:text-sm font-extrabold text-[var(--text-primary)] bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
              >
                <optgroup label="11'li Dizilişler">
                  {Object.entries(FORMATIONS)
                    .filter(([, v]) => v.group === "11")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="7 / 8 / 9 / 10 Kişilik Dizilişler">
                  {Object.entries(FORMATIONS)
                    .filter(([, v]) => v.group === "altyapi")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5">
                Oyun Planı
              </label>
              <select
                value={tacticPlan}
                onChange={(e) => setTacticPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-xs sm:text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
              >
                {TACTIC_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5">
                Taktik Notu (Opsiyonel)
              </label>
              <input
                type="text"
                value={tacticNote}
                onChange={(e) => setTacticNote(e.target.value)}
                placeholder="Örn: Duran toplarda ön direk koşusu..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-xs sm:text-sm text-[var(--text-primary)] bg-[var(--bg-subtle)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)] tabular-nums">
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold text-[var(--text-primary)]">
              <span className="px-3 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                Kadrodaki Oyuncu: <strong>{currentLineup.length}</strong> /{" "}
                {MAX_SQUAD_PLAYERS} (Min. {MIN_SQUAD_PLAYERS})
              </span>
              {selectedCategory === "Çorum Süper Amatör Ligi-U19" && (
                <span className="px-3 py-1 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] text-xs">
                  2007 Kontenjanı: Saha <strong>{quotaOutfieldCount}/2</strong> •
                  Kaleci <strong>{quotaGkCount}/1</strong>
                </span>
              )}
              {[
                "Çorum Süper Amatör Ligi-U13",
                "Çorum Süper Amatör Ligi-U14",
                "Çorum Süper Amatör Ligi-U15",
              ].includes(selectedCategory) && (
                <span className="px-3 py-1 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] text-xs">
                  Son Çeyrek Kontenjanı:{" "}
                  <strong>
                    {quotaPlayersInLineup.length} / {categoryQuotaLimit ?? 2}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copySquadText}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                {copiedBanner ? "Kopyalandı" : "Metin Kopyala"}
              </button>
              <button
                type="button"
                disabled={generatingImage}
                onClick={handleOpenShareMenu}
                className="px-4 py-2 rounded-xl bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                {generatingImage
                  ? "Görsel Hazırlanıyor..."
                  : "Görsel & Uygulama Seçerek Paylaş"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlots({});
                  setSquadNumbers({});
                  setQuotaWarning("");
                  localStorage.removeItem(`ikbal_squad_${selectedCategory}`);
                }}
                className="px-4 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] hover:opacity-85 text-xs font-extrabold cursor-pointer transition"
              >
                Sahayı Temizle
              </button>
            </div>
          </div>
        </div>

        {quotaWarning && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] font-extrabold text-xs sm:text-sm">
            {quotaWarning}
          </div>
        )}

        {shareStatus && (
          <div className="p-3 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] font-bold text-xs">
            {shareStatus}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-black text-[var(--text-primary)] tabular-nums">
                Uygun Oyuncular ({eligibleList.length})
              </h2>
              <span className="text-[11px] font-bold text-[var(--text-muted)]">
                Sürükle veya Tıkla
              </span>
            </div>

            <input
              type="text"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Oyuncu ismi ara..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
            />

            {loading ? (
              <SquadListSkeleton />
            ) : eligibleList.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center">
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  Bu kategoriye veya aramaya uygun kayıtlı oyuncu yok.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {eligibleList.map(({ player: p, info }) => {
                  const isUsed = assignedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onClick={() => quickAssignPlayer(p)}
                      onDragStart={() => {
                        setDraggingPlayer(p);
                        setDraggingFromSlot(null);
                      }}
                      className={`p-2.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-2.5 transition ${
                        isUsed
                          ? "border-emerald-500 bg-[var(--status-success-bg)]/45"
                          : info.isQuota
                          ? "border-amber-400/70 bg-[var(--status-warning-bg)]/35 hover:border-amber-500"
                          : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--brand-navy)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--brand-navy)] text-white overflow-hidden flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
                          {p.photo_url ? (
                            <img
                              src={p.photo_url}
                              alt={p.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black">
                              {p.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 tabular-nums">
                            <span className="px-1.5 py-0.5 rounded bg-[var(--brand-red-soft)] text-[var(--brand-red)] font-black text-[11px] shrink-0">
                              #{p.jersey_number ?? "-"}
                            </span>
                            <strong className="text-[var(--text-primary)] text-xs sm:text-sm truncate">
                              {p.full_name}
                            </strong>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-0.5 tabular-nums">
                            {p.position} •{" "}
                            {p.birth_date ? p.birth_date.slice(0, 4) : "-"}
                          </div>
                          {info.isQuota && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] text-[10px] font-extrabold">
                              {info.reason}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
                          isUsed
                            ? "bg-[var(--status-success-text)] text-white"
                            : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                        }`}
                      >
                        {isUsed ? "Sahada" : "+ Ekle"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-8">
            <PitchBoard
              selectedCategory={selectedCategory}
              formation={formation}
              slots={slots}
              draggingPlayer={draggingPlayer}
              setDraggingPlayer={setDraggingPlayer}
              draggingFromSlot={draggingFromSlot}
              setDraggingFromSlot={setDraggingFromSlot}
              onAssignToSlot={assignToSlot}
              onRemoveFromSlot={removeFromSlot}
              getEffectiveNumber={getEffectiveNumber}
              onNumberChange={handleSquadNumberChange}
              usedNumbersSet={usedNumbersSet}
            />
          </div>
        </div>
      </main>

      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Çorum İkbalspor"
                  className="w-8 h-8 rounded-lg object-contain border border-[var(--border-subtle)] bg-white p-0.5"
                />
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  Kadroyu Paylaş — Uygulama Seçin
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-xs font-extrabold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Kapat
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShareVisualMode("card")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  shareVisualMode === "card"
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                1. Görsel: Kadro Kartı
              </button>
              <button
                type="button"
                onClick={() => {
                  const built = pitchImageUrl || renderPitchFormationCanvas();
                  if (built) setPitchImageUrl(built);
                  setShareVisualMode("pitch");
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  shareVisualMode === "pitch"
                    ? "bg-[var(--brand-red)] text-white border-[var(--brand-red)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                2. Görsel: Saha Diziliş Planı
              </button>
            </div>

            {(shareVisualMode === "pitch" ? pitchImageUrl : generatedImageUrl) && (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-subtle)] max-h-64 flex items-center justify-center">
                <img
                  src={
                    (shareVisualMode === "pitch"
                      ? pitchImageUrl
                      : generatedImageUrl) || ""
                  }
                  alt="Kadro Görseli Önizleme"
                  className="max-h-64 object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void downloadGeneratedImage()}
                className="px-4 py-3 rounded-xl bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)] text-white text-xs font-extrabold cursor-pointer text-center"
              >
                Görsel Olarak İndir (PNG)
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(summaryText)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold text-center"
              >
                WhatsApp&apos;ta Paylaş
              </a>

              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noreferrer"
                onClick={() => void downloadGeneratedImage()}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white text-xs font-extrabold text-center"
              >
                Instagram (Görseli İndir &amp; Aç)
              </a>

              <button
                type="button"
                onClick={() => {
                  void copySquadText();
                  setShowShareModal(false);
                }}
                className="px-4 py-3 rounded-xl bg-[var(--bg-subtle)] hover:opacity-85 border border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-extrabold cursor-pointer text-center"
              >
                Metni Kopyala &amp; Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}