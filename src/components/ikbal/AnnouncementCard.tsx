"use client";

import React from "react";

export interface AnnouncementItem {
  id: string;
  title?: string | null;
  body?: string | null;
  message_text?: string | null;
  message?: string | null;
  age_group?: string | null;
  target_group?: string | null;
  sender_name?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  imageUrl?: string | null;
  created_at?: string | null;
}

interface AnnouncementCardProps {
  announcement: AnnouncementItem;
  fallbackLogoUrl?: string;
  compact?: boolean;
  dateLabel?: string;
}

const IMAGE_URL_REGEX =
  /https?:\/\/\S+?\.(?:png|jpe?g|webp|gif|svg|avif)(?:\?\S*)?/i;
const ANY_URL_REGEX = /https?:\/\/\S+/i;

export function extractAnnouncementMediaAndCleanText(item: AnnouncementItem): {
  cleanedTitle: string;
  cleanedBody: string;
  extractedImageUrl: string | null;
} {
  const rawBody = (
    item.body ||
    item.message_text ||
    item.message ||
    ""
  ).trim();
  const rawTitle = (item.title || "").trim();

  const directImage = (
    item.image_url ||
    item.photo_url ||
    item.imageUrl ||
    ""
  ).trim();

  let extractedImageUrl: string | null = null;
  if (directImage && !/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(directImage)) {
    extractedImageUrl = directImage;
  } else {
    const labeledMatch = rawBody.match(
      /(?:Görsel|Resim|Fotoğraf)\s*:\s*(https?:\/\/\S+)/i
    );
    if (
      labeledMatch?.[1] &&
      !/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(labeledMatch[1])
    ) {
      extractedImageUrl = labeledMatch[1].replace(/[),.;]+$/, "");
    } else {
      const imgExtMatch = rawBody.match(IMAGE_URL_REGEX);
      if (imgExtMatch?.[0]) {
        extractedImageUrl = imgExtMatch[0].replace(/[),.;]+$/, "");
      } else {
        const anyUrlMatch = rawBody.match(ANY_URL_REGEX);
        if (
          anyUrlMatch?.[0] &&
          !/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(anyUrlMatch[0])
        ) {
          extractedImageUrl = anyUrlMatch[0].replace(/[),.;]+$/, "");
        }
      }
    }
  }

  const cleanStr = (text: string) =>
    text
      .replace(/\b(?:Görsel|Resim|Fotoğraf|Ses|Link|URL)\s*:\s*\S+/gi, "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  let cleanedTitle = cleanStr(rawTitle);
  let cleanedBody = cleanStr(rawBody);

  if (!cleanedTitle && cleanedBody) {
    const lines = cleanedBody
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 1 && lines[0].length <= 140) {
      cleanedTitle = lines[0];
      cleanedBody = lines.slice(1).join("\n").trim();
    } else {
      const greetingIdx = cleanedBody.search(
        /\b(?:Selam|Merhaba|Değerli|Sevgili)\b/i
      );
      if (greetingIdx > 6 && greetingIdx < 160) {
        const head = cleanedBody.slice(0, greetingIdx).trim();
        const rest = cleanedBody.slice(greetingIdx).trim();
        if (head && rest) {
          cleanedTitle = head.replace(/[•\-–—|]+$/g, "").trim();
          cleanedBody = rest;
        }
      }
    }
  }

  return {
    cleanedTitle,
    cleanedBody,
    extractedImageUrl,
  };
}

export function AnnouncementCard({
  announcement,
  fallbackLogoUrl = "/logo-red.jpg",
  compact = false,
  dateLabel,
}: AnnouncementCardProps) {
  const { cleanedTitle, cleanedBody, extractedImageUrl } =
    extractAnnouncementMediaAndCleanText(announcement);

  const groupLabel = (
    announcement.age_group ||
    announcement.target_group ||
    "Tümü"
  ).trim();

  const imgSrc = extractedImageUrl || fallbackLogoUrl;

  if (compact) {
    return (
      <article className="flex items-center gap-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3.5 transition hover:border-[var(--brand-red)]/50">
        <div className="shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-[var(--brand-red)] border-2 border-[var(--brand-red)] shadow-xs">
          <img
            src={imgSrc}
            alt={cleanedTitle || groupLabel}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith(fallbackLogoUrl)) {
                target.src = fallbackLogoUrl;
              }
            }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide truncate font-black text-[var(--brand-red)]">
              {groupLabel}
            </span>
          </div>

          {cleanedTitle && (
            <div className="text-sm leading-snug truncate font-black text-[var(--text-primary)]">
              {cleanedTitle}
            </div>
          )}

          {cleanedBody && (
            <p className="text-xs line-clamp-2 leading-relaxed font-medium text-[var(--text-secondary)]">
              {cleanedBody}
            </p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 shadow-xs flex items-start gap-4">
      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[var(--brand-red)] border-2 border-[var(--brand-red)] shadow-xs">
        <img
          src={imgSrc}
          alt={cleanedTitle || groupLabel}
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.endsWith(fallbackLogoUrl)) {
              target.src = fallbackLogoUrl;
            }
          }}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-red-600/12 font-black text-[var(--brand-red)]">
            {groupLabel}
          </span>
          {dateLabel && (
            <span className="tabular-nums font-semibold text-[var(--text-muted)]">
              {dateLabel}
            </span>
          )}
        </div>

        {cleanedTitle && (
          <h2 className="text-base sm:text-lg leading-snug font-black text-[var(--text-primary)]">
            {cleanedTitle}
          </h2>
        )}

        {cleanedBody && (
          <p className="text-sm whitespace-pre-line leading-relaxed font-medium text-[var(--text-secondary)]">
            {cleanedBody}
          </p>
        )}

        {announcement.sender_name && (
          <div className="pt-1 text-[11px] font-bold text-[var(--text-muted)]">
            Gönderen: {announcement.sender_name}
          </div>
        )}
      </div>
    </article>
  );
}