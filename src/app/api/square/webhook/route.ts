// src/app/api/square/webhook/route.ts
// 2026-10-05 00:25 JST
// PART: Square webhook router
// コメント:
// - APPLICATION単発決済
// - 作品等の単発販売
// - Square Subscriptionの月謝支払い
// を同じ署名検証・重複排除の下で処理する。

import {
  createHmac,
  timingSafeEqual,
} from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getUserPlanAccess } from "@/lib/billing/access";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  refundSquarePayment,
  retrieveSquareCustomer,
  retrieveSquareSubscription,
} from "@/lib/square/api";
import {
  getSquareWebhookNotificationUrl,
  getSquareWebhookSignatureKey,
} from "@/lib/square/config";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

export const runtime = "nodejs";

type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
  amount_money?: {
    amount?: number;
    currency?: string;
  };
};

type SquareInvoice = {
  id?: string;
  order_id?: string;
  subscription_id?: string;
  primary_recipient?: {
    customer_id?: string;
  };
};

type SquareRefund = {
  id?: string;
  payment_id?: string;
  order_id?: string;
  status?: string;
  amount_money?: {
    amount?: number;
    currency?: string;
  };
};

type SquareSubscription = {
  id?: string;
  customer_id?: string;
  plan_variation_id?: string;
  status?: string;
};

type SquareWebhookEvent = {
  event_id?: string;
  type?: string;
  merchant_id?: string;
  created_at?: string;
  data?: {
    object?: {
      payment?: SquarePayment;
      invoice?: SquareInvoice;
      refund?: SquareRefund;
      subscription?: SquareSubscription;
    };
  };
};

