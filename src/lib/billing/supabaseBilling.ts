// apps/tools/parari/src/lib/billing/supabaseBilling.ts
// apps/tools/parari/src/lib/billing/supabaseBilling.ts
// 2026-05-21 09:05 JST

// パーツ名：Billing Supabase Helpers
// コメント：
// Stripe Customer / Subscription の状態を user_billing に保存・更新するための補助関数。
// Checkout API と Webhook API から共通利用する。
// このファイルはサーバー側専用。ブラウザ側コンポーネントから import しない。

import type Stripe from "stripe";
import { supabaseAdmin } from "./supabaseAdmin";

export type BillingPlan = "free" | "plus" | "pro";

export type BillingStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type UserBillingRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: BillingPlan;
  billing_status: BillingStatus;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at?: string;
  updated_at?: string;
};

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

/**
 * PART: get current period end from subscription
 * コメント：
 * - Stripe SDK の型変更に備え、subscription本体とitems側の両方を安全に見る
 * - 取得できなければ null を返す
 */
function getCurrentPeriodEndFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  const readableSubscription = subscription as unknown as {
    current_period_end?: number | null;
    items?: {
      data?: Array<{
        current_period_end?: number | null;
      }>;
    };
  };

  const timestamp =
    readableSubscription.current_period_end ??
    readableSubscription.items?.data?.[0]?.current_period_end ??
    null;

  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

export function getPlanFromPriceId(priceId: string | null | undefined): BillingPlan {
  if (!priceId) return "free";

  if (priceId === process.env.STRIPE_PLUS_PRICE_ID) {
    return "plus";
  }

  // ProはMVPでは未実装。
  // 将来 STRIPE_PRO_PRICE_ID を追加したときのために残す。
  if (
    process.env.STRIPE_PRO_PRICE_ID &&
    priceId === process.env.STRIPE_PRO_PRICE_ID
  ) {
    return "pro";
  }

  return "free";
}

export async function getUserBillingByUserId(
  userId: string
): Promise<UserBillingRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get user_billing by user_id: ${error.message}`);
  }

  return data as UserBillingRow | null;
}

export async function getUserBillingByStripeCustomerId(
  stripeCustomerId: string
): Promise<UserBillingRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get user_billing by stripe_customer_id: ${error.message}`
    );
  }

  return data as UserBillingRow | null;
}

export async function ensureUserBillingRow(userId: string): Promise<UserBillingRow> {
  const existing = await getUserBillingByUserId(userId);

  if (existing) {
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .insert({
      user_id: userId,
      plan: "free",
      billing_status: "none",
      cancel_at_period_end: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create user_billing row: ${error.message}`);
  }

  return data as UserBillingRow;
}

export async function saveStripeCustomerIdForUser(params: {
  userId: string;
  stripeCustomerId: string;
}): Promise<UserBillingRow> {
  const { userId, stripeCustomerId } = params;

  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save Stripe customer ID: ${error.message}`);
  }

  return data as UserBillingRow;
}

export async function updateBillingFromSubscription(params: {
  subscription: Stripe.Subscription;
  userId?: string | null;
}): Promise<UserBillingRow | null> {
  const { subscription, userId } = params;

  const stripeCustomerId = getStripeCustomerId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const pricePlan = getPlanFromPriceId(priceId);
  const billingStatus = subscription.status as BillingStatus;
  const plan: BillingPlan =
    billingStatus === "active" || billingStatus === "trialing"
      ? pricePlan
      : "free";

      /**
       * PART: current period end
       * コメント：
       * - Stripe SDK型の差異を helper 側で吸収する
       */
      const currentPeriodEnd = getCurrentPeriodEndFromSubscription(subscription);

  const payload = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    plan,
    billing_status: billingStatus,
    price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    const { data, error } = await supabaseAdmin
      .from("user_billing")
      .upsert(
        {
          user_id: userId,
          ...payload,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Failed to update billing from subscription with user_id: ${error.message}`
      );
    }

    return data as UserBillingRow;
  }

  if (!stripeCustomerId) {
    return null;
  }

  const existing = await getUserBillingByStripeCustomerId(stripeCustomerId);

  if (!existing) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .update(payload)
    .eq("user_id", existing.user_id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to update billing from subscription: ${error.message}`
    );
  }

  return data as UserBillingRow;
}

export async function markBillingCanceledBySubscriptionId(
  stripeSubscriptionId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_billing")
    .update({
      plan: "free",
      billing_status: "canceled",
      stripe_subscription_id: stripeSubscriptionId,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) {
    throw new Error(`Failed to mark billing canceled: ${error.message}`);
  }
}

export async function markBillingPastDueByCustomerId(
  stripeCustomerId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_billing")
    .update({
      billing_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) {
    throw new Error(`Failed to mark billing past_due: ${error.message}`);
  }
}
