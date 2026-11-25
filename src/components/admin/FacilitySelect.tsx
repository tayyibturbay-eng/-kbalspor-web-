"use client";

import React from "react";
import { NAZMI_AVLUCA } from "@/types/club";

const MIMAR_SINAN_SAHASI =
  "Mimar Sinan Amatör Futbol Sahası (Mimar Sinan Mah., Merkez / Çorum)";

export const TRAINING_FACILITY_OPTIONS = [
  {
    label: "Nazmi Avluca Spor Tesisi (Varsayılan)",
    location: NAZMI_AVLUCA,
    address: "Ulukavak Mah., Çiftlik Çayırı 2. Cad., Merkez / Çorum",
  },
  {
    label: "Mimar Sinan Amatör Futbol Sahası",
    location: MIMAR_SINAN_SAHASI,
    address: "Mimar Sinan Mah., Çorum Merkez",
  },
] as const;

interface FacilitySelectProps {
  value: string;
  onChange: (nextLocation: string) => void;
  className?: string;
}

export function FacilitySelect({
  value,
  onChange,
  className = "",
}: FacilitySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Antrenman Adresi Seçin"
      className={`k-alan font-bold ${className}`.trim()}
    >
      {TRAINING_FACILITY_OPTIONS.map((fac) => (
        <option key={fac.label} value={fac.location}>
          Saha: {fac.label}
        </option>
      ))}
    </select>
  );
}