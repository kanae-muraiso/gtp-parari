import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import {
  createSquareMonthlySubscriptionPlan,
  getSquareMainLocation,
} from "@/lib/square/api";
import {
  getSquareEnvironment,
  SQUARE_API_VERSION,
} from "@/lib/square/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SquareError = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
};

async function squareSandboxRequest<T>(
  accessToken: string,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(
    `https://connect.squareupsandbox.com${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const json = (await response
    .json()
    .catch(() => ({}))) as T & SquareError;

  if (!response.ok) {
    const detail =
      json.errors
        ?.map((error) =>
          [error.code, error.detail]
            .filter(Boolean)
            .join(": "),
        )
        .filter(Boolean)
        .join("; ") ||
      `Square API request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return json;
}

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
        message:
          "Sandbox test access token が設定されていません。",
      },
      { status: 412 },
    );
  }

  try {
    const location =
      await getSquareMainLocation(accessToken);

    const testId = randomUUID();
    const compactId = testId.replace(/-/g, "");
    const shortId = compactId.slice(0, 24);
    const plan =
      await createSquareMonthlySubscriptionPlan({
        accessToken,
        idempotencyKey:
          `ps-${shortId}`,
        name:
          `PARARI Sandbox Subscription ${testId.slice(0, 8)}`,
        amountMinor: 100,
        currency: location.currency ?? "JPY",
      });

    const customerResult =
      await squareSandboxRequest<{
        customer?: { id?: string };
      }>(
        accessToken,
        "/v2/customers",
        {
          idempotency_key:
            `pc-${shortId}`,
          given_name: "PARARI",
          family_name: "Sandbox",
          email_address:
            `ps-${shortId.slice(0, 12)}@example.com`,
          reference_id:
            `ps-${shortId}`,
        },
      );

    const customerId =
      customerResult.customer?.id;

    if (!customerId) {
      throw new Error(
        "Square did not return a customer ID",
      );
    }

    const cardResult =
      await squareSandboxRequest<{
        card?: { id?: string };
      }>(
        accessToken,
        "/v2/cards",
        {
          idempotency_key:
            `pd-${shortId}`,
          source_id: "cnon:card-nonce-ok",
          card: {
            customer_id: customerId,
            cardholder_name:
              "PARARI Sandbox",
            billing_address: {
              postal_code: "94103",
              country: "US",
            },
          },
        },
      );

    const cardId = cardResult.card?.id;

    if (!cardId) {
      throw new Error(
        "Square did not return a card ID",
      );
    }

    const subscriptionResult =
      await squareSandboxRequest<{
        subscription?: {
          id?: string;
          status?: string;
        };
      }>(
        accessToken,
        "/v2/subscriptions",
        {
          idempotency_key:
            `pu-${shortId}`,
          location_id: location.id,
          customer_id: customerId,
          plan_variation_id:
            plan.variationId,
          card_id: cardId,
        },
      );

    const subscription =
      subscriptionResult.subscription;

    if (!subscription?.id) {
      throw new Error(
        "Square did not return a subscription ID",
      );
    }

    return NextResponse.json({
      ok: true,
      customerId,
      cardId,
      planId: plan.planId,
      variationId: plan.variationId,
      subscriptionId: subscription.id,
      status: subscription.status ?? null,
      currency: location.currency ?? "JPY",
    });
  } catch (error) {
    console.error(
      "[internal/square-sandbox-subscription-create]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Sandbox月謝契約の作成に失敗しました。",
      },
      { status: 500 },
    );
  }
}
