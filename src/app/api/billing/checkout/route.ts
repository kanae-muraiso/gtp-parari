// src/app/api/billing/checkout/route.ts
// src/app/api/billing/checkout/route.ts
// 2026-05-16 19:15 JST

// パーツ名：Stripe Checkout API
// コメント：
// PARARI Plus 月5ドルのStripe Checkout Sessionを作成するAPI。
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
import { getEffectivePlan } from "@/lib/billing/plan";

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

    if (requestedPlan !== "plus") {
      return NextResponse.json(
        { error: "Only plus plan is available in MVP" },
        { status: 400 }
      );
    }

    const plusPriceId = process.env.STRIPE_PLUS_PRICE_ID;
    const appUrl = getAppUrl();

    if (!plusPriceId) {
      return NextResponse.json(
        { error: "STRIPE_PLUS_PRICE_ID is not set" },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL is not set" },
        { status: 500 }
      );
    }

    const billing = await ensureUserBillingRow(user.id);
    const effectivePlan = getEffectivePlan(billing);

    if (effectivePlan === "plus" || effectivePlan === "pro") {
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
          price: plusPriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?checkout=cancel`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan: "plus",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: "plus",
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
