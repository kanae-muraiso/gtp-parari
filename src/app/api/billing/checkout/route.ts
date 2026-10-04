// src/app/api/billing/checkout/route.ts
// src/app/api/billing/checkout/route.ts
// 2026-05-16 19:15 JST

// パーツ名：Stripe Checkout API
// コメント：
// PARARI Plus 月3ドルのStripe Checkout Sessionを作成するAPI。
// クライアント側から Authorization: Bearer <access_token> を受け取り、
// Supabaseのユーザー確認後、Stripe Checkout URLを返す。
// 戻り先URLは、PARARI既存設定の NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL を利用する。
// NEXT_PUBLIC_SITE_URL は既存ログイン処理に影響する可能性があるため使わない。

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  ensureUserBillingRow,
  saveStripeCustomerIdForUser,
} from "@/lib/billing/supabaseBilling";
import {
  getEffectivePlan,
  PLAN_ENTITLEMENTS,
} from "@/lib/billing/plan";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function getAppUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? null;
}

function isStripeResourceMissing(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    (error as { code?: unknown }).code ===
      "resource_missing"
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: missing access token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: invalid access token" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedPlan = body?.plan ?? "plus";

    if (requestedPlan !== "plus" && requestedPlan !== "organizer") {
      return NextResponse.json(
        { error: "Unsupported billing plan" },
        { status: 400 }
      );
    }

    const priceId =
      requestedPlan === "organizer"
        ? process.env.STRIPE_ORGANIZER_PRICE_ID
        : process.env.STRIPE_PLUS_PRICE_ID;
    const appUrl = getAppUrl();

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            requestedPlan === "organizer"
              ? "STRIPE_ORGANIZER_PRICE_ID is not set"
              : "STRIPE_PLUS_PRICE_ID is not set",
        },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL is not set" },
        { status: 500 }
      );
    }

    const planPrice = await stripe.prices.retrieve(priceId);
    const expectedUnitAmount =
      PLAN_ENTITLEMENTS[requestedPlan].monthlyPriceUsd * 100;
    const isExpectedPrice =
      planPrice.active &&
      planPrice.currency === "usd" &&
      planPrice.unit_amount === expectedUnitAmount &&
      planPrice.type === "recurring" &&
      planPrice.recurring?.interval === "month" &&
      planPrice.recurring.interval_count === 1;

    if (!isExpectedPrice) {
      console.error(
        "[billing/checkout] Stripe price does not match plan SSOT",
        {
          plan: requestedPlan,
          priceId: planPrice.id,
          currency: planPrice.currency,
          unitAmount: planPrice.unit_amount,
          type: planPrice.type,
          interval: planPrice.recurring?.interval ?? null,
          intervalCount: planPrice.recurring?.interval_count ?? null,
        },
      );

      return NextResponse.json(
        { error: "Plan price configuration is invalid" },
        { status: 500 },
      );
    }

    const billing = await ensureUserBillingRow(user.id);
    const effectivePlan = getEffectivePlan(billing);

    if (effectivePlan !== "free") {
      return NextResponse.json(
        {
          error: "ALREADY_SUBSCRIBED",
          message:
            "すでに有料プランをご利用中です。変更や解約は請求管理から行ってください。",
        },
        { status: 409 },
      );
    }

    let stripeCustomerId = billing.stripe_customer_id;

    /*
     * Supabaseにテスト環境のCustomer IDが残っていても、
     * 本番Stripeでは利用できない。
     *
     * 現在のStripe鍵でCustomerを取得できるか確認し、
     * 存在しない場合は、この環境用のCustomerを新規作成する。
     */
    if (stripeCustomerId) {
      try {
        const existingCustomer =
          await stripe.customers.retrieve(
            stripeCustomerId,
          );

        if (
          "deleted" in existingCustomer &&
          existingCustomer.deleted
        ) {
          stripeCustomerId = null;
        }
      } catch (error) {
        if (!isStripeResourceMissing(error)) {
          throw error;
        }

        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      await saveStripeCustomerIdForUser({
        userId: user.id,
        stripeCustomerId,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?checkout=cancel`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan: requestedPlan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: requestedPlan,
        },
      },
      allow_promotion_codes: false,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create Checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("[billing/checkout] error", error);

    return NextResponse.json(
      { error: "Failed to create Checkout Session" },
      { status: 500 }
    );
  }
}
