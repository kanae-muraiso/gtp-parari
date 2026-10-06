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
import { getUsableSquareConnection } from "@/lib/square/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SquareError = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
};

async function squareRequest<T>(
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
        message: "Sandbox専用診断です。",
      },
      { status: 409 },
    );
  }

  try {
    const connection =
      await getUsableSquareConnection(auth.userId);

    const location =
      await getSquareMainLocation(connection.accessToken);

    const compactId =
      randomUUID().replace(/-/g, "").slice(0, 24);

    const plan =
      await createSquareMonthlySubscriptionPlan({
        accessToken: connection.accessToken,
        idempotencyKey: `oa-${compactId}`,
        name: `PARARI OAuth Smoke ${compactId.slice(0, 8)}`,
        amountMinor: 100,
        currency: location.currency ?? "JPY",
      });

    const customerResult =
      await squareRequest<{
        customer?: { id?: string };
      }>(
        connection.accessToken,
        "/v2/customers",
        {
          idempotency_key: `oc-${compactId}`,
          given_name: "PARARI",
          family_name: "OAuthSmoke",
          email_address:
            `oauth-smoke-${compactId.slice(0, 8)}@example.com`,
          reference_id:
            `oauth-${compactId}`,
        },
      );

    const customerId =
      customerResult.customer?.id;

    if (!customerId) {
      throw new Error(
        "Customer作成でIDが返りませんでした。",
      );
    }

    const cardResult =
      await squareRequest<{
        card?: { id?: string };
      }>(
        connection.accessToken,
        "/v2/cards",
        {
          idempotency_key: `od-${compactId}`,
          source_id: "cnon:card-nonce-ok",
          card: {
            customer_id: customerId,
            cardholder_name: "PARARI OAuth Smoke",
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
        "Card作成でIDが返りませんでした。",
      );
    }

    const subscriptionResult =
      await squareRequest<{
        subscription?: {
          id?: string;
          status?: string;
        };
      }>(
        connection.accessToken,
        "/v2/subscriptions",
        {
          idempotency_key: `os-${compactId}`,
          location_id: location.id,
          customer_id: customerId,
          plan_variation_id: plan.variationId,
          card_id: cardId,
        },
      );

    const subscription =
      subscriptionResult.subscription;

    if (!subscription?.id) {
      throw new Error(
        "Subscription作成でIDが返りませんでした。",
      );
    }

    return NextResponse.json({
      ok: true,
      merchantId: connection.merchantId,
      locationId: location.id,
      planId: plan.planId,
      variationId: plan.variationId,
      customerId,
      cardId,
      subscriptionId: subscription.id,
      status: subscription.status ?? null,
    });
  } catch (error) {
    console.error(
      "[internal/square-oauth-subscription-smoke]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "OAuth月謝診断に失敗しました。",
      },
      { status: 500 },
    );
  }
}
