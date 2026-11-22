"use client";

import { useEffect, useState } from "react";
import { EquipmentLog, JerseySetMini, StockItemMini } from "@/types/club";

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
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#02274c]">
              Malzemelerim &amp; Zimmet Kayıtları
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kulüp tarafından size teslim edilen forma ve ekipmanları
              görselleriyle takip edebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-[#02274c]/10 text-[#02274c] text-xs font-extrabold">
              Üzerimde: {activeEquipmentCount}
            </span>
            {missingEquipmentCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-extrabold">
                Eksik/Kayıp: {missingEquipmentCount}
              </span>
            )}
          </div>
        </div>

        {equipmentLogs.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center space-y-1">
            <div className="text-3xl">👕</div>
            <p className="font-extrabold text-sm text-[#02274c]">
              Henüz adınıza kayıtlı forma veya malzeme yok.
            </p>
            <p className="text-xs text-slate-500">
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
                  className={`rounded-2xl border overflow-hidden shadow-xs flex flex-col transition hover:shadow-md ${
                    isMissing
                      ? "bg-red-50/40 border-red-200"
                      : isDelivered
                      ? "bg-white border-slate-200"
                      : "bg-slate-50 border-slate-200 opacity-85"
                  }`}
                >
                  {photoUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({ url: photoUrl, title: eq.item_name })
                      }
                      className="relative group w-full h-44 bg-slate-100 overflow-hidden cursor-pointer"
                      title="Büyütmek için tıklayın"
                    >
                      <img
                        src={photoUrl}
                        alt={eq.item_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                        🔍 Büyüt
                      </span>
                    </button>
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-[#02274c] to-[#04376b] flex flex-col items-center justify-center text-white/90">
                      <span className="text-3xl mb-1">
                        {eq.category === "Forma" ? "👕" : "🎒"}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {eq.category || "Kulüp Malzemesi"}
                      </span>
                    </div>
                  )}

                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#02274c] text-[10px] font-extrabold uppercase">
                          {eq.category || "Ekipman"}
                        </span>
                        {isDelivered && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                            ✓ Üzerimde
                          </span>
                        )}
                        {eq.status === "iade_edildi" && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-extrabold">
                            İade Edildi
                          </span>
                        )}
                        {isMissing && (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold">
                            ⚠️ Kayıp / Eksik
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm text-[#02274c] leading-snug pt-0.5">
                        {eq.item_name}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        {eq.item_size && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                            Beden: {eq.item_size}
                          </span>
                        )}
                        {eq.jersey_number_given !== null && (
                          <span className="px-2 py-0.5 rounded bg-[#a60513]/10 font-extrabold text-[#a60513]">
                            #{eq.jersey_number_given}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
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

      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#02274c]">
                {previewPhoto.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Kapat ✕
              </button>
            </div>
            <div className="bg-slate-100 p-2 flex items-center justify-center">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}