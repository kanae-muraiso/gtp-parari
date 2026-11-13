// Marketing package names are aliases of the existing database/Stripe plan codes.
// Do not use these labels to authorize purchases or change entitlements.
import { getPlanLabel, type EffectivePlan } from "@/lib/billing/plan";

export function getStorefrontPlanLabel(plan: EffectivePlan): string {
  if (plan === "free") return "WRITERS A";
  if (plan === "plus") return "WRITERS B";
  // Legacy Organizer/Host/Pro subscriptions remain valid.
  return getPlanLabel(plan);
}

export function getWriterBillingCode(tier: "A" | "B"): "free" | "plus" {
  return tier === "A" ? "free" : "plus";
}
