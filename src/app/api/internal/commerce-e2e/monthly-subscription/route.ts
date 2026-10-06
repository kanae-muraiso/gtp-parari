import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserPlanAccess } from "@/lib/billing/access";
import { SQUARE_API_VERSION, getSquareEnvironment } from "@/lib/square/config";
import { getUsableSquareConnection } from "@/lib/square/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELLER_USER_ID = "2d39c0b2-2435-4c37-971f-7fbed90972b8";
const BUYER_USER_ID = "35b02137-de24-463a-9bdd-6565136bbd24";
const PRODUCT_NAME = "[E2E TEST] 月謝 100円";

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

export async function POST(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    getSquareEnvironment() !== "sandbox"
  ) {
    return NextResponse.json(
      { ok: false, message: "Preview Sandbox専用です。" },
      { status: 409 },
    );
  }

  const auth = await authenticateInternalAdmin(request);

  if (auth.ok === false) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  try {
    const { data: product, error: productError } =
      await supabaseAdmin
        .from("commerce_products")
        .select(
          "id,owner_user_id,name,amount,currency,active,square_plan_variation_id",
        )
        .eq("owner_user_id", SELLER_USER_ID)
        .eq("name", PRODUCT_NAME)
        .eq("billing_interval", "monthly")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (productError || !product?.square_plan_variation_id) {
      throw productError ?? new Error("Monthly E2E product not found");
    }

    const planAccess =
      await getUserPlanAccess(SELLER_USER_ID);

    if (
      planAccess.effectivePlan !== "organizer" ||
      !planAccess.entitlements.canUseRecurringSales
    ) {
      throw new Error("Seller is not ORGANIZER");
    }

    const connection =
      await getUsableSquareConnection(SELLER_USER_ID);

    const {
      data: buyerData,
      error: buyerError,
    } = await supabaseAdmin.auth.admin.getUserById(BUYER_USER_ID);

    if (buyerError || !buyerData.user?.email) {
      throw buyerError ?? new Error("Buyer not found");
    }

    const buyerEmail =
      buyerData.user.email.trim().toLowerCase();

    const compactId =
      randomUUID().replace(/-/g, "").slice(0, 24);

    const customerResult =
      await squarePost<{
        customer?: { id?: string };
      }>(
        connection.accessToken,
        "/v2/customers",
        {
          idempotency_key: `mc-${compactId}`,
          given_name: "PARARI",
          family_name: "E2EBuyer",
          email_address: buyerEmail,
          reference_id: `e2e-${compactId}`,
        },
      );

    const customerId = customerResult.customer?.id;
    if (!customerId) {
      throw new Error("Square did not return customer ID");
    }

    const cardResult =
      await squarePost<{
        card?: { id?: string };
      }>(
        connection.accessToken,
        "/v2/cards",
        {
          idempotency_key: `md-${compactId}`,
          source_id: "cnon:card-nonce-ok",
          card: {
            customer_id: customerId,
            cardholder_name: "PARARI E2E Buyer",
            billing_address: {
              postal_code: "94103",
              country: "US",
            },
          },
        },
      );

    const cardId = cardResult.card?.id;
    if (!cardId) {
      throw new Error("Square did not return card ID");
    }

    const {
      data: checkout,
      error: checkoutError,
    } = await supabaseAdmin
      .from("commerce_subscription_checkouts")
      .insert({
        product_id: product.id,
        owner_user_id: SELLER_USER_ID,
        buyer_user_id: BUYER_USER_ID,
        buyer_email: buyerEmail,
        billing_amount: Number(product.amount),
        billing_currency: String(product.currency).toUpperCase(),
        square_plan_variation_id: product.square_plan_variation_id,
        provider_order_id: `e2e-order-${compactId}`,
        provider_payment_link_id: `e2e-link-${compactId}`,
        checkout_url: null,
        status: "pending",
      })
      .select("id")
      .single();

    if (checkoutError || !checkout) {
      throw checkoutError ?? new Error("Pending checkout insert failed");
    }

    const subscriptionResult =
      await squarePost<{
        subscription?: {
          id?: string;
          status?: string;
        };
      }>(
        connection.accessToken,
        "/v2/subscriptions",
        {
          idempotency_key: `ms-${compactId}`,
          location_id: connection.locationId,
          customer_id: customerId,
          plan_variation_id: product.square_plan_variation_id,
          card_id: cardId,
        },
      );

    const subscription = subscriptionResult.subscription;

    if (!subscription?.id) {
      throw new Error("Square did not return subscription ID");
    }

    return NextResponse.json({
      ok: true,
      productId: product.id,
      checkoutId: checkout.id,
      subscriptionId: subscription.id,
      status: subscription.status ?? null,
      buyerEmail,
      expectedFeeBps:
        planAccess.entitlements.salesFeeBps,
    });
  } catch (error) {
    console.error("[commerce-e2e/monthly-subscription]", error);

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
