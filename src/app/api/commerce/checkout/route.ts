// src/app/api/commerce/checkout/route.ts
// 2026-10-05 00:10 JST
// PART: Commerce checkout
// コメント:
// - 単発販売はSquare Application Feeで即時にPARARI手数料を分配
// - 月謝はSquare Subscription Plan Checkoutを使い、PARARI手数料は月次精算する
// - 購入者はPARARIログイン必須

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getUserPlanAccess } from "@/lib/billing/access";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  createSquarePaymentLink,
  createSquareSubscriptionPaymentLink,
} from "@/lib/square/api";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

export const runtime = "nodejs";

function bearerToken(request: NextRequest): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

function appUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!value) {
    throw new Error("APP_URL_NOT_CONFIGURED");
  }

  return value;
}

function toMinorUnits(
  amount: number,
  currency: string,
): number {
  const zeroDecimal =
    new Set(["JPY", "KRW", "VND"]);

  return Math.round(
    amount *
      (zeroDecimal.has(currency) ? 1 : 100),
  );
}

function fromMinorUnits(
  amountMinor: number,
  currency: string,
): number {
  const zeroDecimal =
    new Set(["JPY", "KRW", "VND"]);

  return zeroDecimal.has(currency)
    ? amountMinor
    : amountMinor / 100;
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          code: "LOGIN_REQUIRED",
          message: "購入にはPARARIへのログインが必要です。",
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
        { ok: false, message: "ログイン情報を確認できませんでした。" },
        { status: 401 },
      );
    }

    const body =
      (await request.json().catch(() => null)) as
        | { productId?: unknown }
        | null;
    const productId =
      typeof body?.productId === "string"
        ? body.productId.trim()
        : "";

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "商品を確認できませんでした。" },
        { status: 400 },
      );
    }

    const { data: product, error: productError } =
      await supabaseAdmin
        .from("commerce_products")
        .select("*")
        .eq("id", productId)
        .eq("active", true)
        .maybeSingle();

    if (productError || !product) {
      return NextResponse.json(
        { ok: false, message: "販売中の商品が見つかりませんでした。" },
        { status: 404 },
      );
    }

    if (product.owner_user_id === user.id) {
      return NextResponse.json(
        { ok: false, message: "自分の商品は購入できません。" },
        { status: 409 },
      );
    }

    if (product.work_id) {
      const { data: entitlement } =
        await supabaseAdmin
          .from("commerce_entitlements")
          .select("id,status")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .eq("status", "active")
          .maybeSingle();

      if (entitlement) {
        return NextResponse.json({
          ok: true,
          alreadyOwned: true,
          url: `${appUrl()}/p/${product.work_id}`,
        });
      }
    }

    const connection =
      await getUsableSquareConnection(
        product.owner_user_id,
      );
    const currency =
      String(product.currency).toUpperCase();
    const amount =
      Number(product.amount);
    const amountMinor =
      toMinorUnits(amount, currency);
    const resultUrl =
      product.work_id
        ? `${appUrl()}/p/${product.work_id}?purchase=return`
        : `${appUrl()}/buy/${product.id}?purchase=return`;

    if (product.billing_interval === "monthly") {
      const sellerAccess =
        await getUserPlanAccess(
          product.owner_user_id,
        );

      if (
        !sellerAccess.entitlements
          .canUseRecurringSales
      ) {
        return NextResponse.json(
          {
            ok: false,
            code:
              "SELLER_ORGANIZER_REQUIRED",
            message:
              "この定期サービスは現在、新規申込を受け付けていません。",
          },
          { status: 409 },
        );
      }

      const {
        data: activeSubscription,
        error: activeSubscriptionError,
      } = await supabaseAdmin
        .from("commerce_subscriptions")
        .select("id,status,canceled_at")
        .eq("product_id", product.id)
        .eq("buyer_user_id", user.id)
        .in("status", ["ACTIVE", "PENDING", "PAYMENT_FAILED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSubscriptionError) {
        throw activeSubscriptionError;
      }

      if (
        activeSubscription &&
        !activeSubscription.canceled_at
      ) {
        return NextResponse.json({
          ok: true,
          recurring: true,
          alreadySubscribed: true,
          url: `${appUrl()}/my/purchases`,
        });
      }

      if (!product.square_plan_variation_id) {
        throw new Error(
          "SUBSCRIPTION_PLAN_NOT_CONFIGURED",
        );
      }

      const reusableSince =
        new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();

      await supabaseAdmin
        .from("commerce_subscription_checkouts")
        .update({
          status: "expired",
          updated_at:
            new Date().toISOString(),
        })
        .eq("product_id", product.id)
        .eq("buyer_user_id", user.id)
        .eq("status", "pending")
        .lt("created_at", reusableSince);

      await supabaseAdmin
        .from("commerce_subscription_checkouts")
        .update({
          status: "expired",
          updated_at:
            new Date().toISOString(),
        })
        .eq("product_id", product.id)
        .eq("buyer_user_id", user.id)
        .eq("status", "pending")
        .neq(
          "square_plan_variation_id",
          product.square_plan_variation_id,
        );

      const {
        data: pendingCheckout,
        error: pendingCheckoutError,
      } = await supabaseAdmin
        .from("commerce_subscription_checkouts")
        .select("id,checkout_url,status")
        .eq("product_id", product.id)
        .eq("buyer_user_id", user.id)
        .eq("status", "pending")
        .eq(
          "square_plan_variation_id",
          product.square_plan_variation_id,
        )
        .gte("created_at", reusableSince)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingCheckoutError) {
        throw pendingCheckoutError;
      }

      if (pendingCheckout?.checkout_url) {
        return NextResponse.json({
          ok: true,
          recurring: true,
          reused: true,
          url: pendingCheckout.checkout_url,
        });
      }

      const idempotencyKey = randomUUID();
      const link =
        await createSquareSubscriptionPaymentLink({
          accessToken: connection.accessToken,
          locationId: connection.locationId,
          idempotencyKey,
          name: product.name,
          amountMinor,
          currency,
          subscriptionPlanVariationId:
            product.square_plan_variation_id,
          redirectUrl: resultUrl,
          buyerEmail: user.email ?? null,
        });

      const { error: insertError } =
        await supabaseAdmin
          .from("commerce_subscription_checkouts")
          .insert({
            product_id: product.id,
            owner_user_id:
              product.owner_user_id,
            buyer_user_id: user.id,
            buyer_email:
              user.email?.trim().toLowerCase() ??
              null,
            billing_amount: amount,
            billing_currency: currency,
            square_plan_variation_id:
              product.square_plan_variation_id,
            provider_order_id: link.orderId,
            provider_payment_link_id: link.id,
            checkout_url: link.url,
            status: "pending",
          });

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({
        ok: true,
        recurring: true,
        url: link.url,
      });
    }

    const reusablePurchaseSince =
      new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

    await supabaseAdmin
      .from("commerce_purchases")
      .update({
        status: "cancelled",
        updated_at:
          new Date().toISOString(),
      })
      .eq("product_id", product.id)
      .eq("buyer_user_id", user.id)
      .eq("status", "pending")
      .lt(
        "created_at",
        reusablePurchaseSince,
      );

    const {
      data: pendingPurchase,
      error: pendingPurchaseError,
    } = await supabaseAdmin
      .from("commerce_purchases")
      .select("id,checkout_url,status")
      .eq("product_id", product.id)
      .eq("buyer_user_id", user.id)
      .eq("status", "pending")
      .gte(
        "created_at",
        reusablePurchaseSince,
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingPurchaseError) {
      throw pendingPurchaseError;
    }

    if (pendingPurchase?.checkout_url) {
      return NextResponse.json({
        ok: true,
        recurring: false,
        reused: true,
        url: pendingPurchase.checkout_url,
      });
    }

    const { entitlements } =
      await getUserPlanAccess(
        product.owner_user_id,
      );
    const feeBps = entitlements.salesFeeBps;
    const appFeeMinor = Math.min(
      amountMinor,
      Math.floor(
        (amountMinor * feeBps) / 10000,
      ),
    );
    const idempotencyKey = randomUUID();

    const { data: purchase, error: purchaseError } =
      await supabaseAdmin
        .from("commerce_purchases")
        .insert({
          product_id: product.id,
          owner_user_id:
            product.owner_user_id,
          buyer_user_id: user.id,
          provider: "square",
          status: "created",
          amount,
          currency,
          merchant_id:
            connection.merchantId,
          location_id:
            connection.locationId,
          idempotency_key:
            idempotencyKey,
          app_fee_amount:
            fromMinorUnits(
              appFeeMinor,
              currency,
            ),
        })
        .select("id")
        .single();

    if (purchaseError || !purchase) {
      throw purchaseError ??
        new Error("PURCHASE_CREATE_FAILED");
    }

    const link =
      await createSquarePaymentLink({
        accessToken: connection.accessToken,
        locationId: connection.locationId,
        idempotencyKey,
        name: product.name,
        amountMinor,
        currency,
        redirectUrl: resultUrl,
        buyerEmail: user.email ?? null,
        paymentNote:
          `PARARI commerce purchase:${purchase.id}`,
        appFeeMinor,
      });

    const { error: updateError } =
      await supabaseAdmin
        .from("commerce_purchases")
        .update({
          status: "pending",
          provider_order_id: link.orderId,
          provider_payment_link_id: link.id,
          checkout_url: link.url,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", purchase.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      recurring: false,
      url: link.url,
    });
  } catch (error) {
    console.error("[commerce/checkout]", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error &&
          (
            error.message === "SQUARE_NOT_CONNECTED" ||
            error.message === "SQUARE_RECONNECT_REQUIRED"
          )
            ? "販売者のSquare接続を確認できません。"
            : "決済を開始できませんでした。",
      },
      { status: 503 },
    );
  }
}
