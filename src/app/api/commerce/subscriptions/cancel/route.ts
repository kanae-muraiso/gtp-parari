// src/app/api/commerce/subscriptions/cancel/route.ts
// 2026-10-05 01:30 JST
// PART: Buyer subscription cancellation
// コメント:
// - PARARI購入者本人だけが自分の定期契約の解約を予約できる
// - Squareでは現在の請求期間末に解約される

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  cancelSquareSubscription,
} from "@/lib/square/api";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

export const runtime = "nodejs";

function bearerToken(
  request: NextRequest,
): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const token =
      bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインが必要です。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      token,
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ログイン情報を確認できませんでした。",
        },
        { status: 401 },
      );
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            subscriptionId?: unknown;
          }
        | null;

    const subscriptionId =
      typeof body?.subscriptionId ===
        "string"
        ? body.subscriptionId.trim()
        : "";

    if (!subscriptionId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "定期契約を確認できませんでした。",
        },
        { status: 400 },
      );
    }

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("commerce_subscriptions")
      .select(
        "id,owner_user_id,buyer_user_id,provider_subscription_id,status",
      )
      .eq("id", subscriptionId)
      .maybeSingle();

    if (
      subscriptionError ||
      !subscription ||
      subscription.buyer_user_id !==
        user.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この定期契約を変更できません。",
        },
        { status: 403 },
      );
    }

    if (
      String(
        subscription.status ?? "",
      ).toUpperCase() ===
      "CANCELED"
    ) {
      return NextResponse.json({
        ok: true,
        alreadyCanceled: true,
      });
    }

    const connection =
      await getUsableSquareConnection(
        subscription.owner_user_id,
      );

    const result =
      await cancelSquareSubscription({
        accessToken:
          connection.accessToken,
        subscriptionId:
          subscription.provider_subscription_id,
      });

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("commerce_subscriptions")
      .update({
        status:
          result.status ??
          subscription.status,
        canceled_at:
          result.canceledDate
            ? new Date(
                `${result.canceledDate}T23:59:59Z`,
              ).toISOString()
            : null,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      status:
        result.status ??
        subscription.status,
      canceledDate:
        result.canceledDate,
    });
  } catch (error) {
    console.error(
      "[commerce/subscriptions/cancel]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "定期契約の解約手続きを開始できませんでした。",
      },
      { status: 500 },
    );
  }
}
