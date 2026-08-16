// src/app/api/billing/sync/route.ts
// 2026-07-11 JST
//
// ログイン中ユーザーのStripe契約状態を取得し、
// Supabase user_billingを正しい状態へ同期する。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { syncUserBillingWithStripe } from "@/lib/billing/stripeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(
    /^Bearer\s+(.+)$/i,
  );

  return match?.[1] ?? null;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "ログイン情報を確認できません。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "ログイン情報を確認できません。",
        },
        { status: 401 },
      );
    }

    const billing =
      await syncUserBillingWithStripe(user.id);

    return NextResponse.json({
      billing: {
        plan: billing.plan,
        billing_status: billing.billing_status,
        cancel_at_period_end:
          billing.cancel_at_period_end,
        current_period_end:
          billing.current_period_end,
      },
    });
  } catch (error) {
    console.error("[billing/sync] error", error);

    return NextResponse.json(
      {
        error: "BILLING_SYNC_FAILED",
        message:
          "Stripeとの契約情報の同期に失敗しました。",
      },
      { status: 500 },
    );
  }
}
