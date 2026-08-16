// src/lib/billing/stripeSync.ts
// 2026-07-11 JST
//
// Stripeを正本としてuser_billingを再同期する。
// Webhookを一時的に受信できなかった場合の自己修復に使う。

import { stripe } from "./stripe";
import {
  ensureUserBillingRow,
  getUserBillingByUserId,
  markBillingCanceledBySubscriptionId,
  updateBillingFromSubscription,
  type UserBillingRow,
} from "./supabaseBilling";

function isStripeResourceMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    (error as { code?: unknown }).code === "resource_missing"
  );
}

export async function syncUserBillingWithStripe(
  userId: string,
): Promise<UserBillingRow> {
  const billing = await ensureUserBillingRow(userId);
  const subscriptionId = billing.stripe_subscription_id;

  if (!subscriptionId) {
    return billing;
  }

  try {
    const subscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    const updated = await updateBillingFromSubscription({
      subscription,
      userId,
    });

    if (updated) {
      return updated;
    }

    return (
      (await getUserBillingByUserId(userId)) ??
      billing
    );
  } catch (error) {
    if (!isStripeResourceMissing(error)) {
      throw error;
    }

    await markBillingCanceledBySubscriptionId(
      subscriptionId,
    );

    return (
      (await getUserBillingByUserId(userId)) ??
      billing
    );
  }
}
