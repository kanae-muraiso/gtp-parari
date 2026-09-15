import type {
  ApplicationPricingSource,
} from "./types";

function normalizeAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeCurrency(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : "JPY";
}

export type EffectiveApplicationPricing = {
  source: ApplicationPricingSource;
  amount: number;
  currency: string;
};

export function resolveEffectivePricing(input: {
  applicationAmount: number | null;
  applicationCurrency: string | null;
  calendarOccurrence:
    | {
        feeAmount: number | null;
        feeCurrency: string | null;
      }
    | null;
}): EffectiveApplicationPricing {
  if (input.calendarOccurrence) {
    return {
      source: "calendar_occurrence",
      amount: normalizeAmount(
        input.calendarOccurrence.feeAmount,
      ),
      currency: normalizeCurrency(
        input.calendarOccurrence.feeCurrency,
      ),
    };
  }

  return {
    source: "application",
    amount: normalizeAmount(input.applicationAmount),
    currency: normalizeCurrency(
      input.applicationCurrency,
    ),
  };
}
