// Üyelik başvurusu durum sözlüğü — tek doğruluk kaynağı.
// Veritabanında küçük harfli "bekliyor"/"onaylandi" kullanılır;
// eski kayıtlardaki "Beklemede" gibi varyantlar okuma tarafında normalize edilir.

export const MEMBERSHIP_STATUS = {
  PENDING: "bekliyor",
  APPROVED: "onaylandi",
  REJECTED: "reddedildi",
} as const;

export function isPendingStatus(status?: string | null): boolean {
  const normalized = (status || "").trim().toLocaleLowerCase("tr-TR");
  return (
    normalized === MEMBERSHIP_STATUS.PENDING ||
    normalized === "beklemede" ||
    normalized === "pending"
  );
}
