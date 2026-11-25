"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EquipmentLog, JerseySetMini, StockItemMini } from "@/types/club";
import { SPRING } from "@/lib/motion";

interface PlayerEquipmentTabProps {
  equipmentLogs: EquipmentLog[];
  jerseySets: JerseySetMini[];
  stockItems: StockItemMini[];
}

export function PlayerEquipmentTab({
  equipmentLogs,
  jerseySets,
  stockItems,
}: PlayerEquipmentTabProps) {
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const azaltilmis = useReducedMotion();

  useEffect(() => {
    if (!previewPhoto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewPhoto(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewPhoto]);

  const activeEquipmentCount = equipmentLogs.filter(
    (e) => e.status === "teslim_edildi"
  ).length;
  const missingEquipmentCount = equipmentLogs.filter(
    (e) => e.status === "kayip_eksik"
  ).length;

  function resolveEquipmentPhoto(log: EquipmentLog): string | null {
    if (log.jersey_set_id) {
      const foundSet = jerseySets.find((j) => j.id === log.jersey_set_id);
      if (foundSet?.photo_url) return foundSet.photo_url;
    }
    const foundStock = stockItems.find(
      (s) => s.product_name.toLowerCase() === log.item_name.toLowerCase()
    );
    if (foundStock?.photo_url) return foundStock.photo_url;
    return null;
  }

  return (
    <div className="space-y-6 tabular-nums">
      <div className="k-artik p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">ZİMMET &amp; EKİPMAN</span>
            <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
              Malzemelerim &amp; Zimmet Kayıtları
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Kulüp tarafından size teslim edilen forma ve ekipmanları
              görselleriyle takip edebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="k-etiket k-etiket--lacivert">
              Üzerimde: {activeEquipmentCount}
            </span>
            {missingEquipmentCount > 0 && (
              <span className="k-etiket k-etiket--tehlike">
                Eksik/Kayıp: {missingEquipmentCount}
              </span>
            )}
          </div>
        </div>

        {equipmentLogs.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-8 text-center space-y-1.5">
            <p className="font-extrabold text-sm text-[var(--text-primary)]">
              Henüz adınıza kayıtlı forma veya malzeme yok.
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Yönetici tarafından size malzeme teslim edildiğinde burada
              görseliyle birlikte görünecektir.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipmentLogs.map((eq) => {
              const photoUrl = resolveEquipmentPhoto(eq);
              const isDelivered = eq.status === "teslim_edildi";
              const isMissing = eq.status === "kayip_eksik";
              return (
                <div
                  key={eq.id}
                  className={`k-kart rounded-2xl border overflow-hidden flex flex-col ${
                    isMissing
                      ? "bg-[var(--status-danger-bg)]/35 border-[var(--status-danger-text)]/30"
                      : isDelivered
                      ? "bg-[var(--bg-surface)] border-[var(--border-subtle)]"
                      : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] opacity-85"
                  }`}
                >
                  {photoUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({ url: photoUrl, title: eq.item_name })
                      }
                      className="relative group w-full h-44 bg-[var(--bg-subtle)] overflow-hidden cursor-pointer"
                      title="Büyütmek için tıklayın"
                    >
                      <img
                        src={photoUrl}
                        alt={eq.item_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/65 text-white text-[10px] font-bold backdrop-blur-xs">
                        Büyüt
                      </span>
                    </button>
                  ) : (
                    <div className="w-full h-32 k-sahne flex flex-col items-center justify-center text-white/95">
                      <span className="px-3 py-1 rounded-full k-cam--marka text-xs font-extrabold uppercase tracking-wider">
                        {eq.category || "Kulüp Malzemesi"}
                      </span>
                    </div>
                  )}

                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-[10px] font-extrabold uppercase">
                          {eq.category || "Ekipman"}
                        </span>
                        {isDelivered && (
                          <span className="k-etiket k-etiket--basari">
                            Üzerimde
                          </span>
                        )}
                        {eq.status === "iade_edildi" && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-[11px] font-extrabold">
                            İade Edildi
                          </span>
                        )}
                        {isMissing && (
                          <span className="k-etiket k-etiket--tehlike">
                            Kayıp / Eksik
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm text-[var(--text-primary)] leading-snug pt-0.5">
                        {eq.item_name}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        {eq.item_size && (
                          <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] font-bold text-[var(--text-primary)]">
                            Beden: {eq.item_size}
                          </span>
                        )}
                        {eq.jersey_number_given !== null && (
                          <span className="px-2 py-0.5 rounded bg-[var(--brand-red-soft)] font-extrabold text-[var(--brand-red)]">
                            #{eq.jersey_number_given}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {eq.given_date}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={azaltilmis ? false : { opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={SPRING.keskin}
              onClick={(e) => e.stopPropagation()}
              className="k-artik max-w-lg w-full overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
                <h3 className="k-posta text-base text-[var(--text-primary)]">
                  {previewPhoto.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="k-buton k-buton--hayalet !py-1 !px-3 !text-xs"
                >
                  Kapat
                </button>
              </div>
              <div className="bg-[var(--bg-subtle)] p-2 flex items-center justify-center">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.title}
                  className="max-h-[75vh] w-auto object-contain rounded-2xl"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}