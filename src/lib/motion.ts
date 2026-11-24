// Çorum İkbal Spor Kulübü — ortak hareket motoru (web).
// Mobil taraftaki clubTheme.ts → MOTION token'larıyla birebir aynı eğrileri
// ve yayları kullanır; iki platform aynı "kadifemsi" fiziği paylaşır.
// Kural: yalnızca transform + opacity animasyonlanır (GPU dostu, 60/120 FPS).

import type { Transition, Variants } from "framer-motion";

export const EASE = {
  /** Ana "kadife" eğri — CSS --ease-soft token'ı ile aynı */
  yumusak: [0.32, 0.72, 0, 1] as const,
  /** Editorial giriş: sert atak, uzun yumuşak kuyruk */
  posta: [0.16, 1, 0.3, 1] as const,
  /** Hızlı, arkasına bakmayan çıkış */
  veda: [0.4, 0, 0.2, 1] as const,
};

export const SPRING = {
  /** Genel UI yayı: ağırlıklı ama canlı */
  yumusak: { type: "spring", stiffness: 210, damping: 26, mass: 0.9 },
  /** Mikro etkileşim: net, kısa */
  keskin: { type: "spring", stiffness: 320, damping: 34 },
  /** Oyunbaz geri sekme (buton/ikon) */
  yay: { type: "spring", stiffness: 380, damping: 28 },
} satisfies Record<string, Transition>;

// ————— Sayfa & sahne geçişleri —————

/** Perdeli sahne girişi — template.tsx içinde kullanılır */
export const SAHNE: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE.posta } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.22, ease: EASE.veda } },
};

/** Sekme içerikleri için yönlü geçiş (yon: ileri +1, geri -1) */
export function sekmeGecis(yon: number): Variants {
  return {
    initial: { opacity: 0, x: yon * 40 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.45, ease: EASE.yumusak },
    },
    exit: {
      opacity: 0,
      x: yon * -28,
      transition: { duration: 0.18, ease: EASE.veda },
    },
  };
}

// ————— Scroll reveal (staggered) —————

export const VITRIN: Variants = {
  gizli: { opacity: 0, y: 22 },
  acik: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE.posta },
  },
};

export const SIRA: Variants = {
  gizli: {},
  acik: {
    transition: { staggerChildren: 0.075, delayChildren: 0.05 },
  },
};

/** Kart hover kaldırmaları (motion kartlarda whileHover olarak kullanılır) */
export const KART_HOVER = { y: -4 } as const;

/** Viewport gözlem ayarı — bir kez tetiklenir, kenardan önce başlar */
export const VITRIN_PORT = {
  once: true,
  margin: "-64px 0px -32px 0px",
} as const;
