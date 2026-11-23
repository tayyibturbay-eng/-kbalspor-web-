export interface LineupPlayerRef {
  id: string;
  full_name: string;
  jersey_number?: number | null;
  position?: string | null;
}

/**
 * Bir oyuncunun sahadaki başka bir pozisyonda zaten yer alıp almadığını kontrol eder.
 */
export function isPlayerAlreadyInLineup<T extends LineupPlayerRef>(
  lineup: Record<number, T | null | undefined>,
  playerId: string,
  targetSlotIndex: number
): boolean {
  return Object.entries(lineup).some(([slotKey, assigned]) => {
    if (!assigned) return false;
    return assigned.id === playerId && Number(slotKey) !== targetSlotIndex;
  });
}

/**
 * Kadro haritasındaki mükerrer oyuncuları temizler; ilk görüldüğü slotu korur.
 */
export function deduplicateLineupMap<T extends LineupPlayerRef>(
  lineup: Record<number, T | null | undefined>
): Record<number, T | null> {
  const seenIds = new Set<string>();
  const cleaned: Record<number, T | null> = {};

  const sortedKeys = Object.keys(lineup)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  for (const idx of sortedKeys) {
    const item = lineup[idx];
    if (!item) {
      cleaned[idx] = null;
      continue;
    }
    if (seenIds.has(item.id)) {
      cleaned[idx] = null;
      continue;
    }
    seenIds.add(item.id);
    cleaned[idx] = item;
  }

  return cleaned;
}