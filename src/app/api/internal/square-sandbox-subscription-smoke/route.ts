import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import {
  createSquareMonthlySubscriptionPlan,
  createSquareSubscriptionPaymentLink,
  getSquareMainLocation,
} from "@/lib/square/api";
import { getSquareEnvironment } from "@/lib/square/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);

  if (auth.ok === false) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  if (getSquareEnvironment() !== "sandbox") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Sandbox専用診断のため、本番環境では実行できません。",
      },
      { status: 409 },
    );
  }

  const accessToken =
    process.env.SQUARE_SANDBOX_TEST_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "SQUARE_SANDBOX_TEST_ACCESS_TOKEN がPreview環境に設定されていません。",
      },
      { status: 412 },
    );
  }

  try {
    const location =
      await getSquareMainLocation(accessToken);

    const testId = randomUUID();
    const name =
      `PARARI Sandbox Monthly Smoke ${testId.slice(0, 8)}`;

    const plan =
      await createSquareMonthlySubscriptionPlan({
        accessToken,
        idempotencyKey: `parari-sandbox-smoke-${testId}`,
        name,
        amountMinor: 100,
        currency: location.currency ?? "JPY",
      });

    const redirectBase =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      request.nextUrl.origin;

    const checkout =
      await createSquareSubscriptionPaymentLink({
        accessToken,
        locationId: location.id,
        idempotencyKey:
          `parari-sandbox-checkout-${testId}`,
        name,
        amountMinor: 100,
        currency: location.currency ?? "JPY",
        subscriptionPlanVariationId:
          plan.variationId,
        redirectUrl:
          new URL("/billing", redirectBase).toString(),
      });

    return NextResponse.json({
      ok: true,
      configured: true,
      locationId: location.id,
      currency: location.currency ?? "JPY",
      planId: plan.planId,
      variationId: plan.variationId,
      checkoutId: checkout.id,
      orderId: checkout.orderId,
      checkoutUrl: checkout.url,
    });
  } catch (error) {
    console.error(
      "[internal/square-sandbox-subscription-smoke]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message:
          error instanceof Error
            ? error.message
            : "Square Sandbox診断に失敗しました。",
      },
      { status: 500 },
    );
  }
}
