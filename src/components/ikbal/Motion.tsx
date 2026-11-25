"use client";

// Bölüm girişleri artık saf CSS/GPU animasyonlarıdır (.k-girisi — globals.css).
// Eski hâlde her Vitrin/Sira birer framer-motion düğümüydü; sekme değişiminde
// onlarca JS animasyon aynı karede yarışıp telefonda takılma yaratıyordu.
// Görünüm birebir aynıdır (posta eğrisi, 22px yükselme, kademeli gecikme),
// iş ise tarayıcı kompozitöründedir: ana iş parçacığı rota geçişinde boştur.

import React from "react";

type GirisiStili = React.CSSProperties & { "--k-g-y"?: string };

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
  return (
    <div
      className={`k-girisi ${className ?? ""}`}
      style={{ "--k-g-y": `${y}px`, animationDelay: `${delay}s` } as GirisiStili}
    >
      {children}
    </div>
  );
}

export function Sira({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ogeler = React.Children.map(children, (child, i) =>
    React.isValidElement(child) && child.type === SiraOgesi
      ? React.cloneElement(child as React.ReactElement<{ siraIndex?: number }>, {
          siraIndex: i,
        })
      : child
  );
  return <div className={className}>{ogeler}</div>;
}

export function SiraOgesi({
  children,
  className,
  siraIndex = 0,
}: {
  children: React.ReactNode;
  className?: string;
  siraIndex?: number;
}) {
  return (
    <div
      className={`k-girisi ${className ?? ""}`}
      style={
        {
          "--k-g-y": "16px",
          animationDelay: `${(0.05 + siraIndex * 0.075).toFixed(3)}s`,
        } as GirisiStili
      }
    >
      {children}
    </div>
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
  return (
    <div
      className={`k-girisi ${className ?? ""}`}
      style={{ "--k-g-y": "10px" } as GirisiStili}
    >
      {children}
    </div>
  );
}
