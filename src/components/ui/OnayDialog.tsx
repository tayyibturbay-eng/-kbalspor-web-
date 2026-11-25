"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, SPRING } from "@/lib/motion";

type OnaySecenekleri = {
  baslik?: string;
  olumluMetin?: string;
  olumsuzMetin?: string;
  tehlikeli?: boolean;
};

type OnayIstegi = {
  mesaj: string;
  baslik: string;
  olumluMetin: string;
  olumsuzMetin: string;
  tehlikeli: boolean;
  resolve: (deger: boolean) => void;
};

type BildirimItem = { id: number; mesaj: string };

type OnayDugumu = {
  onay: (mesaj: string, secenekler?: OnaySecenekleri) => Promise<boolean>;
  bildirim: (mesaj: string) => void;
};

const OnayBaglami = createContext<OnayDugumu | null>(null);

let bildirimSayac = 0;

export function OnaySaglayici({ children }: { children: React.ReactNode }) {
  const [istek, setIstek] = useState<OnayIstegi | null>(null);
  const [bildirimler, setBildirimler] = useState<BildirimItem[]>([]);
  const olumluRef = useRef<HTMLButtonElement | null>(null);

  const onay = useCallback(
    (mesaj: string, secenekler?: OnaySecenekleri) =>
      new Promise<boolean>((resolve) => {
        setIstek({
          mesaj,
          baslik: secenekler?.baslik || "Onay Gerekli",
          olumluMetin: secenekler?.olumluMetin || "Evet, Onayla",
          olumsuzMetin: secenekler?.olumsuzMetin || "Vazgeç",
          tehlikeli: secenekler?.tehlikeli ?? true,
          resolve,
        });
      }),
    []
  );

  const kapat = useCallback((deger: boolean) => {
    setIstek((onceki) => {
      onceki?.resolve(deger);
      return null;
    });
  }, []);

  const bildirim = useCallback((mesaj: string) => {
    const id = ++bildirimSayac;
    setBildirimler((onceki) => [...onceki, { id, mesaj }]);
    window.setTimeout(() => {
      setBildirimler((onceki) => onceki.filter((b) => b.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    if (!istek) return;
    olumluRef.current?.focus();
    function tusTuza(event: KeyboardEvent) {
      if (event.key === "Escape") kapat(false);
    }
    window.addEventListener("keydown", tusTuza);
    return () => window.removeEventListener("keydown", tusTuza);
  }, [istek, kapat]);

  return (
    <OnayBaglami.Provider value={{ onay, bildirim }}>
      {children}

      <AnimatePresence>
        {istek && (
          <motion.div
            key="onay-perde"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE.yumusak }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => kapat(false)}
          >
            <motion.div
              key="onay-kart"
              role="dialog"
              aria-modal="true"
              aria-labelledby="onay-baslik"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={SPRING.keskin}
              onClick={(e) => e.stopPropagation()}
              className="k-cam bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="space-y-1.5">
                <span className="k-koz text-[10px] tracking-[0.22em] block">
                  ÇORUM İKBAL SPOR
                </span>
                <h3
                  id="onay-baslik"
                  className="k-posta text-xl font-semibold tracking-tight"
                >
                  {istek.baslik}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {istek.mesaj}
              </p>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => kapat(false)}
                  className="k-buton k-buton--hayalet"
                >
                  {istek.olumsuzMetin}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  ref={olumluRef}
                  type="button"
                  onClick={() => kapat(true)}
                  className={`k-buton ${
                    istek.tehlikeli ? "k-buton--kirmizi" : "k-buton--lacivert"
                  }`}
                >
                  {istek.olumluMetin}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {bildirimler.map((b) => (
            <motion.div
              layout
              key={b.id}
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={SPRING.yay}
              className="pointer-events-auto px-4 py-3 rounded-2xl bg-[var(--brand-navy)] border border-white/15 text-white text-xs font-extrabold shadow-xl flex items-center gap-2.5"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--brand-red)] shrink-0" />
              <span>{b.mesaj}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </OnayBaglami.Provider>
  );
}

export function useOnay(): OnayDugumu {
  const baglam = useContext(OnayBaglami);
  if (!baglam) {
    throw new Error("useOnay, OnaySaglayici içinde kullanılmalıdır.");
  }
  return baglam;
}