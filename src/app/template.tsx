"use client";

// Her rota değişiminde yeniden mount olur; içeriği perdeli bir sahne
// girişiyle karşılar. Çıkış animasyonu SPA sekme geçişlerinde
// (AnimatePresence) ayrıca ele alınır.

import { motion, useReducedMotion } from "framer-motion";
import { SAHNE } from "@/lib/motion";

export default function RouteSahne({
  children,
}: {
  children: React.ReactNode;
}) {
  const azaltilmis = useReducedMotion();
  if (azaltilmis) return <>{children}</>;
  return (
    <motion.div initial="initial" animate="animate" variants={SAHNE}>
      {children}
    </motion.div>
  );
}
