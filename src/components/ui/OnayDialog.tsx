"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Tarayıcının ham confirm()/alert() pencereleri yerine kulüp tasarım
// diline uygun, klavyeyle kullanılabilir onay penceresi ve bildirim şeridi.

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

  const kapat = useCallback(
    (deger: boolean) => {
      setIstek((onceki) => {
        onceki?.resolve(deger);
        return null;
      });
    },
    []
  );

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

      {istek && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => kapat(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onay-baslik"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl"
          >
            <h3
              id="onay-baslik"
              className="text-base font-black tracking-tight"
            >
              {istek.baslik}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {istek.mesaj}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => kapat(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                {istek.olumsuzMetin}
              </button>
              <button
                ref={olumluRef}
                type="button"
                onClick={() => kapat(true)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer transition ${
                  istek.tehlikeli
                    ? "bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)]"
                    : "bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)]"
                }`}
              >
                {istek.olumluMetin}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm"
      >
        {bildirimler.map((b) => (
          <div
            key={b.id}
            className="px-4 py-3 rounded-2xl bg-[var(--brand-navy)] text-white text-xs font-extrabold shadow-lg"
          >
            {b.mesaj}
          </div>
        ))}
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
