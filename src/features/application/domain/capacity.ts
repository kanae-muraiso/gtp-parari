export const CAPACITY_HOLDING_STATUSES = [
  "submitted",
  "confirmed",
] as const;

export function resolveEffectiveCapacityLimit(
  capacityLimit: number | null,
  planLimit: number | null,
): number | null {
  if (capacityLimit === null) {
    return planLimit;
  }

  if (planLimit === null) {
    return capacityLimit;
  }

  return Math.min(capacityLimit, planLimit);
}

export function isCapacityReached(
  currentCount: number,
  limit: number | null,
): boolean {
  if (limit === null) {
    return false;
  }

  return currentCount >= limit;
}
