/**
 * Keep CPP's original 10-minute wall-clock deadline even when the legacy
 * chat context is extended. All Daily transport generations share it.
 */
export function getCppHardDeadline(
  startedAt: string,
  storedExpiresAt: string,
): number | null {
  const start = Date.parse(startedAt);
  const storedEnd = Date.parse(storedExpiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(storedEnd) || storedEnd <= start) {
    return null;
  }
  return Math.min(storedEnd, start + 10 * 60_000);
}

export function getCppRemainingSeconds(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.floor((deadline - now) / 1000));
}
