import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { CLASS_B_BLOCK_PRICE_JPY } from "@/lib/classBPolicy";
import { classBPaidInvoiceMatches } from "./classBInvoiceEvidence";

export function isClassBSubscription(subscription: Stripe.Subscription): boolean {
  return subscription.metadata?.plan === "class_b" ||
    Boolean(process.env.STRIPE_CLASS_B_JPY_PRICE_ID &&
      subscription.items.data.some(item => item.price.id === process.env.STRIPE_CLASS_B_JPY_PRICE_ID));
}

/** Reconcile authoritative Stripe state, not the quantity in Checkout metadata.
 * The SQL RPC atomically checks the reserved contract and updates its entitlement.
 */
export async function reconcileClassBSubscription(id: string) {
  const subscription = await stripe.subscriptions.retrieve(id, {expand:["latest_invoice"]});
  if (!isClassBSubscription(subscription)) throw new Error("Not a CLASS B subscription");
  const metadata = subscription.metadata;
  const item = subscription.items.data[0];
  const priceId = process.env.STRIPE_CLASS_B_JPY_PRICE_ID;
  if (metadata.plan !== "class_b" || !metadata.class_b_school_id ||
      !metadata.class_b_attempt_id || !metadata.supabase_user_id ||
      !priceId || subscription.items.has_more || subscription.items.data.length !== 1 ||
      !item || item.price.id !== priceId || item.price.currency !== "jpy" ||
      item.price.unit_amount !== CLASS_B_BLOCK_PRICE_JPY ||
      item.price.recurring?.interval !== "month" || item.price.recurring.interval_count !== 1 ||
      item.price.recurring.usage_type !== "licensed" ||
      !Number.isSafeInteger(item.quantity) || (item.quantity ?? 0)<1 || (item.quantity ?? 0)>1000000 ||
      (subscription.livemode !== (process.env.VERCEL_ENV === "production"))) {
    throw new Error("Invalid CLASS B subscription");
  }
  const paid = classBPaidInvoiceMatches(subscription,priceId);
  const periodEnd = item.current_period_end;
  const {error} = await db.rpc("reconcile_class_b_contract", {
    p_school:metadata.class_b_school_id,
    p_attempt:metadata.class_b_attempt_id,
    p_owner:metadata.supabase_user_id,
    p_subscription:subscription.id,
    p_customer:typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    p_status:subscription.status,
    p_blocks:item.quantity,
    p_paid:paid,
    p_period_end:new Date(periodEnd*1000).toISOString()
  });
  if (error) throw error;
}
