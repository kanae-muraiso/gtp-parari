import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getUserPlanAccess } from "@/lib/billing/access";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { SQUARE_API_VERSION, getSquareEnvironment } from "@/lib/square/config";
import { getUsableSquareConnection } from "@/lib/square/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELLER_USER_ID = "2d39c0b2-2435-4c37-971f-7fbed90972b8";
const BUYER_USER_ID = "35b02137-de24-463a-9bdd-6565136bbd24";
const PRODUCT_NAME = "[E2E TEST] 単発売上 100円";

type SquareError = {
  errors?: Array<{ code?: string; detail?: string }>;
};

async function squarePost<T>(
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

  const json = (await response.json().catch(() => ({}))) as T & SquareError;

  if (!response.ok) {
    const detail =
      json.errors
        ?.map((error) =>
          [error.code, error.detail].filter(Boolean).join(": "),
        )
        .filter(Boolean)
        .join("; ") ||
      `Square API request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return json;
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    getSquareEnvironment() !== "sandbox"
  ) {
    return NextResponse.json(
      { ok: false, message: "Preview Sandbox専用です。" },
      { status: 409 },
    );
  }

  const secret =
    request.nextUrl.searchParams.get("secret") ?? "";

  if (
    !process.env.COMMERCE_E2E_SECRET ||
    secret !== process.env.COMMERCE_E2E_SECRET
  ) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const { data: product, error: productError } =
      await supabaseAdmin
        .from("commerce_products")
        .select("id,owner_user_id,name,amount,currency,active")
        .eq("owner_user_id", SELLER_USER_ID)
        .eq("name", PRODUCT_NAME)
        .eq("active", true)
        .maybeSingle();

    if (productError || !product) {
      throw productError ?? new Error("E2E product not found");
    }

    const planAccess =
      await getUserPlanAccess(SELLER_USER_ID);

    if (
      planAccess.effectivePlan !== "free" ||
      planAccess.entitlements.salesFeeBps !== 1000
    ) {
      throw new Error(
        `Expected FREE/1000bps, got ${planAccess.effectivePlan}/${planAccess.entitlements.salesFeeBps}`,
      );
    }

    const connection =
      await getUsableSquareConnection(SELLER_USER_ID);

    const {
      data: buyerData,
      error: buyerError,
    } = await supabaseAdmin.auth.admin.getUserById(BUYER_USER_ID);

    if (buyerError || !buyerData.user) {
      throw buyerError ?? new Error("Buyer not found");
    }

    const amount = Number(product.amount);
    const currency = String(product.currency).toUpperCase();
    const amountMinor = amount;
    const appFeeMinor = Math.floor(
      (amountMinor * planAccess.entitlements.salesFeeBps) / 10000,
    );
    const idempotencyKey = randomUUID();

    const orderResult =
      await squarePost<{
        order?: { id?: string };
      }>(
        connection.accessToken,
        "/v2/orders",
        {
          idempotency_key: `order-${idempotencyKey}`,
          order: {
            location_id: connection.locationId,
            reference_id: `parari-e2e-${idempotencyKey}`,
            line_items: [
              {
                name: PRODUCT_NAME,
                quantity: "1",
                base_price_money: {
                  amount: amountMinor,
                  currency,
                },
              },
            ],
          },
        },
      );

    const orderId = orderResult.order?.id;
    if (!orderId) {
      throw new Error("Square did not return order ID");
    }

    const { data: purchase, error: purchaseError } =
      await supabaseAdmin
        .from("commerce_purchases")
        .insert({
          product_id: product.id,
          owner_user_id: SELLER_USER_ID,
          buyer_user_id: BUYER_USER_ID,
          buyer_email:
            buyerData.user.email?.trim().toLowerCase() ?? null,
          provider: "square",
          status: "pending",
          amount,
          currency,
          merchant_id: connection.merchantId,
          location_id: connection.locationId,
          provider_order_id: orderId,
          idempotency_key: idempotencyKey,
          app_fee_amount: appFeeMinor,
        })
        .select("id")
        .single();

    if (purchaseError || !purchase) {
      throw purchaseError ?? new Error("Purchase insert failed");
    }

    const paymentResult =
      await squarePost<{
        payment?: {
          id?: string;
          status?: string;
          order_id?: string;
        };
      }>(
        connection.accessToken,
        "/v2/payments",
        {
          source_id: "cnon:card-nonce-ok",
          idempotency_key: `pay-${idempotencyKey}`,
          amount_money: {
            amount: amountMinor,
            currency,
          },
          app_fee_money: {
            amount: appFeeMinor,
            currency,
          },
          order_id: orderId,
          location_id: connection.locationId,
          autocomplete: true,
          buyer_email_address:
            buyerData.user.email ?? undefined,
          note: `PARARI PR82 FREE E2E ${purchase.id}`,
        },
      );

    if (!paymentResult.payment?.id) {
      throw new Error("Square did not return payment ID");
    }

    return NextResponse.json({
      ok: true,
      purchaseId: purchase.id,
      orderId,
      paymentId: paymentResult.payment.id,
      paymentStatus: paymentResult.payment.status ?? null,
      sellerPlan: planAccess.effectivePlan,
      feeBps: planAccess.entitlements.salesFeeBps,
      amount,
      expectedAppFee: appFeeMinor,
    });
  } catch (error) {
    console.error("[commerce-e2e/free-one-time]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "E2E failed",
      },
      { status: 500 },
    );
  }
}
