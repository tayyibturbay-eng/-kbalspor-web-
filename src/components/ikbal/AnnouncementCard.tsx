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
  if (
    directImage &&
    !/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(directImage)
  ) {
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
      .replace(
        /\b(?:Görsel|Resim|Fotoğraf|Ses|Link|URL)\s*:\s*\S+/gi,
        ""
      )
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  return {
    cleanedTitle: cleanStr(rawTitle),
    cleanedBody: cleanStr(rawBody),
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
      <article className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] border-l-4 border-l-[var(--brand-red)] p-3.5 transition hover:border-[var(--brand-red)]/50">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-[var(--brand-red)] truncate">
              {groupLabel}
            </span>
          </div>

          {cleanedTitle && (
            <div className="text-xs font-black text-[var(--text-primary)] truncate">
              {cleanedTitle}
            </div>
          )}

          {cleanedBody && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
              {cleanedBody}
            </p>
          )}
        </div>

        <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-[var(--brand-red)] border border-[var(--brand-red)]/35 shadow-2xs">
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
      </article>
    );
  }

  return (
    <article className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] border-l-4 border-l-[var(--brand-red)] p-5 shadow-xs flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-red)]/12 text-[var(--brand-red)] font-extrabold">
            {groupLabel}
          </span>
          {dateLabel && (
            <span className="text-[var(--text-muted)] font-semibold tabular-nums">
              {dateLabel}
            </span>
          )}
        </div>

        {cleanedTitle && (
          <h2 className="text-base font-black text-[var(--text-primary)]">
            {cleanedTitle}
          </h2>
        )}

        {cleanedBody && (
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
            {cleanedBody}
          </p>
        )}

        {announcement.sender_name && (
          <div className="pt-1 text-[11px] font-bold text-[var(--text-muted)]">
            Gönderen: {announcement.sender_name}
          </div>
        )}
      </div>

      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[var(--brand-red)] border border-[var(--brand-red)]/35 shadow-xs">
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
    </article>
  );
}