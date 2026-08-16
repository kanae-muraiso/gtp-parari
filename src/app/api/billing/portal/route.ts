// src/app/api/billing/portal/route.ts
// 2026-05-16 23:30 JST

// パーツ名：Stripe Customer Portal API
// コメント：
// ログイン中ユーザーのStripe Customer Portal URLを作成するAPI。
// カード変更・解約・請求情報確認はStripe Customer Portalに任せる。
// クライアント側から Authorization: Bearer <access_token> を受け取り、
// Supabaseのユーザー確認後、Stripe Billing Portal URLを返す。

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

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

function isMissingStripeCustomer(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as {
    code?: string;
    raw?: {
      code?: string;
    };
  };

  return (
    stripeError.code === "resource_missing" ||
    stripeError.raw?.code === "resource_missing"
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

    const appUrl = getAppUrl();

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL is not set" },
        { status: 500 }
      );
    }

    const billing = await getUserBillingByUserId(user.id);

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        {
          code: "portal_unavailable",
          error:
            "請求管理画面は、Plusのお申し込み後に利用できます。",
        },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    if (!portalSession.url) {
      return NextResponse.json(
        {
          code: "portal_error",
          error: "請求管理画面を開けませんでした。",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("[billing/portal] error", error);

    if (isMissingStripeCustomer(error)) {
      return NextResponse.json(
        {
          code: "portal_unavailable",
          error:
            "請求管理画面は、Plusのお申し込み後に利用できます。",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        code: "portal_error",
        error: "請求管理画面を開けませんでした。",
      },
      { status: 500 }
    );
  }
}
