"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE, SIRA, VITRIN, VITRIN_PORT } from "@/lib/motion";

export function Vitrin({
  children,
  className,
  delay = 0,
  y = 22,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const azaltilmis = useReducedMotion();
  if (azaltilmis) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VITRIN_PORT}
      transition={{ duration: 0.7, ease: EASE.posta, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Sira({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const azaltilmis = useReducedMotion();
  if (azaltilmis) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={SIRA}
      initial="gizli"
      whileInView="acik"
      viewport={VITRIN_PORT}
    >
      {children}
    </motion.div>
  );
}

export function SiraOgesi({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const azaltilmis = useReducedMotion();
  if (azaltilmis) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={VITRIN}>
      {children}
    </motion.div>
  );
}

export function BolumBasligi({
  koz,
  baslik,
  giris,
  saga,
  className,
}: {
  koz?: string;
  baslik: React.ReactNode;
  giris?: React.ReactNode;
  saga?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${
        className ?? ""
      }`}
    >
      <div className="min-w-0 space-y-2">
        {koz ? <div className="k-koz text-koz">{koz}</div> : null}
        <h2 className="k-posta text-baslik text-[var(--text-primary)]">
          {baslik}
        </h2>
        {giris ? (
          <p className="k-govde text-giris max-w-2xl">{giris}</p>
        ) : null}
      </div>
      {saga ? <div className="shrink-0">{saga}</div> : null}
    </div>
  );
}

export function Iskelet({
  className,
  radius = 12,
}: {
  className?: string;
  radius?: number;
}) {
  return (
    <div
      className={`k-iskelet ${className ?? ""}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function Metrik({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const azaltilmis = useReducedMotion();
  if (azaltilmis) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE.posta }}
    >
      {children}
    </motion.div>
  );
}