function validSignature(
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac(
    "sha256",
    getSquareWebhookSignatureKey(),
  )
    .update(
      getSquareWebhookNotificationUrl() +
        rawBody,
      "utf8",
    )
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

async function markProcessed(
  eventId: string,
): Promise<void> {
  await supabaseAdmin
    .from("square_webhook_events")
    .update({
      processed_at:
        new Date().toISOString(),
    })
    .eq("event_id", eventId);
}

function toMajorUnits(
  amountMinor: number,
  currency: string,
): number {
  return new Set(["JPY", "KRW", "VND"]).has(
    currency,
  )
    ? amountMinor
    : amountMinor / 100;
}

function toMinorUnits(
  amount: number,
  currency: string,
): number {
  return Math.round(
    amount *
      (
        new Set(["JPY", "KRW", "VND"]).has(
          currency,
        )
          ? 1
          : 100
      ),
  );
}

function billingMonth(
  value: string | undefined,
): string {
  const date = value
    ? new Date(value)
    : new Date();

  const safe =
    Number.isNaN(date.getTime())
      ? new Date()
      : date;

  return new Date(
    Date.UTC(
      safe.getUTCFullYear(),
      safe.getUTCMonth(),
      1,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

async function handleApplicationPayment(
  input: {
    eventId: string;
    merchantId?: string;
    payment: Required<
      Pick<
        SquarePayment,
        "id" | "order_id" | "amount_money"
      >
    >;
  },
): Promise<boolean> {
  const { payment } = input;

  const {
    data: paymentRecord,
    error: paymentRecordError,
  } = await supabaseAdmin
    .from("application_payments")
    .select(
      "id,owner_user_id,merchant_id,amount,currency,status",
    )
    .eq(
      "provider_order_id",
      payment.order_id,
    )
    .maybeSingle();

  if (paymentRecordError) {
    throw paymentRecordError;
  }

  if (!paymentRecord) {
    return false;
  }

  if (
    input.merchantId &&
    paymentRecord.merchant_id !==
      input.merchantId
  ) {
    throw new Error(
      "Square merchant mismatch",
    );
  }

  const amountMinor =
    payment.amount_money.amount!;
  const currency =
    payment.amount_money.currency!
      .toUpperCase();
  const amount =
    toMajorUnits(
      amountMinor,
      currency,
    );

  const {
    data: completionRows,
    error: completionError,
  } = await supabaseAdmin.rpc(
    "complete_application_square_payment",
    {
      p_order_id:
        payment.order_id,
      p_payment_id:
        payment.id,
      p_amount:
        amount,
      p_currency:
        currency,
    },
  );

  if (completionError) {
    throw completionError;
  }

  const completion =
    Array.isArray(completionRows)
      ? completionRows[0]
      : completionRows;

  if (
    completion?.was_expired === true
  ) {
    const connection =
      await getUsableSquareConnection(
        paymentRecord.owner_user_id,
      );

    await refundSquarePayment({
      accessToken:
        connection.accessToken,
      paymentId: payment.id,
      amountMinor,
      currency,
      idempotencyKey:
        `late-${input.eventId}`.slice(
          0,
          45,
        ),
      reason:
        "PARARI APPLICATION payment hold expired",
    });

    const { error: refundUpdateError } =
      await supabaseAdmin
        .from("application_payments")
        .update({
          status: "refunded",
          refunded_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);

    if (refundUpdateError) {
      throw refundUpdateError;
    }
  }

  return true;
}

async function handleCommercePayment(
  input: {
    merchantId?: string;
    payment: Required<
      Pick<
        SquarePayment,
        "id" | "order_id" | "amount_money"
      >
    >;
  },
): Promise<boolean> {
  const { payment } = input;

  const {
    data: purchase,
    error: purchaseError,
  } = await supabaseAdmin
    .from("commerce_purchases")
    .select(
      "id,owner_user_id,merchant_id,amount,currency",
    )
    .eq(
      "provider_order_id",
      payment.order_id,
    )
    .maybeSingle();

  if (purchaseError) {
    throw purchaseError;
  }

  if (!purchase) {
    return false;
  }

  if (
    input.merchantId &&
    purchase.merchant_id !==
      input.merchantId
  ) {
    throw new Error(
      "Square commerce merchant mismatch",
    );
  }

  const currency =
    payment.amount_money.currency!
      .toUpperCase();
  const amount =
    toMajorUnits(
      payment.amount_money.amount!,
      currency,
    );

  const { error } =
    await supabaseAdmin.rpc(
      "complete_commerce_square_payment",
      {
        p_order_id:
          payment.order_id,
        p_payment_id:
          payment.id,
        p_amount:
          amount,
        p_currency:
          currency,
      },
    );

  if (error) {
    throw error;
  }

  return true;
}

async function handleCommerceRefund(
  event: SquareWebhookEvent,
): Promise<boolean> {
  const refund =
    event.data?.object?.refund;

  if (
    !refund?.id ||
    !refund.payment_id ||
    String(refund.status ?? "").toUpperCase() !==
      "COMPLETED" ||
    !refund.amount_money?.amount ||
    !refund.amount_money.currency
  ) {
    return false;
  }

  const {
    data: purchase,
    error: purchaseError,
  } = await supabaseAdmin
    .from("commerce_purchases")
    .select(
      "id,product_id,owner_user_id,buyer_user_id,amount,currency,status,refunded_amount",
    )
    .eq(
      "provider_payment_id",
      refund.payment_id,
    )
    .maybeSingle();

  if (purchaseError) {
    throw purchaseError;
  }

  if (!purchase) {
    return false;
  }

  const currency =
    String(
      refund.amount_money.currency,
    ).toUpperCase();
  const refundedAmount =
    toMajorUnits(
      refund.amount_money.amount,
      currency,
    );

  if (
    currency !==
    String(purchase.currency)
      .toUpperCase()
  ) {
    return true;
  }

  const now =
    new Date().toISOString();

  const {
    error: refundLedgerError,
  } = await supabaseAdmin
    .from("commerce_refunds")
    .insert({
      purchase_id:
        purchase.id,
      owner_user_id:
        purchase.owner_user_id,
      buyer_user_id:
        purchase.buyer_user_id,
      provider_refund_id:
        refund.id,
      amount:
        refundedAmount,
      currency,
      status: "completed",
      completed_at: now,
    });

  if (refundLedgerError) {
    if (
      refundLedgerError.code ===
      "23505"
    ) {
      return true;
    }

    throw refundLedgerError;
  }

  const currentRefunded =
    Number(
      purchase.refunded_amount ?? 0,
    );
  const nextRefunded =
    currentRefunded +
    refundedAmount;
  const isFullRefund =
    nextRefunded >=
    Number(purchase.amount);

  const { error: purchaseUpdateError } =
    await supabaseAdmin
      .from("commerce_purchases")
      .update({
        refunded_amount:
          nextRefunded,
        status:
          isFullRefund
            ? "refunded"
            : purchase.status,
        refunded_at:
          isFullRefund
            ? now
            : null,
        updated_at: now,
      })
      .eq("id", purchase.id);

  if (purchaseUpdateError) {
    throw purchaseUpdateError;
  }

  if (isFullRefund) {
    const {
      error: entitlementError,
    } = await supabaseAdmin
      .from("commerce_entitlements")
      .update({
        status: "revoked",
        updated_at: now,
      })
      .eq(
        "source_purchase_id",
        purchase.id,
      )
      .eq(
        "user_id",
        purchase.buyer_user_id,
      );

    if (entitlementError) {
      throw entitlementError;
    }
  }

  return true;
}

async function handleRecurringChargeFailure(
  event: SquareWebhookEvent,
): Promise<boolean> {
  const invoice =
    event.data?.object?.invoice;

  if (!invoice?.subscription_id) {
    return false;
  }

  const { data, error } =
    await supabaseAdmin
      .from("commerce_subscriptions")
      .update({
        status:
          "PAYMENT_FAILED",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "provider_subscription_id",
        invoice.subscription_id,
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function getSquareOwnerUserId(
  merchantId: string | undefined,
): Promise<string | null> {
  if (!merchantId) return null;

  const { data, error } =
    await supabaseAdmin
      .from("square_connections")
      .select("owner_user_id")
      .eq("merchant_id", merchantId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.owner_user_id ?? null;
}

async function ensureCommerceSubscription(
  event: SquareWebhookEvent,
  squareSubscription: {
    id: string;
    customerId: string;
    planVariationId: string;
    status: string | null;
  },
  checkoutOrderId?: string | null,
) {
  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from("commerce_subscriptions")
      .select("*")
      .eq(
        "provider_subscription_id",
        squareSubscription.id,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const {
    data: product,
    error: productError,
  } = await supabaseAdmin
    .from("commerce_products")
    .select(
      "id,owner_user_id,amount,currency,square_plan_variation_id",
    )
    .eq(
      "square_plan_variation_id",
      squareSubscription.planVariationId,
    )
    .maybeSingle();

  if (productError) {
    throw productError;
  }

  if (!product) {
    return null;
  }

  const connection =
    await getUsableSquareConnection(
      product.owner_user_id,
    );

  if (
    event.merchant_id &&
    connection.merchantId !==
      event.merchant_id
  ) {
    throw new Error(
      "Square recurring merchant mismatch",
    );
  }

  let checkout:
    | {
        id: string;
        product_id: string;
        owner_user_id: string;
        buyer_user_id: string;
        buyer_email: string | null;
        status: string;
        created_at: string;
      }
    | null = null;

  if (checkoutOrderId) {
    const {
      data: exactCheckout,
      error: exactCheckoutError,
    } = await supabaseAdmin
      .from(
        "commerce_subscription_checkouts",
      )
      .select(
        "id,product_id,owner_user_id,buyer_user_id,buyer_email,status,created_at",
      )
      .eq("product_id", product.id)
      .eq(
        "provider_order_id",
        checkoutOrderId,
      )
      .maybeSingle();

    if (exactCheckoutError) {
      throw exactCheckoutError;
    }

    checkout = exactCheckout;
  }

  let customerEmail:
    | string
    | null = null;

  if (!checkout) {
    const customer =
      await retrieveSquareCustomer({
        accessToken:
          connection.accessToken,
        customerId:
          squareSubscription.customerId,
      });

    customerEmail =
      customer.emailAddress;

    if (!customerEmail) {
      console.warn(
        "[square/webhook] recurring customer has no email",
        squareSubscription.id,
      );
      return null;
    }

    const {
      data: checkouts,
      error: checkoutError,
    } = await supabaseAdmin
      .from(
        "commerce_subscription_checkouts",
      )
      .select(
        "id,product_id,owner_user_id,buyer_user_id,buyer_email,status,created_at",
      )
      .eq("product_id", product.id)
      .eq("status", "pending")
      .eq(
        "buyer_email",
        customerEmail,
      )
      .order(
        "created_at",
        { ascending: false },
      )
      .limit(1);

    if (checkoutError) {
      throw checkoutError;
    }

    checkout =
      checkouts?.[0] ?? null;
  }

  if (!checkout) {
    console.warn(
      "[square/webhook] no matching recurring checkout",
      {
        subscriptionId:
          squareSubscription.id,
        productId: product.id,
        checkoutOrderId:
          checkoutOrderId ?? null,
        customerEmail,
      },
    );
    return null;
  }

  const { entitlements } =
    await getUserPlanAccess(
      checkout.owner_user_id,
    );

  const {
    data: inserted,
    error: insertError,
  } = await supabaseAdmin
    .from("commerce_subscriptions")
    .insert({
      product_id:
        checkout.product_id,
      owner_user_id:
        checkout.owner_user_id,
      buyer_user_id:
        checkout.buyer_user_id,
      buyer_email:
        checkout.buyer_email,
      provider: "square",
      provider_customer_id:
        squareSubscription.customerId,
      provider_subscription_id:
        squareSubscription.id,
      billing_amount:
        Number(product.amount),
      billing_currency:
        String(product.currency)
          .toUpperCase(),
      status:
        String(
          squareSubscription.status ??
            "ACTIVE",
        ).toUpperCase(),
      app_fee_bps:
        entitlements.salesFeeBps,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw insertError ??
      new Error(
        "Failed to create commerce subscription",
      );
  }

  const { error: checkoutUpdateError } =
    await supabaseAdmin
      .from(
        "commerce_subscription_checkouts",
      )
      .update({
        status: "active",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", checkout.id);

  if (checkoutUpdateError) {
    throw checkoutUpdateError;
  }

  return inserted;
}

async function handleInvoicePaymentMade(
  event: SquareWebhookEvent,
): Promise<boolean> {
  const invoice =
    event.data?.object?.invoice;

  if (
    !invoice?.id ||
    !invoice.subscription_id
  ) {
    return false;
  }

  let {
    data: subscription,
    error: subscriptionError,
  } = await supabaseAdmin
    .from("commerce_subscriptions")
    .select("*")
    .eq(
      "provider_subscription_id",
      invoice.subscription_id,
    )
    .maybeSingle();

  if (subscriptionError) {
    throw subscriptionError;
  }

  if (!subscription) {
    const ownerUserId =
      await getSquareOwnerUserId(
        event.merchant_id,
      );

    if (!ownerUserId) {
      return false;
    }

    const connection =
      await getUsableSquareConnection(
        ownerUserId,
      );
    const remote =
      await retrieveSquareSubscription({
        accessToken:
          connection.accessToken,
        subscriptionId:
          invoice.subscription_id,
      });

    subscription =
      await ensureCommerceSubscription(
        event,
        remote,
        invoice.order_id ?? null,
      );

    if (!subscription) {
      return false;
    }
  }

  const amount =
    Number(
      subscription.billing_amount,
    );
  const currency =
    String(
      subscription.billing_currency,
    ).toUpperCase();

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !currency
  ) {
    throw new Error(
      "Recurring subscription billing snapshot is invalid",
    );
  }
  const amountMinor =
    toMinorUnits(amount, currency);
  const feeMinor =
    Math.min(
      amountMinor,
      Math.floor(
        (
          amountMinor *
          Number(
            subscription.app_fee_bps ??
              500,
          )
        ) /
          10000,
      ),
    );
  const feeAmount =
    toMajorUnits(
      feeMinor,
      currency,
    );

  const { error: ledgerError } =
    await supabaseAdmin
      .from(
        "commerce_platform_fee_ledger",
      )
      .insert({
        owner_user_id:
          subscription.owner_user_id,
        subscription_id:
          subscription.id,
        provider_charge_id:
          invoice.id,
        gross_amount: amount,
        fee_amount: feeAmount,
        currency,
        paid_at:
          event.created_at ??
          new Date().toISOString(),
        billing_month:
          billingMonth(
            event.created_at,
          ),
        status: "open",
      });

  if (
    ledgerError &&
    ledgerError.code !== "23505"
  ) {
    throw ledgerError;
  }

  const { error: subscriptionUpdateError } =
    await supabaseAdmin
      .from("commerce_subscriptions")
      .update({
        status: "ACTIVE",
        provider_customer_id:
          invoice.primary_recipient
            ?.customer_id ??
          subscription.provider_customer_id ??
          null,
        last_payment_at:
          event.created_at ??
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscription.id);

  if (subscriptionUpdateError) {
    throw subscriptionUpdateError;
  }

  return true;
}

async function handleSubscriptionUpdated(
  event: SquareWebhookEvent,
): Promise<boolean> {
  const source =
    event.data?.object?.subscription;

  if (!source?.id) {
    return false;
  }

  let {
    data: local,
    error: localError,
  } = await supabaseAdmin
    .from("commerce_subscriptions")
    .select("*")
    .eq(
      "provider_subscription_id",
      source.id,
    )
    .maybeSingle();

  if (localError) {
    throw localError;
  }

  if (
    !local &&
    source.customer_id &&
    source.plan_variation_id
  ) {
    local =
      await ensureCommerceSubscription(
        event,
        {
          id: source.id,
          customerId:
            source.customer_id,
          planVariationId:
            source.plan_variation_id,
          status:
            source.status ?? null,
        },
      );
  }

  if (!local) {
    return false;
  }

  const status =
    String(
      source.status ??
        local.status ??
        "",
    ).toUpperCase();

  const update: Record<
    string,
    unknown
  > = {
    status:
      status || "UNKNOWN",
    canceled_at:
      status === "CANCELED"
        ? new Date().toISOString()
        : null,
    updated_at:
      new Date().toISOString(),
  };

  if (source.customer_id) {
    update.provider_customer_id =
      source.customer_id;
  }

  const { error } =
    await supabaseAdmin
      .from("commerce_subscriptions")
      .update(update)
      .eq("id", local.id);

  if (error) {
    throw error;
  }

  return true;
}

export async function POST(
  request: NextRequest,
) {
  const rawBody = await request.text();
  const signature =
    request.headers.get(
      "x-square-hmacsha256-signature",
    ) ?? "";

  try {
    if (
      !signature ||
      !validSignature(
        rawBody,
        signature,
      )
    ) {
      return NextResponse.json(
        { ok: false },
        { status: 403 },
      );
    }
  } catch (error) {
    console.error(
      "[square/webhook] signature configuration error",
      error,
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }

  let event: SquareWebhookEvent;

  try {
    event =
      JSON.parse(
        rawBody,
      ) as SquareWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 400 },
    );
  }

  const eventId =
    String(event.event_id ?? "").trim();
  const eventType =
    String(event.type ?? "").trim();

  if (!eventId || !eventType) {
    return NextResponse.json(
      { ok: false },
      { status: 400 },
    );
  }

  const {
    data: existingEvent,
  } = await supabaseAdmin
    .from("square_webhook_events")
    .select("processed_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent?.processed_at) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
    });
  }

  if (!existingEvent) {
    const { error } =
      await supabaseAdmin
        .from("square_webhook_events")
        .insert({
          event_id: eventId,
          event_type: eventType,
          merchant_id:
            event.merchant_id ?? null,
        });

    if (
      error &&
      error.code !== "23505"
    ) {
      console.error(
        "[square/webhook] event insert failed",
        error,
      );
      return NextResponse.json(
        { ok: false },
        { status: 500 },
      );
    }
  }

  try {
    let handled = false;

    if (
      eventType === "payment.updated" ||
      eventType === "payment.created"
    ) {
      const payment =
        event.data?.object?.payment;

      if (
        payment?.status === "COMPLETED" &&
        payment.id &&
        payment.order_id &&
        payment.amount_money?.amount &&
        payment.amount_money.currency
      ) {
        const requiredPayment = {
          id: payment.id,
          order_id: payment.order_id,
          amount_money: {
            amount:
              payment.amount_money.amount,
            currency:
              payment.amount_money.currency,
          },
        };

        handled =
          await handleApplicationPayment({
            eventId,
            merchantId:
              event.merchant_id,
            payment: requiredPayment,
          });

        if (!handled) {
          handled =
            await handleCommercePayment({
              merchantId:
                event.merchant_id,
              payment: requiredPayment,
            });
        }
      }
    } else if (
      eventType === "refund.updated"
    ) {
      handled =
        await handleCommerceRefund(
          event,
        );
    } else if (
      eventType === "invoice.payment_made"
    ) {
      handled =
        await handleInvoicePaymentMade(
          event,
        );
    } else if (
      eventType ===
      "invoice.scheduled_charge_failed"
    ) {
      handled =
        await handleRecurringChargeFailure(
          event,
        );
    } else if (
      eventType === "subscription.updated" ||
      eventType === "subscription.created"
    ) {
      handled =
        await handleSubscriptionUpdated(
          event,
        );
    }

    await markProcessed(eventId);

    return NextResponse.json({
      ok: true,
      handled,
    });
  } catch (error) {
    console.error(
      "[square/webhook] processing failed",
      error,
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }
}
